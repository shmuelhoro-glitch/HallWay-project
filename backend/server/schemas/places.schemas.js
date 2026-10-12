import { z } from "zod";

// The fields of a place. hours and url may be sent empty ("") - that removes them.
const placeFields = {
  floor: z.coerce.number().int(),
  name: z.string().trim().min(1, "Name is required").max(60),
  type: z.enum(["store", "service", "shelter"]),
  category: z.string().trim().min(1, "Category is required").max(40),
  x: z.number(),
  y: z.number(),
  hours: z.string().trim().max(80).optional(),
  url: z.union([z.string().trim().url("Invalid link"), z.literal("")]).optional(),
  isLandmark: z.boolean(),
};

// Create: everything except hours and url is required. isLandmark is false when not sent.
export const createPlaceSchema = {
  body: z.object({
    ...placeFields,
    isLandmark: z.boolean().default(false),
  }),
};

// Update: send only what changed.
// (Built without the default on purpose - a default here would reset isLandmark on every update.)
export const updatePlaceSchema = {
  body: z.object(placeFields).partial(),
};
