import { supabaseRepo } from "../repositories/sqlRepo.js";

import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

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
      { id: exists.id, role: exists.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.status(200).json({success: true,
      token,
      user: {
        id: exists.id,
        username: exists.userName,
        role: exists.role,
        buildingIds: exists.buildingIds,
      },
    });
  } catch (error) {
    next(error);
  }
}
