import { Router } from "express";
import { validateRequest } from "../middleware/validation.js";
import { registerSchema } from "../schemas/auth.schemas.js";
import { register } from "../controllers/auth.controller.js";

const router = Router()

router.post('/register' ,validateRequest(registerSchema), register)


// router.post('/login')


export default router