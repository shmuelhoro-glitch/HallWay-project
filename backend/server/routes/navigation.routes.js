import { Router } from "express";
import {getNode} from "../controllers/navigation.controller.js"

const router = Router()


router.get('/nodes/:nodeId', getNode);

// router.post('/route')

// router.post('/nearest-shelter')


export default router