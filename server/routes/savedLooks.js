import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";
import { FREE_SAVED_LOOK_LIMIT, limitError, userHasPremiumAccess, withUserLimitTransaction } from "../premium.js";

const router = Router();

router.use(requireAuth);

function cleanString(value, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeMissingItems(value) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item, 120)).filter(Boolean).slice(0, 8)
    : [];
}

function normalizeOutfit(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function rowToLook(row) {
  return {
    id: row.id,
    signature: row.signature,
    headline: row.headline || "Saved look",
    subtitle: row.subtitle || "",
    locationName: row.location_name || "",
    coverage: Number(row.coverage || 0),
    missingItems: Array.isArray(row.missing_items) ? row.missing_items : [],
    outfit: normalizeOutfit(row.outfit),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM saved_looks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ looks: result.rows.map(rowToLook) });
  } catch (err) {
    console.error("list saved looks error:", err);
    res.status(500).json({ error: "Failed to load saved looks" });
  }
});

router.post("/", async (req, res) => {
  try {
    const signature = cleanString(req.body?.signature, 500);
    if (!signature) return res.status(400).json({ error: "Saved look signature is required" });

    const result = await withUserLimitTransaction(req.userId, async (client) => {
      const existing = await client.query(
        "SELECT id FROM saved_looks WHERE user_id = $1 AND signature = $2",
        [req.userId, signature]
      );
      if (!existing.rows.length) {
      const hasPremium = await userHasPremiumAccess(req.userId);
      const countResult = await client.query("SELECT COUNT(*)::int AS count FROM saved_looks WHERE user_id = $1", [req.userId]);
      const count = Number(countResult.rows[0]?.count || 0);
      if (!hasPremium && count >= FREE_SAVED_LOOK_LIMIT) {
        return { limited: true, count };
      }
    }

      return client.query(
      `INSERT INTO saved_looks
        (user_id, signature, headline, subtitle, location_name, coverage, missing_items, outfit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, signature)
       DO UPDATE SET
         headline = EXCLUDED.headline,
         subtitle = EXCLUDED.subtitle,
         location_name = EXCLUDED.location_name,
         coverage = EXCLUDED.coverage,
         missing_items = EXCLUDED.missing_items,
         outfit = EXCLUDED.outfit,
         updated_at = NOW()
       RETURNING *`,
      [
        req.userId,
        signature,
        cleanString(req.body?.headline, 160) || "Saved look",
        cleanString(req.body?.subtitle, 240),
        cleanString(req.body?.locationName, 160),
        Math.max(0, Math.min(100, Number(req.body?.coverage || 0))),
        JSON.stringify(normalizeMissingItems(req.body?.missingItems)),
        JSON.stringify(normalizeOutfit(req.body?.outfit)),
      ]
      );
    });
    if (result.limited) {
      return limitError(res, {
        limitCode: "saved_looks_cap",
        limit: FREE_SAVED_LOOK_LIMIT,
        count: result.count,
        error: `Free includes ${FREE_SAVED_LOOK_LIMIT} synced saved looks. Go premium to keep a larger outfit library.`,
      });
    }
    res.json({ look: rowToLook(result.rows[0]) });
  } catch (err) {
    console.error("save saved look error:", err);
    res.status(500).json({ error: "Failed to save look" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM saved_looks WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Saved look not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("delete saved look error:", err);
    res.status(500).json({ error: "Failed to delete saved look" });
  }
});

export default router;
