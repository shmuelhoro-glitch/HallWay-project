import jwt from "jsonwebtoken"

export function verifyToken(req, res, next){
    const auth = req.headers.authorization

    if(!auth || !auth.startsWith("Bearer")){
        return res.status(401).json({success: false, message: "missing token!!!"})
    }

    const token = auth.split(" ")[1]

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()
    } catch (error) {
        res.status(403).json({success: false, message: "Invalid token"})
    }
}

export function requireRole(allowedRoles){
    return (req, res, next) => {
        if(!req.uset || !req.allowedRoles.includes(req.user.role)){
            return res.status(403).json({ error: "Access denied. Insufficient permissions." });
        }
        next()
    }
}