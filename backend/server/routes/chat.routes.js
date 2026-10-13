import { Router } from "express";
import { getMessages } from "../controllers/chat.controller.js";

const router = Router({mergeParams:true})

// Open to everyone: reading the chat does not need an account.
// Writing goes through Socket.IO (sockets/chat.socket.js).
router.get('/messages', getMessages)

// router.delete('/messages/:messageId')

// router.post('/bans')


export default router
