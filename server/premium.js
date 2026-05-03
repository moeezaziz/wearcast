import pool from "./db.js";

export const FREE_WARDROBE_ITEM_LIMIT = 15;
export const FREE_SAVED_LOOK_LIMIT = 3;
export const FREE_PHOTO_SCANS_PER_WINDOW = 5;
export const PHOTO_SCAN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const PREMIUM_STATUSES = new Set(["premium_active", "premium_trial", "premium_grace_period"]);

export function normalizeSubscriptionSnapshot(snapshot = {}) {
  const status = ["premium_active", "premium_trial", "premium_grace_period", "premium_expired", "free"].includes(snapshot.status)
    ? snapshot.status
    : "free";
  const plan = ["annual", "monthly"].includes(snapshot.plan) ? snapshot.plan : "free";
  const renewalStatus = typeof snapshot.renewalStatus === "string" && snapshot.renewalStatus.trim()
    ? snapshot.renewalStatus.trim().slice(0, 80)
    : (status === "free" ? "none" : "active");
  return {
    status,
    plan: status === "free" ? "free" : plan,
    trialActive: !!snapshot.trialActive,
    renewalStatus,
  };
}

export function hasPremiumAccessFromRow(row = {}) {
  return PREMIUM_STATUSES.has(row.subscription_status || row.status);
}

export function hasPremiumAccess(subscription = {}) {
  return PREMIUM_STATUSES.has(subscription.status);
}

export function limitError(res, { limitCode, limit, count, error }) {
  return res.status(402).json({
    error,
    limitCode,
    limit,
    count,
  });
}

export async function getUserSubscription(userId) {
  const result = await pool.query(
    `SELECT subscription_status, subscription_plan, subscription_trial_active, subscription_renewal_status
     FROM users
     WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0] || {};
  return {
    status: row.subscription_status || "free",
    plan: row.subscription_plan || "free",
    trialActive: !!row.subscription_trial_active,
    renewalStatus: row.subscription_renewal_status || "none",
  };
}

export async function userHasPremiumAccess(userId) {
  return hasPremiumAccess(await getUserSubscription(userId));
}

export async function upsertUserSubscription(userId, snapshot = {}) {
  const normalized = normalizeSubscriptionSnapshot(snapshot);
  await pool.query(
    `UPDATE users
     SET subscription_status = $1,
         subscription_plan = $2,
         subscription_trial_active = $3,
         subscription_renewal_status = $4,
         subscription_updated_at = NOW()
     WHERE id = $5`,
    [normalized.status, normalized.plan, normalized.trialActive, normalized.renewalStatus, userId]
  );
  return normalized;
}

export async function countWardrobeItems(userId) {
  const result = await pool.query("SELECT COUNT(*)::int AS count FROM wardrobe_items WHERE user_id = $1", [userId]);
  return Number(result.rows[0]?.count || 0);
}

export async function countSavedLooks(userId) {
  const result = await pool.query("SELECT COUNT(*)::int AS count FROM saved_looks WHERE user_id = $1", [userId]);
  return Number(result.rows[0]?.count || 0);
}

export async function countRecentPhotoScans(userId, now = Date.now()) {
  const windowStart = new Date(now - PHOTO_SCAN_WINDOW_MS);
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM photo_scan_events
     WHERE user_id = $1
       AND created_at >= $2`,
    [userId, windowStart]
  );
  return Number(result.rows[0]?.count || 0);
}

export async function recordPhotoScan(userId) {
  await pool.query("INSERT INTO photo_scan_events (user_id) VALUES ($1)", [userId]);
}

export async function withUserLimitTransaction(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [Number(userId)]);
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}
