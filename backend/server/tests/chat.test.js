import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { BUILDING_ID, useFakeRepos } from "./helpers.js";

// The chat of a building: the rules of a message, and the live side (Socket.IO) with a fake socket.

process.env.JWT_SECRET = "test-secret";

const { mongoRepo, supabaseRepo, resetData } = useFakeRepos();

const { banUser, createRateLimiter, deleteMessage, getBans, getRecentMessages, saveMessage, unbanUser } = await import(
  "../services/chat.service.js"
);
const { setupChatSocket } = await import("../sockets/chat.socket.js");

let userId;

beforeEach(async () => {
  await resetData();
  mock.method(console, "error", () => {});
  userId = (await supabaseRepo.insertOne("users", { username: "dana_levi", role: "visitor" })).id;
});

async function failureOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("Expected the message to be refused");
}

// ---------- The rules of a message ----------

test("a message of a logged-in user is saved with his name from the database, trimmed", async () => {
  const message = await saveMessage({ buildingId: BUILDING_ID, userId, text: "  שלום לכולם  " });

  assert.equal(message.text, "שלום לכולם");
  assert.equal(message.username, "dana_levi");
  assert.equal(typeof message._id, "string");
  assert.equal(mongoRepo.all("messages").length, 1);
});

test("a guest, an empty message, a too long one and an unknown building are refused", async () => {
  const guest = await failureOf(saveMessage({ buildingId: BUILDING_ID, userId: null, text: "hi" }));
  const empty = await failureOf(saveMessage({ buildingId: BUILDING_ID, userId, text: "   " }));
  const long = await failureOf(saveMessage({ buildingId: BUILDING_ID, userId, text: "a".repeat(501) }));
  const nowhere = await failureOf(saveMessage({ buildingId: "33333333-3333-4333-8333-333333333333", userId, text: "hi" }));

  assert.deepEqual(
    [guest.code, empty.code, long.code, nowhere.code],
    ["NO_TOKEN", "CHAT_TEXT_INVALID", "CHAT_TEXT_INVALID", "BUILDING_NOT_FOUND"],
  );
  assert.equal(mongoRepo.all("messages").length, 0);
});

test("a user we blocked in this building can't write", async () => {
  await supabaseRepo.insertOne("chat_bans", { building_id: BUILDING_ID, user_id: userId });

  const error = await failureOf(saveMessage({ buildingId: BUILDING_ID, userId, text: "hi" }));

  assert.equal(error.code, "CHAT_BANNED");
});

test("the last messages come back oldest first, only of this building", async () => {
  const at = (minute) => new Date(2026, 0, 1, 10, minute);
  await mongoRepo.insertOne("messages", { buildingId: BUILDING_ID, userId, username: "a", text: "second", createdAt: at(2) });
  await mongoRepo.insertOne("messages", { buildingId: BUILDING_ID, userId, username: "a", text: "first", createdAt: at(1) });
  await mongoRepo.insertOne("messages", { buildingId: BUILDING_ID, userId, username: "a", text: "third", createdAt: at(3) });
  await mongoRepo.insertOne("messages", { buildingId: "other", userId, username: "a", text: "elsewhere", createdAt: at(4) });

  const messages = await getRecentMessages(BUILDING_ID, 2);

  assert.deepEqual(messages.map((message) => message.text), ["second", "third"]);
});

test("the rate limit lets 5 messages in 10 seconds through, and opens again later", () => {
  const allow = createRateLimiter({ max: 5, perMs: 10000 });
  const results = [0, 1, 2, 3, 4, 5].map((second) => allow("dana", second * 1000));

  assert.deepEqual(results, [true, true, true, true, true, false]);
  assert.equal(allow("noa", 5000), true); // another writer has his own count
  assert.equal(allow("dana", 11000), true);
});

// ---------- Moderation ----------

test("a deleted message is gone, and a message of another building can't be deleted from here", async () => {
  const mine = await saveMessage({ buildingId: BUILDING_ID, userId, text: "first" });
  const foreignId = String(await mongoRepo.insertOne("messages", { buildingId: "other-building", userId, text: "x", createdAt: new Date() }));

  await deleteMessage(BUILDING_ID, mine._id);
  const foreign = await failureOf(deleteMessage(BUILDING_ID, foreignId));
  const notAnId = await failureOf(deleteMessage(BUILDING_ID, "abc"));

  assert.deepEqual(mongoRepo.all("messages").map((message) => String(message._id)), [foreignId]);
  assert.deepEqual([foreign.code, notAnId.code], ["MESSAGE_NOT_FOUND", "MESSAGE_NOT_FOUND"]);
});

test("a blocked user can't write until he is unblocked, and blocking twice is fine", async () => {
  await banUser(BUILDING_ID, userId);
  await banUser(BUILDING_ID, userId);

  assert.deepEqual(await getBans(BUILDING_ID), [{ userId, username: "dana_levi", createdAt: null }]);
  assert.equal((await failureOf(saveMessage({ buildingId: BUILDING_ID, userId, text: "hi" }))).code, "CHAT_BANNED");

  await unbanUser(BUILDING_ID, userId);

  assert.equal((await saveMessage({ buildingId: BUILDING_ID, userId, text: "hi" })).text, "hi");
  assert.equal((await failureOf(banUser(BUILDING_ID, "44444444-4444-4444-8444-444444444444"))).code, "USER_NOT_FOUND");
});

// ---------- The live side ----------

// Runs setupChatSocket on a fake io, and connects one fake socket with this token
function connect(token) {
  const broadcasts = []; // what was sent to a whole room
  const replies = []; // what was sent back to this socket only
  const handlers = {};
  let middleware;
  let onConnection;

  setupChatSocket({
    use: (fn) => (middleware = fn),
    on: (_event, fn) => (onConnection = fn),
    to: (room) => ({ emit: (event, payload) => broadcasts.push({ room, event, payload }) }),
  });

  const socket = {
    handshake: { auth: token ? { token } : {} },
    data: {},
    rooms: new Set(),
    join: (room) => socket.rooms.add(room),
    leave: (room) => socket.rooms.delete(room),
    on: (event, fn) => (handlers[event] = fn),
    emit: (event, payload) => replies.push({ event, payload }),
  };

  middleware(socket, () => {});
  onConnection(socket);
  return { socket, handlers, broadcasts, replies };
}

test("a message that was sent reaches everyone in the room of the building", async () => {
  const token = jwt.sign({ userId, role: "visitor" }, process.env.JWT_SECRET);
  const { socket, handlers, broadcasts, replies } = connect(token);

  handlers["chat:join"]({ buildingId: BUILDING_ID });
  await handlers["chat:send"]({ buildingId: BUILDING_ID, text: "שלום" });

  assert.deepEqual([...socket.rooms], [`building:${BUILDING_ID}`]);
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].room, `building:${BUILDING_ID}`);
  assert.equal(broadcasts[0].event, "chat:message");
  assert.equal(broadcasts[0].payload.text, "שלום");
  assert.equal(replies.length, 0);
});

test("a guest (no token, or a bad one) can join and read, and gets an error only he sees when he writes", async () => {
  for (const token of [null, "not-a-real-token"]) {
    const { socket, handlers, broadcasts, replies } = connect(token);

    handlers["chat:join"]({ buildingId: BUILDING_ID });
    await handlers["chat:send"]({ buildingId: BUILDING_ID, text: "hi" });

    assert.equal(socket.rooms.size, 1);
    assert.equal(broadcasts.length, 0);
    assert.deepEqual(replies.map((reply) => [reply.event, reply.payload.code]), [["chat:error", "NO_TOKEN"]]);
  }
});
