import { ObjectId } from "mongodb"
import { mongoRepo } from "../repositories/mongoRepo.js"

const NODES_COLLECTION = "nodes"

function nodeNotFound(res) {
    return res.status(404).json({ error: { code: "NODE_NOT_FOUND", message: "Node not found" } })
}

export async function getNode(req, res, next) {
    try {
        const { nodeId } = req.params

        if (!ObjectId.isValid(nodeId)) {
            return nodeNotFound(res)
        }

        const node = await mongoRepo.findOne(NODES_COLLECTION, { _id: new ObjectId(nodeId) })

        if (!node) {
            return nodeNotFound(res)
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