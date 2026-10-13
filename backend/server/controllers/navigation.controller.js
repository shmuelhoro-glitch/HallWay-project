import { ObjectId } from "mongodb"
import { mongoRepo } from "../repositories/mongoRepo.js"
import { supabaseRepo } from "../repositories/sqlRepo.js"
import { callRoutingService } from "../services/routingClient.js"

// GET /api/navigation/nodes/:nodeId - where a QR code is (floor, x, y), for "You are here"
export async function getNode(req, res, next) {
    try {
        const { nodeId } = req.params

        if (!ObjectId.isValid(nodeId)) {
            throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" }
        }

        const node = await mongoRepo.findOne("nodes", { _id: new ObjectId(nodeId) })
        if (!node) {
            throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" }
        }

        res.json({
            id: node._id,
            buildingId: node.buildingId,
            floor: node.floor,
            x: node.x,
            y: node.y,
            label: node.label,
        })
    } catch (error) {
        next(error)
    }
}

// Every route that was found is saved for the analytics.
// If saving fails (for example, the table doesn't exist yet), the visitor still gets the route.
async function saveRouteRequest(buildingId, path) {
    try {
        await supabaseRepo.insertOne("route_requests", {
            building_id: buildingId,
            from_node: path[0].id,
            to_node: path[path.length - 1].id,
            path: path.map((node) => node.id),
            search_query: null,
        })
    } catch (error) {
        console.error("Could not save route request:", error.message)
    }
}

// POST /api/navigation/route  { buildingId, fromNodeId, toPlaceId } or { buildingId, fromNodeId, toNodeId }
export async function getRoute(req, res, next) {
    try {
        const { buildingId, fromNodeId, toPlaceId, accessible } = req.body
        let toNodeId = req.body.toNodeId

        // Going to a place = going to its entrance node
        if (toPlaceId) {
            const place = await mongoRepo.findOne("places", { _id: new ObjectId(toPlaceId), buildingId })
            if (!place || !place.entryNodeId) {
                throw { status: 404, code: "PLACE_NOT_FOUND", message: "Place not found" }
            }
            toNodeId = place.entryNodeId
        }

        const result = await callRoutingService("/route", {
            buildingId,
            fromNodeId,
            toNodeId,
            accessible: Boolean(accessible),
        })

        if (!result.path) {
            throw { status: 404, code: "NO_ROUTE", message: "No route found" }
        }

        await saveRouteRequest(buildingId, result.path)
        res.json(result)
    } catch (error) {
        next(error)
    }
}

// POST /api/navigation/nearest-shelter  { buildingId, fromNodeId }
export async function getNearestShelter(req, res, next) {
    try {
        const { buildingId, fromNodeId, accessible } = req.body

        const result = await callRoutingService("/nearest-shelter", {
            buildingId,
            fromNodeId,
            accessible: Boolean(accessible),
        })

        if (!result.path) {
            throw { status: 404, code: "NO_ROUTE", message: "No route found" }
        }

        await saveRouteRequest(buildingId, result.path)
        res.json(result)
    } catch (error) {
        next(error)
    }
}
