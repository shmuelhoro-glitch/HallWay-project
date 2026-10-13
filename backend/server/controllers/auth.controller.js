import { supabaseRepo } from "../repositories/sqlRepo.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { recordFailedAttempt, resetFailedAttempts, getClientIp } from "../middleware/loginRateLimiter.js"

// The same token in register and login: { userId, role }
function createToken(userId, role) {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "24h" })
}

export async function register(req, res, next) {
    try {
        const { username, email, password } = req.body

        // Everyone signs up as a visitor. A building manager is added by us, by hand, in the users table.
        const role = "visitor"

        const emailOwner = await supabaseRepo.findOne("users", { email })
        if (emailOwner) {
            throw { status: 409, code: "EMAIL_TAKEN", message: "Email is already registered" }
        }

        const usernameOwner = await supabaseRepo.findOne("users", { username })
        if (usernameOwner) {
            throw { status: 409, code: "USERNAME_TAKEN", message: "Username is taken" }
        }

        // 10 rounds, like the seed script. More rounds = much slower on the free cloud server.
        const hashPassword = await bcrypt.hash(password, 10)
        const initialFavorites = { buildings: [], places: [] }
        const data = await supabaseRepo.insertOne("users", {
            username,
            email,
            hashPassword,
            role,
            buildingIds: [],
            favorites: initialFavorites,
        })

        const token = createToken(data.id, role)
        res.status(201).json({
            token,
            user: {
                id: data.id,
                username,
                email,
                role,
                buildingIds: [],
                favorites: initialFavorites,
            },
        })
    } catch (error) {
        next(error)
    }
}

export async function login(req, res, next) {
    try {
        const { email, password } = req.body
        const clientIp = getClientIp(req)

        // The same answer for "no such user" and "wrong password", so nobody can check who is registered
        const user = await supabaseRepo.findOne("users", { email })
        if (!user) {
            recordFailedAttempt(clientIp)
            throw { status: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" }
        }

        const isMatch = await bcrypt.compare(password, user.hashPassword)
        if (!isMatch) {
            recordFailedAttempt(clientIp)
            throw { status: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" }
        }

        resetFailedAttempts(clientIp)

        const token = createToken(user.id, user.role)

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                buildingIds: user.buildingIds,
                favorites: user.favorites || { buildings: [], places: [] },
            },
        })
    } catch (error) {
        next(error)
    }
}

export async function getFavorites(req, res, next) {
    try {
        const user = await supabaseRepo.findOne("users", { id: req.user.userId })
        if (!user) {
            throw { status: 404, code: "USER_NOT_FOUND", message: "User not found" }
        }
        res.json({ favorites: user.favorites || { buildings: [], places: [] } })
    } catch (error) {
        next(error)
    }
}

export async function updateFavorites(req, res, next) {
    try {
        const { favorites } = req.body
        if (!favorites || typeof favorites !== "object") {
            throw { status: 400, code: "INVALID_FAVORITES", message: "Favorites object is required" }
        }

        const cleanFavorites = {
            buildings: Array.isArray(favorites.buildings) ? favorites.buildings : [],
            places: Array.isArray(favorites.places) ? favorites.places : [],
        }

        await supabaseRepo.updateOne(
            "users",
            { id: req.user.userId },
            { favorites: cleanFavorites }
        )

        res.json({ success: true, favorites: cleanFavorites })
    } catch (error) {
        next(error)
    }
}
