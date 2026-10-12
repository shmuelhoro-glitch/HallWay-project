import { supabaseRepo } from "../repositories/sqlRepo.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

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
        const data = await supabaseRepo.insertOne("users", { username, email, hashPassword, role, buildingIds: [] })

        const token = createToken(data.id, role)
        res.status(201).json({ token, user: { id: data.id, username, email, role, buildingIds: [] } })
    } catch (error) {
        next(error)
    }
}

export async function login(req, res, next) {
    try {
        const { email, password } = req.body

        // The same answer for "no such user" and "wrong password", so nobody can check who is registered
        const user = await supabaseRepo.findOne("users", { email })
        if (!user) {
            throw { status: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" }
        }

        const isMatch = await bcrypt.compare(password, user.hashPassword)
        if (!isMatch) {
            throw { status: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" }
        }

        const token = createToken(user.id, user.role)

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                buildingIds: user.buildingIds,
            },
        })
    } catch (error) {
        next(error)
    }
}
