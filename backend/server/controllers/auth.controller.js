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


export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const exists = await supabaseRepo.findOne("users", { email });
    if (!exists) {
      return res.status(401).json({success: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, exists.hashPassword);

    if (!isMatch) {
      return res.status(401).json({success: false, message: "Invalid email or password" })
    }

    const token = jwt.sign(
      { userId: exists.id, role: exists.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.status(200).json({success: true,
      token,
      user: {
        id: exists.id,
        username: exists.username,
        email: exists.email,
        role: exists.role,
        buildingIds: exists.buildingIds,
      },
    });
  } catch (error) {
    next(error);
  }
}
