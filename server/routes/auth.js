import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { signToken } from "../auth.js";

const router = Router();

// ─── Email / Password Signup ─────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.rows.length) return res.status(409).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, avatar_url",
      [email.toLowerCase().trim(), hash, name || null]
    );
    const user = result.rows[0];
    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url } });
  } catch (err) {
    console.error("signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// ─── Email / Password Login ──────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url } });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── Google OAuth ────────────────────────────────────────────
// Step 1: redirect to Google
router.get("/google", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "Google OAuth not configured" });

  const redirect = `${process.env.APP_URL || ""}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  res.redirect(url.toString());
});

// Step 2: exchange code for user info
router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Missing code");

    const redirect = `${process.env.APP_URL || ""}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token from Google");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    // Upsert user
    let result = await pool.query("SELECT * FROM users WHERE google_id = $1", [profile.id]);
    let user;
    if (result.rows.length) {
      user = result.rows[0];
      // Update name/avatar if changed
      await pool.query("UPDATE users SET name = $1, avatar_url = $2 WHERE id = $3",
        [profile.name, profile.picture, user.id]);
    } else {
      // Check if email already exists (signed up with password)
      result = await pool.query("SELECT * FROM users WHERE email = $1", [profile.email]);
      if (result.rows.length) {
        user = result.rows[0];
        await pool.query("UPDATE users SET google_id = $1, name = COALESCE(name, $2), avatar_url = COALESCE(avatar_url, $3) WHERE id = $4",
          [profile.id, profile.name, profile.picture, user.id]);
      } else {
        result = await pool.query(
          "INSERT INTO users (email, google_id, name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *",
          [profile.email, profile.id, profile.name, profile.picture]
        );
        user = result.rows[0];
      }
    }

    const token = signToken(user.id);
    // Return an HTML page that sends the token to the parent window
    res.send(`<!DOCTYPE html><html><body><script>
      window.opener?.postMessage({ type:"wearcast-auth", token:"${token}", user: ${JSON.stringify({
        id: user.id, email: user.email, name: user.name || profile.name, avatarUrl: user.avatar_url || profile.picture,
      })} }, "*");
      window.close();
    </script></body></html>`);
  } catch (err) {
    console.error("google callback error:", err);
    res.status(500).send("Google authentication failed. Close this window and try again.");
  }
});

// ─── Get current user ────────────────────────────────────────
router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });

  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(header.slice(7), process.env.JWT_SECRET || "dev-secret-change-me");
    const result = await pool.query("SELECT id, email, name, avatar_url FROM users WHERE id = $1", [payload.uid]);
    if (!result.rows.length) return res.status(401).json({ error: "User not found" });
    const u = result.rows[0];
    res.json({ user: { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatar_url } });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
