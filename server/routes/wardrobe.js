import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

// All wardrobe routes require authentication
router.use(requireAuth);

// ─── List wardrobe items ─────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    console.info(`[GET] /api/wardrobe - userId: ${req.userId}`);
    const result = await pool.query(
      "SELECT * FROM wardrobe_items WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    console.info("/api/wardrobe: returning", result.rows.length, "items");
    res.json(result.rows.map(rowToItem));
  } catch (err) {
    console.error("list wardrobe error:", err);
    res.status(500).json({ error: "Failed to load wardrobe" });
  }
});

// ─── Add item ────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { type, name, color, material, careInstructions, photoDataUrl } = req.body;
    console.info(`[POST] /api/wardrobe - userId: ${req.userId}, body:`, req.body);
    if (!type || !name) {
      console.warn("/api/wardrobe: Type and name required");
      return res.status(400).json({ error: "Type and name required" });
    }

    const result = await pool.query(
      `INSERT INTO wardrobe_items (user_id, type, name, color, material, care_instructions, photo_data_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId, type, name, color || null, material || null, JSON.stringify(careInstructions || []), photoDataUrl || null]
    );
    console.info("/api/wardrobe: added item", result.rows[0]?.id);
    res.json(rowToItem(result.rows[0]));
  } catch (err) {
    console.error("add wardrobe error:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

// ─── Update item ─────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { type, name, color, material, careInstructions, photoDataUrl } = req.body;
    console.info(`[PUT] /api/wardrobe/${req.params.id} - userId: ${req.userId}, body:`, req.body);
    if (!type || !name) {
      console.warn(`/api/wardrobe/${req.params.id}: Type and name required`);
      return res.status(400).json({ error: "Type and name required" });
    }

    const result = await pool.query(
      `UPDATE wardrobe_items
       SET type = $1, name = $2, color = $3, material = $4,
           care_instructions = $5, photo_data_url = $6, updated_at = NOW()
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [type, name, color || null, material || null, JSON.stringify(careInstructions || []), photoDataUrl || null, req.params.id, req.userId]
    );
    if (!result.rows.length) {
      console.warn(`/api/wardrobe/${req.params.id}: Item not found for update`);
      return res.status(404).json({ error: "Item not found" });
    }
    console.info(`/api/wardrobe/${req.params.id}: updated item`);
    res.json(rowToItem(result.rows[0]));
  } catch (err) {
    console.error("update wardrobe error:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// ─── Delete item ─────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    console.info(`[DELETE] /api/wardrobe/${req.params.id} - userId: ${req.userId}`);
    const result = await pool.query(
      "DELETE FROM wardrobe_items WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (!result.rows.length) {
      console.warn(`/api/wardrobe/${req.params.id}: Item not found for delete`);
      return res.status(404).json({ error: "Item not found" });
    }
    console.info(`/api/wardrobe/${req.params.id}: deleted item`);
    res.json({ ok: true });
  } catch (err) {
    console.error("delete wardrobe error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

function rowToItem(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    color: row.color,
    material: row.material,
    careInstructions: row.care_instructions || [],
    photoDataUrl: row.photo_data_url,
    createdAt: row.created_at,
  };
}

export default router;
