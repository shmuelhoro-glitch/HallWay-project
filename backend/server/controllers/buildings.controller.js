import { geocodeAddress } from "../services/geocoding.service.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { readSvgSize } from "../services/buildings.service.js";
import { wakeRoutingService } from "../services/routingClient.js";
import { undo } from "../services/undo.js";

// POST /api/buildings  (admin or super)
// The building belongs to the manager who created it: it is added to his buildingIds.
export async function createBuilding(req, res, next) {
  try {
    const { name, type, address, city, alert_area, floors_count } = req.body;

    // The admin saw the spot on the map and confirmed it (or moved it): that is the spot.
    // Otherwise we look the address up, like before.
    const hasSpot = req.body.lat !== undefined && req.body.lng !== undefined;
    const { lat, lng } = hasSpot ? req.body : await geocodeAddress(address, city);

    const newBuilding = await supabaseRepo.insertOne("buildings", {
      name,
      type,
      address,
      city,
      lat,
      lng,
      alert_area,
      floors_count,
    });

    // A super manages every building anyway
    if (req.user.role !== "super") {
      try {
        await supabaseRepo.updateOne(
          "users",
          { id: req.user.userId },
          { buildingIds: [...req.user.buildingIds, newBuilding.id] }
        );
      } catch (error) {
        // A building that nobody can manage must not stay
        await undo(`delete the new building ${newBuilding.id}`, () =>
          supabaseRepo.deleteOne("buildings", { id: newBuilding.id })
        );
        throw error;
      }
    }

    res.status(201).json(newBuilding);
  } catch (err) {
    next(err);
  }
}

// Everything a building has in MongoDB, and in the tables that point at it
const BUILDING_COLLECTIONS = ["places", "edges", "nodes", "floors", "messages"];
const BUILDING_TABLES = ["chat_bans", "route_requests", "alerts"];

// DELETE /api/buildings/:buildingId  (a manager of this building, or a super)
// Deletes the building with everything in it. There is no way back, so the order matters:
// the content first and the building itself last. If something fails in the middle,
// the building is still in the list and can be deleted again.
export async function deleteBuilding(req, res, next) {
  try {
    const { buildingId } = req.params;

    const building = await supabaseRepo.findOne("buildings", { id: buildingId });
    if (!building) {
      throw { status: 404, code: "BUILDING_NOT_FOUND", message: "Building not found" };
    }

    for (const collection of BUILDING_COLLECTIONS) {
      await mongoRepo.deleteMany(collection, { buildingId });
    }

    // The database deletes these rows with the building (on delete cascade), if the tables were
    // created from scripts/tables.sql. Deleting them here too costs nothing, and a table that
    // does not exist yet must not stop the delete.
    for (const table of BUILDING_TABLES) {
      await undo(`delete the ${table} of building ${buildingId}`, () =>
        supabaseRepo.deleteOne(table, { building_id: buildingId })
      );
    }

    // No manager keeps a building that is gone
    const users = await supabaseRepo.findMany("users");
    for (const user of users) {
      if (Array.isArray(user.buildingIds) && user.buildingIds.includes(buildingId)) {
        await supabaseRepo.updateOne(
          "users",
          { id: user.id },
          { buildingIds: user.buildingIds.filter((id) => id !== buildingId) }
        );
      }
    }

    await supabaseRepo.deleteOne("buildings", { id: buildingId });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

// POST /api/buildings/geocode  { address, city }  (admin or super)
// Where the address is on the map, so the admin can check it before the building is saved.
export async function geocodeBuildingAddress(req, res, next) {
  try {
    const { address, city } = req.body;
    res.json(await geocodeAddress(address, city));
  } catch (error) {
    next(error);
  }
}

// GET /api/buildings/mine  (admin or super) - the buildings this user manages
export async function getMyBuildings(req, res, next) {
  try {
    const buildings = await supabaseRepo.findMany("buildings");

    if (req.user.role === "super") {
      return res.json(buildings);
    }
    res.json(buildings.filter((building) => req.user.buildingIds.includes(building.id)));
  } catch (error) {
    next(error);
  }
}


export async function addFloor(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { floor, name, svg } = req.body;

    const building = await supabaseRepo.findOne("buildings", { id: buildingId });
    if (!building) {
      throw { status: 404, code: "BUILDING_NOT_FOUND", message: "Building not found" };
    }

    const start = svg.indexOf("<svg");
    if (start === -1) {
      throw { status: 400, code: "INVALID_SVG", message: "The file is not an SVG" };
    }
    const cleanSvg = svg.slice(start);

    const { width, height } = readSvgSize(cleanSvg);

    const floorData = {
      buildingId,
      floor,
      name,
      svg: cleanSvg,
      width,
      height,
    };

    const existingFloor = await mongoRepo.findOne("floors", {
      buildingId,
      floor,
    });

    if (existingFloor) {
      await mongoRepo.updateOne(
        "floors",
        { buildingId, floor },
        { $set: floorData }
      );
    } else {
      await mongoRepo.insertOne("floors", floorData);
    }

    res.status(201).json({ floor, name, width, height });
  } catch (err) {
    next(err);
  }}

export async function getAllBuildings(req, res, next) {
    try {
        const {city, type} = req.query
        const data = await supabaseRepo.findMany("buildings", {city, type})
        res.send(data)
    } catch (error) {
        next(error)
    }
}


export async function getBuildingById(req, res, next) {
  try {
    const { buildingId } = req.params;

    const building = await supabaseRepo.findOne("buildings", { id: buildingId });
    if (!building) {
      throw { status: 404, code: "BUILDING_NOT_FOUND", message: "Building not found" };
    }

    // A visitor opened a building - wake the routing service now, so the first route is fast
    wakeRoutingService();

    const floorDocs = await mongoRepo.findMany("floors", { buildingId });

    // Only what the map needs, without the svg itself, from the lowest floor up
    const floors = floorDocs
      .map((floorDoc) => ({
        floor: floorDoc.floor,
        name: floorDoc.name,
        width: floorDoc.width,
        height: floorDoc.height,
      }))
      .sort((a, b) => a.floor - b.floor);

    res.json({ ...building, floors });
  } catch (error) {
    next(error);
  }
}

export async function getFloorPlan(req, res, next) {
  try {
    const { buildingId, floor } = req.params;

    const floorDoc = await mongoRepo.findOne("floors", { buildingId, floor: Number(floor) });
    if (!floorDoc) {
      throw { status: 404, code: "FLOOR_NOT_FOUND", message: "Floor not found" };
    }

    // Someone who opens the file directly in the browser won't run scripts hidden in it
    res.set("Content-Security-Policy", "script-src 'none'");
    // Check with the server every time (cheap: an unchanged plan answers 304),
    // so a plan the admin replaced shows up right away
    res.set("Cache-Control", "no-cache");
    res.type("image/svg+xml").send(floorDoc.svg);
  } catch (error) {
    next(error);
  }
}