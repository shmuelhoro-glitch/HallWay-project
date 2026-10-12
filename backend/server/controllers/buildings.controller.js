import { geocodeAddress } from "../services/geocoding.service.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { readSvgSize } from "../services/buildings.service.js";
import { wakeRoutingService } from "../services/routingClient.js";

export async function createBuilding(req, res, next) {
  try {
    const { name, type, address, city, alert_area, floors_count } = req.body;

    const { lat, lng } = await geocodeAddress(address, city);

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

    res.status(201).json(newBuilding);
  } catch (err) {
    next(err);
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