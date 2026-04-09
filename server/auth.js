import jwt from "jsonwebtoken";
import crypto from "crypto";
import pool from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 45;

export function signToken(userId) {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export async function issueRefreshToken(userId) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return { refreshToken, refreshExpiresAt: expiresAt };
}

export async function revokeRefreshToken(refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash]
  );
}

export async function revokeAllRefreshTokensForUser(userId) {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  );
}

export async function rotateRefreshToken(refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  const result = await pool.query(
    `SELECT rt.id, rt.user_id, u.id AS user_exists
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  const session = result.rows[0];
  if (!session?.user_id) {
    throw new Error("Invalid refresh token");
  }

  await pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [session.id]);
  return { userId: session.user_id };
}

export async function issueAuthSession(userId) {
  const accessToken = signToken(userId);
  const { refreshToken, refreshExpiresAt } = await issueRefreshToken(userId);
  return { accessToken, refreshToken, refreshExpiresAt };
}

/** Express middleware — attaches req.userId or 401s */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = verifyToken(header.slice(7));
    const result = await pool.query("SELECT id FROM users WHERE id = $1", [payload.uid]);
    if (!result.rows.length) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
    req.userId = payload.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Optional auth — sets req.userId if token present, doesn't block */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const uid = verifyToken(header.slice(7)).uid;
      const result = await pool.query("SELECT id FROM users WHERE id = $1", [uid]);
      if (result.rows.length) req.userId = uid;
    } catch {}
  }
  next();
}
