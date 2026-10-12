import { Router } from "express";
import { getQrCode } from "../controllers/qr.controller.js";

const router = Router({ mergeParams: true })

// Open to everyone: the picture is only a link to the building
router.get('/:nodeId', getQrCode)

export default router
