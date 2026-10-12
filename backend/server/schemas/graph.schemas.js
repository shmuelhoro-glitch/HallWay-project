import { z } from "zod";

const nodeTypes = ["corridor", "entrance", "stairs", "elevator", "qr"];

// 1. ולידציה לשליפת גרף לפי קומה: GET /?floor=0
export const getGraphSchema = {
  query: z.object({
    floor: z.coerce.number().int(),
  }),
};

// 2. ולידציה ליצירת צומת: POST /nodes
export const createNodeSchema = {
  body: z
    .object({
      floor: z.coerce.number().int(),
      x: z.number(),
      y: z.number(),
      type: z.enum(nodeTypes),
      connectorId: z.string().trim().min(1).nullable().optional(),
      label: z.string().trim().max(60).nullable().optional(),
    })
    .refine(
      (data) => {
        if (data.type === "stairs" || data.type === "elevator") {
          return Boolean(data.connectorId && data.connectorId.trim().length > 0);
        }
        return true;
      },
      {
        message: "connectorId is required for stairs and elevator nodes",
        path: ["connectorId"],
      }
    ),
};

// 3. ולידציה לעדכון צומת: PUT /nodes/:nodeId
export const updateNodeSchema = {
  body: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    type: z.enum(nodeTypes).optional(),
    connectorId: z.string().trim().min(1).nullable().optional(),
    label: z.string().trim().max(60).nullable().optional(),
  }),
};

// 4. ולידציה ליצירת קשת: POST /edges
export const createEdgeSchema = {
  body: z.object({
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
  }),
};

// 5. ולידציה לחסימה/פתיחה של קשת: PATCH /edges/:edgeId
export const patchEdgeSchema = {
  body: z.object({
    blocked: z.boolean(),
  }),
};