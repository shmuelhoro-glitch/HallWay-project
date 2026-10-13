import { Router } from "express";
import { z } from "zod";
import { verifyToken, requireBuildingAccess } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import {
  addBan,
  getMessages,
  listBans,
  removeBan,
  removeMessage,
  sendMessage,
} from "../controllers/chat.controller.js";

const router = Router({mergeParams:true})

// The length and the content of a message are checked in chat.service (the socket uses the same check)
const sendMessageSchema = { body: z.object({ text: z.string() }) };
const banSchema = { body: z.object({ userId: z.string().uuid() }) };

// Only the managers of this building delete messages and block users
const moderatorOnly = [verifyToken, requireBuildingAccess]

// Open to everyone: reading the chat does not need an account
router.get('/messages', getMessages)

// Writing usually goes through Socket.IO (sockets/chat.socket.js). This is the same thing as a route.
router.post('/messages', verifyToken, validateRequest(sendMessageSchema), sendMessage)

router.delete('/messages/:messageId', moderatorOnly, removeMessage)

router.get('/bans', moderatorOnly, listBans)

router.post('/bans', moderatorOnly, validateRequest(banSchema), addBan)

router.delete('/bans/:userId', moderatorOnly, removeBan)

export default router
