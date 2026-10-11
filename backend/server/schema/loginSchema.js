import { z } from "zod";

export const loginSchema = z.object({
  body: {
    email: z.string().trim().toLowerCase().email("Invalid email"),
    password: z.string().min(1, "You must enter a password."),
  },
});
