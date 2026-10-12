import { z } from "zod";

const placeBody = z.object({
  floor: z.coerce.number().int(),
  name: z.string().trim().min(1).max(60),
  type: z.enum(["store", "service", "shelter"]),
  category: z.string().trim().min(1).max(40),
  x: z.number(),
  y: z.number(),
  hours: z.string().trim().max(80).optional(),
  url: z.string().url().optional(),
  isLandmark: z.boolean().default(false),
});

export const createPlaceSchema = { body: placeBody };
export const updatePlaceSchema = { body: placeBody.partial() };
