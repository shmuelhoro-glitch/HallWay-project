import { z } from "zod";

export const registerSchema = {
  body: z.object({
    username: z
      .string()
      .trim()
      .min(3, "Username must contain at least 3 characters")
      .max(30, "A username can contain up to 30 characters.")
      .regex(/^[a-zA-Z0-9_]+$/, "English letters, numbers, and underscores only."),
    email: z.string().trim().toLowerCase().email("Invalid email"),
    password: z
      .string()
      .min(8, "A password must contain at least 8 characters.")
      .max(72, "A password can contain up to 72 characters."),
    // No role here on purpose: everyone signs up as a visitor (a role that is sent is dropped)
  }),
};

// PUT /api/auth/favorites - the whole list of the user, as the client shows it.
// A place is saved with its name, category and floor, so the favorites screen needs no more requests.
export const updateFavoritesSchema = {
  body: z.object({
    favorites: z.object({
      buildings: z.array(z.string().uuid()).max(200),
      places: z
        .array(
          z.object({
            id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid place id"),
            buildingId: z.string().uuid(),
            name: z.string().trim().min(1).max(120),
            category: z.string().trim().max(60).nullish().transform((value) => value ?? ""),
            floor: z.number().int(),
          })
        )
        .max(500),
    }),
  }),
};
