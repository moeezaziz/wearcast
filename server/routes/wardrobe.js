import { Router } from "express";
import pool from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

// All wardrobe routes require authentication
router.use(requireAuth);

function normalizeCareInstructions(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeCropConfidence(value) {
  return value === "trusted" || value === "fallback" ? value : "none";
}

function selectStoredDisplayPhoto(sourcePhotoDataUrl, cropPhotoDataUrl, cropConfidence) {
  if (cropConfidence === "trusted" && cropPhotoDataUrl) return cropPhotoDataUrl;
  // Avoid storing a duplicate of the source image when display media can be derived.
  return null;
}

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
    const { type, name, color, material, careInstructions, photoDataUrl, sourcePhotoDataUrl, cropPhotoDataUrl, cropConfidence, favorite } = req.body;
    const normalizedCareInstructions = normalizeCareInstructions(careInstructions);
    const normalizedSource = sourcePhotoDataUrl || photoDataUrl || null;
    const normalizedCrop = cropPhotoDataUrl || null;
    const normalizedConfidence = normalizeCropConfidence(cropConfidence);
    const storedDisplayPhoto = selectStoredDisplayPhoto(normalizedSource, normalizedCrop, normalizedConfidence);
    console.info(`[POST] /api/wardrobe - userId: ${req.userId}, body:`, req.body);
    if (!type || !name) {
      console.warn("/api/wardrobe: Type and name required");
      return res.status(400).json({ error: "Type and name required" });
    }

    const result = await pool.query(
      `INSERT INTO wardrobe_items (user_id, type, name, color, material, care_instructions, photo_data_url, source_photo_data_url, crop_photo_data_url, crop_confidence, favorite)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.userId, type, name, color || null, material || null, JSON.stringify(normalizedCareInstructions), storedDisplayPhoto, normalizedSource, normalizedCrop, normalizedConfidence, !!favorite]
    );
    console.info("/api/wardrobe: added item", result.rows[0]?.id);
    res.json(rowToItem(result.rows[0]));
  } catch (err) {
    console.error("add wardrobe error:", err);
    res.status(500).json({ error: err.message || "Failed to add item" });
  }
});

// ─── Update item ─────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { type, name, color, material, careInstructions, photoDataUrl, sourcePhotoDataUrl, cropPhotoDataUrl, cropConfidence, favorite } = req.body;
    const normalizedCareInstructions = normalizeCareInstructions(careInstructions);
    const normalizedSource = sourcePhotoDataUrl || photoDataUrl || null;
    const normalizedCrop = cropPhotoDataUrl || null;
    const normalizedConfidence = normalizeCropConfidence(cropConfidence);
    const storedDisplayPhoto = selectStoredDisplayPhoto(normalizedSource, normalizedCrop, normalizedConfidence);
    console.info(`[PUT] /api/wardrobe/${req.params.id} - userId: ${req.userId}, body:`, req.body);
    if (!type || !name) {
      console.warn(`/api/wardrobe/${req.params.id}: Type and name required`);
      return res.status(400).json({ error: "Type and name required" });
    }

    const result = await pool.query(
      `UPDATE wardrobe_items
       SET type = $1, name = $2, color = $3, material = $4,
           care_instructions = $5, photo_data_url = $6, source_photo_data_url = $7,
           crop_photo_data_url = $8, crop_confidence = $9, favorite = $10, updated_at = NOW()
       WHERE id = $11 AND user_id = $12 RETURNING *`,
      [type, name, color || null, material || null, JSON.stringify(normalizedCareInstructions), storedDisplayPhoto, normalizedSource, normalizedCrop, normalizedConfidence, !!favorite, req.params.id, req.userId]
    );
    if (!result.rows.length) {
      console.warn(`/api/wardrobe/${req.params.id}: Item not found for update`);
      return res.status(404).json({ error: "Item not found" });
    }
    console.info(`/api/wardrobe/${req.params.id}: updated item`);
    res.json(rowToItem(result.rows[0]));
  } catch (err) {
    console.error("update wardrobe error:", err);
    res.status(500).json({ error: err.message || "Failed to update item" });
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
    careInstructions: Array.isArray(row.care_instructions) ? row.care_instructions : [],
    photoDataUrl: row.photo_data_url,
    sourcePhotoDataUrl: row.source_photo_data_url || row.photo_data_url,
    cropPhotoDataUrl: row.crop_photo_data_url,
    cropConfidence: normalizeCropConfidence(row.crop_confidence),
    favorite: !!row.favorite,
    createdAt: row.created_at,
  };
}

export default router;
