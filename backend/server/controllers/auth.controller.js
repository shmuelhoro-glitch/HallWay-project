import { supabaseRepo } from "../repositories/sqlRepo.js";

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const exists = await supabaseRepo.findOne("users", { email });
    if (!exists) {
      return next(
        res.status(401).json({ message: "Invalid email or password" }),
      );
    }

    const isMatch = await bcrypt.compare(password, exists.password);

    if (!isMatch) {
      return next(
        res.status(401).json({ message: "Invalid email or password" }),
      );
    }

    const token = jwt.sign(
      { id: exists.id, role: exists.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.status(200).json({
      token,
      user: {
        id: exists.id,
        userName: exists.userName,
        role: exists.role,
        buildingIds: exists.buildingIds,
      },
    });
  } catch (error) {
    next(error);
  }
}
