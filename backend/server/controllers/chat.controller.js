import {
  allowMessage,
  banUser,
  deleteMessage,
  getBans,
  getRecentMessages,
  saveMessage,
  tooFastError,
  unbanUser,
} from "../services/chat.service.js";
import { broadcastToBuilding } from "../sockets/chat.socket.js";

const MAX_LIMIT = 100;

// The socket throws { code, message }. A route also needs the HTTP status that fits the code.
const STATUS_BY_CODE = {
  NO_TOKEN: 401,
  INVALID_TOKEN: 401,
  CHAT_BANNED: 403,
  BUILDING_NOT_FOUND: 404,
  CHAT_TEXT_INVALID: 400,
  CHAT_TOO_FAST: 429,
};

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

// POST /api/buildings/:buildingId/chat/messages  { text }  (any logged-in user)
// The same as chat:send on the socket, for a client that is not connected to it.
export async function sendMessage(req, res, next) {
  try {
    const { buildingId } = req.params;
    const userId = req.user.userId;

    if (!allowMessage(userId)) {
      throw tooFastError();
    }

    const message = await saveMessage({ buildingId, userId, text: req.body.text });
    broadcastToBuilding(buildingId, "chat:message", message);
    res.status(201).json(message);
  } catch (error) {
    if (error.code && !error.status) {
      error.status = STATUS_BY_CODE[error.code] ?? 400;
    }
    next(error);
  }
}

// DELETE /api/buildings/:buildingId/chat/messages/:messageId  (a manager of the building)
export async function removeMessage(req, res, next) {
  try {
    const { buildingId, messageId } = req.params;

    await deleteMessage(buildingId, messageId);
    broadcastToBuilding(buildingId, "chat:deleted", { messageId }); // it disappears for everyone who has the chat open
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

// GET /api/buildings/:buildingId/chat/bans  (a manager of the building)
export async function listBans(req, res, next) {
  try {
    res.json(await getBans(req.params.buildingId));
  } catch (error) {
    next(error);
  }
}

// POST /api/buildings/:buildingId/chat/bans  { userId }  (a manager of the building)
export async function addBan(req, res, next) {
  try {
    res.status(201).json(await banUser(req.params.buildingId, req.body.userId));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/buildings/:buildingId/chat/bans/:userId  (a manager of the building)
export async function removeBan(req, res, next) {
  try {
    await unbanUser(req.params.buildingId, req.params.userId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
