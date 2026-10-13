import jwt from "jsonwebtoken";
import { createRateLimiter, saveMessage, tooFastError } from "../services/chat.service.js";

// The live side of the chat (Socket.IO). The client:
//   connects with { auth: { token } } (a guest connects without a token, and can only read)
//   chat:join { buildingId }        -> enters the room of that building
//   chat:send { buildingId, text }  -> everyone in the room gets chat:message
//   a problem with a message        -> only the writer gets chat:error { code, message }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function roomOf(buildingId) {
  return `building:${buildingId}`;
}

export function setupChatSocket(io) {
  const allow = createRateLimiter();

  // Who is this? A bad or expired token is not an error here: the user is simply a guest.
  io.use((socket, next) => {
    try {
      const { userId } = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      socket.data.userId = userId;
    } catch {
      socket.data.userId = null;
    }
    next();
  });

  io.on("connection", (socket) => {
    socket.on("chat:join", (payload) => {
      const buildingId = payload?.buildingId;
      if (typeof buildingId !== "string" || !UUID.test(buildingId)) return;

      // One building at a time: leave the room of the building before it
      for (const room of socket.rooms) {
        if (room.startsWith("building:")) socket.leave(room);
      }
      socket.join(roomOf(buildingId));
    });

    socket.on("chat:send", async (payload) => {
      try {
        const buildingId = payload?.buildingId;
        if (typeof buildingId !== "string" || !UUID.test(buildingId)) {
          throw { code: "BUILDING_NOT_FOUND", message: "Building not found" };
        }

        // Counted per user, so opening a second tab does not give a second quota
        if (socket.data.userId && !allow(socket.data.userId)) {
          throw tooFastError();
        }

        const message = await saveMessage({ buildingId, userId: socket.data.userId, text: payload?.text });
        io.to(roomOf(buildingId)).emit("chat:message", message);
      } catch (error) {
        if (!error.code) {
          console.error(error); // a bug or a database problem: the details stay in the log
        }
        socket.emit("chat:error", {
          code: error.code || "SERVER_ERROR",
          message: error.code ? error.message : "Could not send the message",
        });
      }
    });
  });
}
