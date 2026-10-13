import { validateRequest } from "../middleware/validation.js";
import { checkLoginRateLimit } from "../middleware/loginRateLimiter.js";
import { verifyToken } from "../middleware/authentication.js";
import { loginSchema } from "../schemas/login.schema.js";
import { getFavorites, login, register, updateFavorites } from "../controllers/auth.controller.js";
import { registerSchema, updateFavoritesSchema } from "../schemas/auth.schemas.js";

import { Router } from "express";

const router = Router()

router.post('/register', validateRequest(registerSchema), register)

// The limit is checked after the validation: it counts by the email, and needs a real one
router.post('/login', validateRequest(loginSchema), checkLoginRateLimit, login)

router.get('/favorites', verifyToken, getFavorites)

router.put('/favorites', verifyToken, validateRequest(updateFavoritesSchema), updateFavorites)

export default router