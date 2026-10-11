import { supabaseRepo } from "../repositories/sqlRepo.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

export async function register(req, res) {
    const {username, email, password, role} = req.body
    const find = await supabaseRepo.findOne("users", {email})
    if (find){
        return res.status(409).json({success: false, message: "email is exists"})
    }
    const hashPassword = await bcrypt.hash(password,14)
    const data = await supabaseRepo.insertOne("users", {username, email, hashPassword: hashPassword, role, buildingIds: [] })
    const token = jwt.sign({userId: data.id, role}, process.env.JWT_SECRET, {expiresIn: '1h'})
    res.status(201).send({token, user: {id: data.id, username, email, role, buildingIds: []}})
}


