import { z } from "zod";

// A visitor asks to become a building manager. We (the owners) read the request and,
// if we approve it, his role becomes admin.

export const createOwnerRequestSchema = {
  body: z.object({
    full_name: z.string().trim().min(2, "Full name is required").max(80),
    // Optional. An empty text is saved as "no phone".
    phone: z.union([z.string().trim().regex(/^[0-9+\-() ]{7,20}$/, "Invalid phone number"), z.literal("")]).optional(),
    building_name: z.string().trim().min(2, "Building name is required").max(80),
    building_type: z.enum(["mall", "hospital", "campus", "office", "other"]),
    city: z.string().trim().min(2, "City is required").max(60),
    message: z.string().trim().max(500).optional(),
  }),
};

// new - waiting for us. handled - we answered it (approved or not).
export const updateOwnerRequestSchema = {
  params: z.object({
    requestId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.enum(["new", "handled"]),
  }),
};

export const approveOwnerRequestSchema = {
  params: z.object({
    requestId: z.coerce.number().int().positive(),
  }),
};
