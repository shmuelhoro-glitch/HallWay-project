import { z } from "zod";

// A MongoDB id is always 24 hex characters
const mongoId = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");

export const routeSchema = {
  body: z
    .object({
      buildingId: z.string().uuid(),
      fromNodeId: mongoId,
      toPlaceId: mongoId.optional(),
      toNodeId: mongoId.optional(),
      accessible: z.boolean().default(false),
    })
    .refine((body) => body.toPlaceId || body.toNodeId, "toPlaceId or toNodeId is required"),
};

export const shelterSchema = {
  body: z.object({
    buildingId: z.string().uuid(),
    fromNodeId: mongoId,
    accessible: z.boolean().default(false),
  }),
};
