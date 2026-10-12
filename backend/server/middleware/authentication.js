import jwt from "jsonwebtoken"

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
