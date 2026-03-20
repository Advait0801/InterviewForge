import { Router } from "express";
import { query } from "../db";
import { hashPassword, verifyPassword, signAccessToken } from "../auth";

const router = Router();

router.post("/register", async (req, res) => {
  const { username, email, password, fullName } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    fullName?: string;
  };

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required" });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3-20 characters (letters, numbers, underscore)" });
  }

  try {
    const existingEmail = await query<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const existingUsername = await query<{ id: string }>(
      "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    if (existingUsername.rows.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const passwordHash = await hashPassword(password);

    const result = await query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [username, email, passwordHash, fullName ?? null]
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
  const { identifier, password } = req.body as { identifier?: string; password?: string };

  if (!identifier || !password) {
    return res.status(400).json({ error: "Email/username and password are required" });
  }

  try {
    const isEmail = identifier.includes("@");
    const result = await query<{ id: string; password_hash: string }>(
      isEmail
        ? "SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER($1)"
        : "SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER($1)",
      [identifier]
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
