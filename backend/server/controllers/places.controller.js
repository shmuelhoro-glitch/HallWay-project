import { mongoRepo } from "../repositories/mongoRepo.js";

// The user's text is searched as plain text, not as a regex ("a.*" must not return everything)
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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