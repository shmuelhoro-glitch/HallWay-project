import { mongoRepo } from "../repositories/mongoRepo.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";

// The chat of a building: everyone may read, only a logged-in user may write.
// The messages are in MongoDB ("messages"), the same collection the demo data fills.

export const MAX_MESSAGE_LENGTH = 500;

// What the client gets. "_id" and "createdAt" always as text.
export function toMessageResponse(message) {
  return {
    _id: String(message._id),
    buildingId: message.buildingId,
    userId: message.userId,
    username: message.username,
    text: message.text,
    createdAt: new Date(message.createdAt).toISOString(),
  };
}

// The newest messages of a building, the oldest of them first (the order they are read in)
export async function getRecentMessages(buildingId, limit = 50) {
  const messages = await mongoRepo.findMany("messages", { buildingId });
  messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return messages.slice(-limit).map(toMessageResponse);
}

// A user we blocked from the chat of this building.
// The chat_bans table may not exist yet (scripts/tables.sql): then nobody is blocked.
async function isBanned(buildingId, userId) {
  try {
    const ban = await supabaseRepo.findOne("chat_bans", { building_id: buildingId, user_id: userId });
    return ban !== null;
  } catch (error) {
    console.error("Could not check chat bans:", error.message);
    return false;
  }
}

// Checks and saves one message. userId: from the token of the socket, null for a guest.
// Throws { code, message } - the socket sends it to the writer as chat:error.
export async function saveMessage({ buildingId, userId, text }) {
  if (!userId) {
    throw { code: "NO_TOKEN", message: "Please log in to write" };
  }

  const cleanText = typeof text === "string" ? text.trim() : "";
  if (cleanText === "" || cleanText.length > MAX_MESSAGE_LENGTH) {
    throw { code: "CHAT_TEXT_INVALID", message: `A message has 1 to ${MAX_MESSAGE_LENGTH} characters` };
  }

  // The name comes from the database, not from the client: nobody writes under another name
  const user = await supabaseRepo.findOne("users", { id: userId });
  if (!user) {
    throw { code: "INVALID_TOKEN", message: "Please log in again" };
  }

  const building = await supabaseRepo.findOne("buildings", { id: buildingId });
  if (!building) {
    throw { code: "BUILDING_NOT_FOUND", message: "Building not found" };
  }

  if (await isBanned(buildingId, userId)) {
    throw { code: "CHAT_BANNED", message: "You can't write in this chat" };
  }

  const message = { buildingId, userId, username: user.username, text: cleanText, createdAt: new Date() };
  const messageId = await mongoRepo.insertOne("messages", message);
  return toMessageResponse({ _id: messageId, ...message });
}

// Stops one writer from flooding the chat: at most "max" messages in "perMs" milliseconds.
// Returns a function: allow(key) is true when this writer may send now (and counts the message).
export function createRateLimiter({ max = 5, perMs = 10000 } = {}) {
  const sentAt = new Map(); // key -> the times of its last messages

  return function allow(key, now = Date.now()) {
    const recent = (sentAt.get(key) ?? []).filter((time) => now - time < perMs);
    if (recent.length >= max) {
      sentAt.set(key, recent);
      return false;
    }
    recent.push(now);
    sentAt.set(key, recent);
    return true;
  };
}

export function tooFastError() {
  return { code: "CHAT_TOO_FAST", message: "You are writing too fast. Wait a few seconds." };
}
