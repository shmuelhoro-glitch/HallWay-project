import { z } from "zod";

export const simulateAlertSchema = {
  body: z.object({
    buildingId: z.string().uuid("Invalid building ID format"),
    title: z.string().trim().optional().default("ירי רקטות וטילים"),
    category: z.string().trim().optional().default("rockets"),
    countdown: z.coerce.number().int().min(5).max(600).optional().default(60),
  }),
};

export const stopAlertSchema = {
  body: z.object({
    buildingId: z.string().uuid("Invalid building ID format"),
  }),
};

export const activeAlertSchema = {
  params: z.object({
    buildingId: z.string().uuid("Invalid building ID format"),
  }),
};
