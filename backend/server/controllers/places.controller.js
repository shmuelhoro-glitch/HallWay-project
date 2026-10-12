import { ObjectId } from "mongodb";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";
import { deleteEdgesOfNode, updateEdgeLengths } from "../services/graph.service.js";

// A visitor picks a landmark to say where he is, so the list must stay short
const MAX_LANDMARKS_PER_FLOOR = 5;

// The user's text is searched as plain text, not as a regex ("a.*" must not return everything)
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function placeNotFound() {
  return { status: 404, code: "PLACE_NOT_FOUND", message: "Place not found" };
}

// GET /api/buildings/:buildingId/places?q=&category=&floor=  (open to everyone)
export async function getPlaces(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { q, category, floor } = req.query;

    const query = { buildingId };

    if (q) {
      query.name = { $regex: escapeRegex(q), $options: "i" };
    }
    if (category) {
      query.category = category;
    }
    if (floor !== undefined) {
      query.floor = Number(floor);
    }

    const places = await mongoRepo.findMany("places", query);
    res.json(places);
  } catch (error) {
    next(error);
  }
}



// 1. יצירת מקום חדש: POST /api/buildings/:buildingId/places
export async function createPlace(req, res, next) {
  try {
    const { buildingId } = req.params;
    const {
      floor,
      name,
      type,
      category,
      x,
      y,
      hours,
      url,
      isLandmark = false,
    } = req.body;

    // א. בדיקת מגבלת 5 מקומות בולטים (landmarks) בקומה
    if (isLandmark) {
      const landmarks = await mongoRepo.findMany("places", {
        buildingId,
        floor,
        isLandmark: true,
      });

      if (landmarks.length >= 5) {
        throw {
          status: 400,
          code: "TOO_MANY_LANDMARKS",
          message: "Cannot have more than 5 landmarks on the same floor",
        };
      }
    }

    // ב. יצירת צומת כניסה (entrance) אוטומטי באוסף nodes
    const nodeId = await mongoRepo.insertOne("nodes", {
      buildingId,
      floor,
      x,
      y,
      type: "entrance",
      connectorId: null,
      label: name,
    });

    // ג. בניית אובייקט המקום ושמירתו באוסף places
    const place = {
      buildingId,
      floor,
      name,
      type,
      category,
      x,
      y,
      isLandmark,
      entryNodeId: String(nodeId),
    };

    if (hours) place.hours = hours;
    if (url) place.url = url;

    const placeId = await mongoRepo.insertOne("places", place);

    // ד. החזרת המקום שנוצר כולל ה-_id שלו
    res.status(201).json({ _id: placeId, ...place });
  } catch (err) {
    next(err);
  }
}

// 2. עדכון מקום קיים: PUT /api/buildings/:buildingId/places/:placeId
export async function updatePlace(req, res, next) {
  try {
    const { buildingId, placeId } = req.params;

    // א. בדיקה שהמזהה תקין ושהמקום באמת קיים במבנה הזה
    if (!ObjectId.isValid(placeId)) {
      throw { status: 404, code: "PLACE_NOT_FOUND", message: "Place not found" };
    }

    const _id = new ObjectId(placeId);
    const existingPlace = await mongoRepo.findOne("places", { _id, buildingId });

    if (!existingPlace) {
      throw { status: 404, code: "PLACE_NOT_FOUND", message: "Place not found" };
    }

    // ב. אם המקום הופך לבולט (או עובר קומה כשהוא בולט) - בודקים שאין כבר 5 אחרים בקומה
    const targetFloor = req.body.floor ?? existingPlace.floor;
    const willBeLandmark = req.body.isLandmark ?? existingPlace.isLandmark;

    if (willBeLandmark) {
      const landmarks = await mongoRepo.findMany("places", {
        buildingId,
        floor: targetFloor,
        isLandmark: true,
      });

      const otherLandmarks = landmarks.filter(
        (p) => String(p._id) !== placeId
      );

      if (otherLandmarks.length >= 5) {
        throw {
          status: 400,
          code: "TOO_MANY_LANDMARKS",
          message: "Cannot have more than 5 landmarks on the same floor",
        };
      }
    }

    // ג. עדכון השדות של המקום עצמו באוסף places
    await mongoRepo.updateOne("places", { _id }, { $set: req.body });

    // ד. אם השתנו x, y, floor או name - מעדכנים גם את צומת הכניסה התואם ב-nodes
    const entryNodeId = existingPlace.entryNodeId;
    const nodeUpdates = {};

    if (req.body.x !== undefined) nodeUpdates.x = req.body.x;
    if (req.body.y !== undefined) nodeUpdates.y = req.body.y;
    if (req.body.floor !== undefined) nodeUpdates.floor = req.body.floor;
    if (req.body.name !== undefined) nodeUpdates.label = req.body.name;

    if (Object.keys(nodeUpdates).length > 0 && entryNodeId) {
      await mongoRepo.updateOne(
        "nodes",
        { _id: new ObjectId(entryNodeId) },
        { $set: nodeUpdates }
      );
    }

    // ה. טיפול בקשתות (edges) שמחוברות לצומת הכניסה:
    const floorChanged =
      req.body.floor !== undefined && req.body.floor !== existingPlace.floor;
    const coordsChanged =
      (req.body.x !== undefined && req.body.x !== existingPlace.x) ||
      (req.body.y !== undefined && req.body.y !== existingPlace.y);

    if (floorChanged && entryNodeId) {
      // אם הקומה השתנתה - מוחקים את הקשתות מהקומה הישנה
      await mongoRepo.deleteMany("edges", {
        $or: [{ from: entryNodeId }, { to: entryNodeId }],
      });
    } else if (coordsChanged && entryNodeId) {
      // אם רק המיקום (x או y) השתנה באותה קומה - מחשבים מחדש את אורך הקשתות
      await updateEdgeLengths(entryNodeId);
    }

    // ו. שליפת המקום המעודכן והחזרתו ללקוח
    const updatedPlace = await mongoRepo.findOne("places", { _id, buildingId });
    res.status(200).json(updatedPlace);
  } catch (err) {
    next(err);
  }
}

// 3. מחיקת מקום: DELETE /api/buildings/:buildingId/places/:placeId
export async function deletePlace(req, res, next) {
  try {
    const { buildingId, placeId } = req.params;

    // א. בדיקה שהמזהה תקין ושהמקום קיים
    if (!ObjectId.isValid(placeId)) {
      throw { status: 404, code: "PLACE_NOT_FOUND", message: "Place not found" };
    }

    const _id = new ObjectId(placeId);
    const existingPlace = await mongoRepo.findOne("places", { _id, buildingId });

    if (!existingPlace) {
      throw { status: 404, code: "PLACE_NOT_FOUND", message: "Place not found" };
    }

    const entryNodeId = existingPlace.entryNodeId;

    // ב. מחיקת הקשתות שמחוברות לצומת הכניסה, ואז מחיקת צומת הכניסה עצמו
    if (entryNodeId) {
      await mongoRepo.deleteMany("edges", {
        $or: [{ from: entryNodeId }, { to: entryNodeId }],
      });

      if (ObjectId.isValid(entryNodeId)) {
        await mongoRepo.deleteOne("nodes", {
          _id: new ObjectId(entryNodeId),
        });
      }
    }

    // ג. מחיקת המקום עצמו מאוסף places
    await mongoRepo.deleteOne("places", { _id });

    // ד. החזרת סטטוס 204 (הצליח, ללא תוכן בגוף התשובה)
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
