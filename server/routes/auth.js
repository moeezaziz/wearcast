import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { issueAuthSession, requireAuth, revokeAllRefreshTokensForUser, revokeRefreshToken, rotateRefreshToken } from "../auth.js";

const router = Router();
const APP_URL = process.env.APP_URL || "https://wearcast.fly.dev";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "WearCast <onboarding@resend.dev>";

function encodeOAuthState(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeOAuthState(state) {
  if (!state || typeof state !== "string") return {};
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function normalizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    emailVerified: user.email_verified !== false,
    authProvider: user.google_id ? "google" : "password",
  };
}

function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing; verification link:", verifyUrl);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email],
      subject: "Verify your WearCast account",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0a1628">
          <h1 style="font-size:24px;margin:0 0 12px">Confirm your email</h1>
          <p style="font-size:16px;line-height:1.6;margin:0 0 20px">Tap the button below to verify your WearCast account and start syncing your wardrobe.</p>
          <p style="margin:0 0 24px">
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#2979ff;color:#fff;text-decoration:none;font-weight:700">Verify email</a>
          </p>
          <p style="font-size:13px;line-height:1.6;color:#5d6b86">If the button does not work, open this link:<br /><a href="${verifyUrl}">${verifyUrl}</a></p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${text}`);
  }
}

// ─── Email / Password Signup ─────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    console.info("[POST] /api/auth/signup - body:", { email, name });
    if (!email || !password) {
      console.warn("/api/auth/signup: Email and password required");
      return res.status(400).json({ error: "Email and password required" });
    }
    if (password.length < 6) {
      console.warn("/api/auth/signup: Password too short");
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.rows.length) {
      console.warn("/api/auth/signup: Email already registered");
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 12);
    const { token, hash: verificationHash } = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, email_verified, verification_token_hash, verification_expires_at)
       VALUES ($1, $2, $3, FALSE, $4, $5)
       RETURNING id, email, name, avatar_url, email_verified, google_id`,
      [email.toLowerCase().trim(), hash, name || null, verificationHash, expiresAt]
    );
    const user = result.rows[0];
    await sendVerificationEmail(user.email, token);
    console.info("/api/auth/signup: user created", user.id);
    res.status(201).json({
      requiresVerification: true,
      message: "Check your email to verify your account before signing in.",
      user: normalizeUser(user),
    });
  } catch (err) {
    console.error("signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// ─── Email / Password Login ──────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.info("[POST] /api/auth/login - body:", { email });
    if (!email || !password) {
      console.warn("/api/auth/login: Email and password required");
      return res.status(400).json({ error: "Email and password required" });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user || !user.password_hash) {
      console.warn("/api/auth/login: Invalid email or password");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      console.warn("/api/auth/login: Invalid password");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.email_verified === false) {
      return res.status(403).json({
        error: "Verify your email before signing in.",
        requiresVerification: true,
      });
    }

    const session = await issueAuthSession(user.id);
    console.info("/api/auth/login: user logged in", user.id);
    res.json({ token: session.accessToken, refreshToken: session.refreshToken, user: normalizeUser(user) });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── Google OAuth ────────────────────────────────────────────
// Step 1: redirect to Google
router.get("/google", (req, res) => {
  // Support client_id and redirect_uri as query params for multi-platform
  const clientId = req.query.client_id || process.env.GOOGLE_CLIENT_ID;
  const redirect = req.query.redirect_uri || `${process.env.APP_URL || ""}/api/auth/google/callback`;
  const platform = req.query.platform === "native" ? "native" : "web";
  const state = encodeOAuthState({ clientId, redirectUri: redirect, platform });
  console.info("[GET] /api/auth/google - clientId:", clientId, "redirect:", redirect);
  if (!clientId || !redirect) {
    console.warn("/api/auth/google: Missing client_id or redirect_uri");
    return res.status(400).json({ error: "Missing client_id or redirect_uri" });
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

// Step 2: exchange code for user info
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const stateData = decodeOAuthState(state);
    const redirect = req.query.redirect_uri || stateData.redirectUri || "https://wearcast.fly.dev/oauth2redirect/google";
    const clientId = req.query.client_id || stateData.clientId || process.env.GOOGLE_CLIENT_ID || "263164817169-ft9s72dno3i766j00dtvogaj8bmckec5.apps.googleusercontent.com";
    const responseMode = req.query.response_mode || "html";

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }
    if (!clientId || !redirect) {
      return res.status(400).json({ error: "Missing OAuth client configuration" });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("/api/auth/google/callback: No access token from Google", tokenData);
      throw new Error("No access token from Google");
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    console.info("/api/auth/google/callback: Google profile", profile);

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

    const session = await issueAuthSession(user.id);
    const responseUser = {
      ...normalizeUser({
        ...user,
        email_verified: true,
        avatar_url: user.avatar_url || profile.picture,
        name: user.name || profile.name,
      }),
    };
    console.info("/api/auth/google/callback: user id", user.id);

    if (responseMode === "json") {
      return res.json({ token: session.accessToken, refreshToken: session.refreshToken, user: responseUser });
    }

    // If redirect_uri is a custom scheme (iOS), redirect to it with token
    if (redirect.startsWith("com.wearcast-beta.app:")) {
      const url = `${redirect}?token=${encodeURIComponent(session.accessToken)}&refresh_token=${encodeURIComponent(session.refreshToken)}`;
      console.info("/api/auth/google/callback: redirecting to", url);
      return res.redirect(url);
    }

    // Otherwise, return an HTML page that sends the token to the parent window (web)
    res.send(`<!DOCTYPE html><html><body><script>
      window.opener?.postMessage({ type:"wearcast-auth", token:"${session.accessToken}", refreshToken:"${session.refreshToken}", user: ${JSON.stringify({
        id: responseUser.id, email: responseUser.email, name: responseUser.name, avatarUrl: responseUser.avatarUrl, emailVerified: responseUser.emailVerified, authProvider: responseUser.authProvider,
      })} }, "*");
      window.close();
    </script></body></html>`);
  } catch (err) {
    console.error("google callback error:", err);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

// ─── Get current user ────────────────────────────────────────
router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    console.warn("/api/auth/me: Not authenticated");
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(header.slice(7), process.env.JWT_SECRET || "dev-secret-change-me");
    const result = await pool.query("SELECT id, email, name, avatar_url, email_verified, google_id FROM users WHERE id = $1", [payload.uid]);
    if (!result.rows.length) {
      console.warn("/api/auth/me: User not found", payload.uid);
      return res.status(401).json({ error: "User not found" });
    }
    const u = result.rows[0];
    console.info("/api/auth/me: returning user", u.id);
    res.json({ user: normalizeUser(u) });
  } catch (err) {
    console.error("/api/auth/me: Invalid token", err);
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || "");
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const rotated = await rotateRefreshToken(refreshToken);
    const result = await pool.query(
      "SELECT id, email, name, avatar_url, email_verified, google_id FROM users WHERE id = $1",
      [rotated.userId]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    const session = await issueAuthSession(user.id);
    res.json({
      token: session.accessToken,
      refreshToken: session.refreshToken,
      user: normalizeUser(user),
    });
  } catch (err) {
    console.error("refresh token error:", err);
    res.status(401).json({ error: "Session expired. Please sign in again." });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    const refreshToken = String(req.body?.refreshToken || "");
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    } else {
      await revokeAllRefreshTokensForUser(req.userId);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("logout error:", err);
    res.status(500).json({ error: "Could not log out" });
  }
});

router.get("/verify-email", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) {
      return res.status(400).send("Verification link is invalid.");
    }

    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const result = await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           verification_token_hash = NULL,
           verification_expires_at = NULL
       WHERE verification_token_hash = $1
         AND verification_expires_at > NOW()
       RETURNING id`,
      [hash]
    );

    if (!result.rows.length) {
      return res.status(400).send("This verification link is invalid or expired.");
    }

    res.send(`<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f0f7ff;padding:32px;color:#0a1628"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;padding:28px;box-shadow:0 12px 30px rgba(10,22,40,.08)"><h1 style="margin:0 0 12px">Email verified</h1><p style="line-height:1.6;margin:0 0 20px">Your WearCast account is ready. You can return to the app and sign in now.</p><a href="${APP_URL}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#2979ff;color:#fff;text-decoration:none;font-weight:700">Open WearCast</a></div></body></html>`);
  } catch (err) {
    console.error("verify email error:", err);
    res.status(500).send("Could not verify email.");
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "Email required" });

    const result = await pool.query(
      "SELECT id, email, email_verified FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.json({ ok: true });
    if (user.email_verified) return res.json({ ok: true });

    const { token, hash } = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await pool.query(
      "UPDATE users SET verification_token_hash = $1, verification_expires_at = $2 WHERE id = $3",
      [hash, expiresAt, user.id]
    );
    await sendVerificationEmail(user.email, token);
    res.json({ ok: true });
  } catch (err) {
    console.error("resend verification error:", err);
    res.status(500).json({ error: "Could not resend verification email" });
  }
});

router.delete("/account", requireAuth, async (req, res) => {
  try {
    const { password, confirmText } = req.body || {};
    const result = await pool.query(
      "SELECT id, email, password_hash, google_id FROM users WHERE id = $1",
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.password_hash) {
      if (!password) return res.status(400).json({ error: "Password required to delete account" });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: "Incorrect password" });
    } else if (String(confirmText || "").trim().toUpperCase() !== "DELETE") {
      return res.status(400).json({ error: 'Type DELETE to confirm account removal' });
    }

    await revokeAllRefreshTokensForUser(req.userId);
    await pool.query("DELETE FROM users WHERE id = $1", [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("delete account error:", err);
    res.status(500).json({ error: "Could not delete account" });
  }
});

export default router;
