import { geocodeAddress } from "../services/geocoding.service.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { readSvgSize } from "../services/buildings.service.js";

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

    const start = svg.indexOf("<svg");
    if (start === -1) {
      throw { status: 400, message: "The file is not an SVG" };
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
  }
}