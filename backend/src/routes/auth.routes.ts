import { Router } from "express";
import { query } from "../db";
import { hashPassword, verifyPassword, signAccessToken } from "../auth";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await hashPassword(password);

    const result = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, passwordHash, name ?? null]
    );

    const userId = result.rows[0].id;
    const token = signAccessToken({ userId });

    return res.status(201).json({ token });
  } catch (err) {
    console.error("Register error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signAccessToken({ userId: user.id });
    return res.json({ token });
  } catch (err) {
    console.error("Login error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;