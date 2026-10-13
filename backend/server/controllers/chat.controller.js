import { getRecentMessages } from "../services/chat.service.js";

const MAX_LIMIT = 100;

// GET /api/buildings/:buildingId/chat/messages?limit=50  (open to everyone)
// The last messages, for a visitor who just opened the chat. New ones arrive through Socket.IO.
export async function getMessages(req, res, next) {
  try {
    const { buildingId } = req.params;

    const asked = Number(req.query.limit);
    const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, MAX_LIMIT) : 50;

    res.json(await getRecentMessages(buildingId, limit));
  } catch (error) {
    next(error);
  }
}
