import { z } from "zod";

export const createBuildingSchema = {
  body: z.object({
    name: z
      .string({ required_error: "Building name is required" })
      .trim()
      .min(2, "Building name must be at least 2 characters"),

    type: z.enum(["mall", "hospital", "campus", "office", "other"], {
      errorMap: () => ({
        message: "Invalid building type. Must be mall, hospital, campus, office, or other",
      }),
    }),

    address: z
      .string({ required_error: "Address is required" })
      .trim()
      .min(2, "Address must be at least 2 characters"),

    city: z
      .string({ required_error: "City is required" })
      .trim()
      .min(2, "City must be at least 2 characters"),

    alert_area: z
      .string({ required_error: "Alert area is required" })
      .trim()
      .min(1, "Alert area cannot be empty"),

    floors_count: z.coerce
      .number({ invalid_type_error: "Floors count must be a number" })
      .int("Floors count must be an integer")
      .min(1, "Building must have at least 1 floor"),

    // Optional: the spot the admin confirmed (or fixed) on the map.
    // Without them the server finds the spot from the address by itself.
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
};

// POST /api/buildings/geocode - where is this address on the map?
export const geocodeSchema = {
  body: z.object({
    address: z.string().trim().min(2, "Address must be at least 2 characters"),
    city: z.string().trim().min(2, "City must be at least 2 characters"),
  }),
};

export const deleteBuildingSchema = {
  params: z.object({
    buildingId: z.string().uuid("Invalid building ID format"),
  }),
};

export const addFloorSchema = {
  params: z.object({
    buildingId: z.string().uuid("Invalid building ID format"),
  }),
  body: z.object({
    floor: z.coerce
      .number({ invalid_type_error: "Floor must be a number" })
      .int("Floor must be an integer"),

    name: z
      .string()
      .trim()
      .max(50, "Floor name cannot exceed 50 characters")
      .default(""),

    svg: z
      .string({ required_error: "SVG content is required" })
      .min(1, "SVG content cannot be empty"),
  }),
};