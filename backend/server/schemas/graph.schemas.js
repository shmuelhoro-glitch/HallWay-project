import { z } from "zod";

// corridor - a point on a walkway
// entrance - the door of a place (created together with the place)
// stairs / elevator - moves between floors. Nodes with the same connectorId are connected.
// qr - a point with a printed QR code, so a visitor can scan "You are here"
export const NODE_TYPES = ["corridor", "entrance", "stairs", "elevator", "qr"];

const mongoId = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");

// GET /graph?floor=0  (without floor: the whole building)
export const graphQuerySchema = {
  query: z.object({
    floor: z.coerce.number().int().optional(),
  }),
};

export const createNodeSchema = {
  body: z.object({
    floor: z.coerce.number().int(),
    x: z.number(),
    y: z.number(),
    type: z.enum(NODE_TYPES).default("corridor"),
    connectorId: z.string().trim().max(40).optional(),
    label: z.string().trim().max(60).optional(),
    // Draw mode: the point before this one. The new point is saved together with a walkway to it.
    connectFrom: mongoId.optional(),
  }),
};

// Send only what changed. An empty connectorId / label ("") removes it.
export const updateNodeSchema = {
  body: z
    .object({
      x: z.number(),
      y: z.number(),
      type: z.enum(NODE_TYPES),
      connectorId: z.string().trim().max(40),
      label: z.string().trim().max(60),
    })
    .partial(),
};

export const createEdgeSchema = {
  body: z.object({
    from: mongoId,
    to: mongoId,
  }),
};

export const updateEdgeSchema = {
  body: z.object({
    blocked: z.boolean(),
  }),
};
