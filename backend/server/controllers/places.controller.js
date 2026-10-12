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

// Throws when the floor already has 5 landmarks (not counting the place we are editing)
async function checkLandmarkLimit(buildingId, floor, ignorePlaceId) {
  const landmarks = await mongoRepo.findMany("places", { buildingId, floor, isLandmark: true });
  const others = landmarks.filter((place) => String(place._id) !== ignorePlaceId);

  if (others.length >= MAX_LANDMARKS_PER_FLOOR) {
    throw {
      status: 400,
      code: "TOO_MANY_LANDMARKS",
      message: `A floor can have up to ${MAX_LANDMARKS_PER_FLOOR} landmarks`,
    };
  }
}

// POST /api/buildings/:buildingId/places  (admin)
// Every place gets an entrance node in the walking graph, in the same spot.
// The admin then connects that node to a walkway in the editor.
export async function createPlace(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { floor, name, type, category, x, y, hours, url, isLandmark } = req.body;

    const building = await supabaseRepo.findOne("buildings", { id: buildingId });
    if (!building) {
      throw { status: 404, code: "BUILDING_NOT_FOUND", message: "Building not found" };
    }

    if (isLandmark) {
      await checkLandmarkLimit(buildingId, floor, null);
    }

    // 1. The entrance node (insertOne returns its ObjectId)
    const nodeId = await mongoRepo.insertOne("nodes", {
      buildingId,
      floor,
      x,
      y,
      type: "entrance",
      label: name,
    });

    // 2. The place. Optional fields only when they have a value (no nulls in the database).
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
    if (hours) {
      place.hours = hours;
    }
    if (url) {
      place.url = url;
    }

    const placeId = await mongoRepo.insertOne("places", place);
    res.status(201).json({ _id: placeId, ...place });
  } catch (error) {
    next(error);
  }
}

// The entrance node follows the place: same floor, same spot, same name
async function syncEntryNode(place, changes) {
  if (!place.entryNodeId) return;

  const nodeChanges = {};
  if (changes.floor !== undefined) nodeChanges.floor = changes.floor;
  if (changes.x !== undefined) nodeChanges.x = changes.x;
  if (changes.y !== undefined) nodeChanges.y = changes.y;
  if (changes.name !== undefined) nodeChanges.label = changes.name;

  if (Object.keys(nodeChanges).length === 0) return;

  await mongoRepo.updateOne("nodes", { _id: new ObjectId(place.entryNodeId) }, { $set: nodeChanges });

  const floorChanged = changes.floor !== undefined && changes.floor !== place.floor;
  const moved = changes.x !== undefined || changes.y !== undefined;

  if (floorChanged) {
    // Its walkways belong to the old floor - remove them. The admin connects it again on the new floor.
    await deleteEdgesOfNode(place.entryNodeId);
  } else if (moved) {
    await updateEdgeLengths(place.entryNodeId);
  }
}

// PUT /api/buildings/:buildingId/places/:placeId  (admin) - send only what changed
export async function updatePlace(req, res, next) {
  try {
    const { buildingId, placeId } = req.params;

    if (!ObjectId.isValid(placeId)) {
      throw placeNotFound();
    }
    const _id = new ObjectId(placeId);

    const place = await mongoRepo.findOne("places", { _id, buildingId });
    if (!place) {
      throw placeNotFound();
    }

    const changes = req.body;

    // Becomes a landmark, or moves as a landmark to another floor: check the limit there
    const newFloor = changes.floor ?? place.floor;
    const willBeLandmark = changes.isLandmark ?? place.isLandmark;
    if (willBeLandmark && (!place.isLandmark || newFloor !== place.floor)) {
      await checkLandmarkLimit(buildingId, newFloor, placeId);
    }

    // An empty text removes the field (for example, the admin deleted the opening hours)
    const fieldsToSet = {};
    const fieldsToRemove = {};
    for (const [key, value] of Object.entries(changes)) {
      if (value === "") {
        fieldsToRemove[key] = "";
      } else {
        fieldsToSet[key] = value;
      }
    }

    const update = {};
    if (Object.keys(fieldsToSet).length > 0) update.$set = fieldsToSet;
    if (Object.keys(fieldsToRemove).length > 0) update.$unset = fieldsToRemove;

    if (Object.keys(update).length > 0) {
      await mongoRepo.updateOne("places", { _id }, update);
    }

    await syncEntryNode(place, changes);

    const updatedPlace = await mongoRepo.findOne("places", { _id });
    res.json(updatedPlace);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/buildings/:buildingId/places/:placeId  (admin)
// Deletes, in this order: the walkways of the entrance node, the node, the place.
export async function deletePlace(req, res, next) {
  try {
    const { buildingId, placeId } = req.params;

    if (!ObjectId.isValid(placeId)) {
      throw placeNotFound();
    }
    const _id = new ObjectId(placeId);

    const place = await mongoRepo.findOne("places", { _id, buildingId });
    if (!place) {
      throw placeNotFound();
    }

    if (place.entryNodeId) {
      await deleteEdgesOfNode(place.entryNodeId);
      await mongoRepo.deleteOne("nodes", { _id: new ObjectId(place.entryNodeId) });
    }
    await mongoRepo.deleteOne("places", { _id });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
