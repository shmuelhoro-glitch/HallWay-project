import { validateRequest } from "../middleware/validation.js";
import { loginSchema } from "../schema/loginSchema.js";
import { login } from "../controllers/auth.controller.js";

import { Router } from "express";

const router = Router()

// router.post('/register')

router.post('/login', validateRequest(loginSchema), login)


export default router