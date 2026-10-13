import { Router } from "express";
import { verifyToken, requireSuper } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import {
  approveOwnerRequestSchema,
  createOwnerRequestSchema,
  updateOwnerRequestSchema,
} from "../schemas/ownerRequests.schemas.js";
import {
  approveOwnerRequest,
  createOwnerRequest,
  getMyOwnerRequest,
  getOwnerRequests,
  updateOwnerRequest,
} from "../controllers/ownerRequests.controller.js";

const router = Router()

// Every route here needs a logged-in user
router.use(verifyToken)

router.post('/', validateRequest(createOwnerRequestSchema), createOwnerRequest)

router.get('/mine', getMyOwnerRequest)

// Only us, the owners of the system
router.get('/', requireSuper, getOwnerRequests)

router.patch('/:requestId', requireSuper, validateRequest(updateOwnerRequestSchema), updateOwnerRequest)

router.post('/:requestId/approve', requireSuper, validateRequest(approveOwnerRequestSchema), approveOwnerRequest)

export default router
