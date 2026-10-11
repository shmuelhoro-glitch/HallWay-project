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
    role: z.enum(["visitor", "admin"], { message: "תפקיד לא חוקי" }).default("visitor"),
  }),
};
