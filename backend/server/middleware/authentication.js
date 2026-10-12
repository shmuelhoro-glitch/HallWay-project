import jwt from "jsonwebtoken"
import { supabaseRepo } from "../repositories/sqlRepo.js"

// visitor - a regular user. Everyone who signs up.
// admin   - manages the buildings in his buildingIds.
// super   - us, the owners of the system. Manages every building.
// A visitor becomes an admin only by hand, in the users table.
const MANAGER_ROLES = ["admin", "super"]

// Reads "Authorization: Bearer <token>". After it, req.user is { userId, role }.
export function verifyToken(req, res, next) {
    const auth = req.headers.authorization

    if (!auth || !auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: { code: "NO_TOKEN", message: "Please log in" } })
    }

    const token = auth.split(" ")[1]

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET)
        next()
    } catch {
        // Expired or fake token. The client logs the user out when it gets this code.
        return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Please log in again" } })
    }
}

// requireRole(["admin"]) - only these roles may continue
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "You are not allowed to do this" } })
        }
        next()
    }
}

function forbidden(res) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You are not allowed to do this" } })
}

// The user as he is in the database right now, or null when he is not a manager.
// We don't trust the role in the token: it stays the same for 24 hours, and a manager
// that we added or removed by hand must count right away.
async function findManager(userId) {
    const user = await supabaseRepo.findOne("users", { id: userId })
    if (!user || !MANAGER_ROLES.includes(user.role)) {
        return null
    }
    return { userId: user.id, role: user.role, buildingIds: user.buildingIds ?? [] }
}

export function canManageBuilding(user, buildingId) {
    return user.role === "super" || user.buildingIds.includes(buildingId)
}

// After verifyToken. Only an admin or a super may continue.
// After it, req.user is { userId, role, buildingIds }, from the database.
export async function requireManager(req, res, next) {
    try {
        const manager = await findManager(req.user.userId)
        if (!manager) {
            return forbidden(res)
        }
        req.user = manager
        next()
    } catch (error) {
        next(error)
    }
}

// After verifyToken, on a path with :buildingId.
// Only a manager of this building (or a super) may continue.
export async function requireBuildingAccess(req, res, next) {
    try {
        const manager = await findManager(req.user.userId)
        if (!manager || !canManageBuilding(manager, req.params.buildingId)) {
            return forbidden(res)
        }
        req.user = manager
        next()
    } catch (error) {
        next(error)
    }
}
