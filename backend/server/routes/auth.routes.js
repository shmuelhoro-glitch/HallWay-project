import { validateRequest } from "../middleware/validation.js";
import { checkLoginRateLimit } from "../middleware/loginRateLimiter.js";
import { loginSchema } from "../schemas/login.schema.js";
import { login, register } from "../controllers/auth.controller.js";
import { registerSchema } from "../schemas/auth.schemas.js";

import { Router } from "express";

const router = Router()

router.post('/register', validateRequest(registerSchema), register)

router.post('/login', checkLoginRateLimit, validateRequest(loginSchema), login)


export default router