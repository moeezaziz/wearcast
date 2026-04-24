import "dotenv/config";
import crypto from "node:crypto";
import pg from "pg";
import sharp from "sharp";

const SOURCE_MAX_EDGE = 1280;
const SOURCE_QUALITY = 76;
const SOURCE_MAX_BYTES = 700 * 1024;
const CROP_MAX_EDGE = 960;
const CROP_QUALITY = 74;
const CROP_MAX_BYTES = 380 * 1024;

const args = new Set(process.argv.slice(2));
const isDryRun = !args.has("--write");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const rowLimit = limitArg ? Math.max(1, Number(limitArg.split("=")[1] || 0)) : null;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

function parseDataUrl(dataUrl = null) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function toDataUrl(buffer, mime = "image/jpeg") {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function selectStoredDisplayPhoto(sourcePhotoDataUrl, cropPhotoDataUrl, cropConfidence) {
  if (cropConfidence === "trusted" && cropPhotoDataUrl) return cropPhotoDataUrl;
  return null;
}

async function compressImageDataUrl(dataUrl, { maxEdge, quality, maxBytes }) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { dataUrl, changed: false, bytesBefore: 0, bytesAfter: 0, hash: null };

  const bytesBefore = parsed.buffer.length;
  let pipeline = sharp(parsed.buffer, { failOn: "none" }).rotate();
  const metadata = await pipeline.metadata();
  const longestEdge = Math.max(metadata.width || 1, metadata.height || 1);
  if (longestEdge > maxEdge) {
    pipeline = pipeline.resize({
      width: metadata.width && metadata.width >= metadata.height ? maxEdge : null,
      height: metadata.height && metadata.height > metadata.width ? maxEdge : null,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let currentQuality = quality;
  let output = await pipeline.jpeg({
    quality: currentQuality,
    mozjpeg: true,
    progressive: true,
  }).toBuffer();

  while (output.length > maxBytes && currentQuality > 48) {
    currentQuality -= 6;
    output = await sharp(output, { failOn: "none" })
      .jpeg({
        quality: currentQuality,
        mozjpeg: true,
        progressive: true,
      })
      .toBuffer();
  }

  const bytesAfter = output.length;
  const changed = bytesAfter < bytesBefore || parsed.mime !== "image/jpeg";
  return {
    dataUrl: changed ? toDataUrl(output, "image/jpeg") : dataUrl,
    changed,
    bytesBefore,
    bytesAfter: changed ? bytesAfter : bytesBefore,
    hash: sha256(changed ? output : parsed.buffer),
  };
}

async function main() {
  const query = `
    SELECT id, user_id, name, type, photo_data_url, source_photo_data_url, crop_photo_data_url, crop_confidence
    FROM wardrobe_items
    WHERE photo_data_url IS NOT NULL
       OR source_photo_data_url IS NOT NULL
       OR crop_photo_data_url IS NOT NULL
    ORDER BY id ASC
    ${rowLimit ? `LIMIT ${rowLimit}` : ""}
  `;

  const { rows } = await pool.query(query);
  const crossRowHashes = new Map();
  let rowsChanged = 0;
  let bytesSaved = 0;

  for (const row of rows) {
    const sourceResult = await compressImageDataUrl(row.source_photo_data_url || row.photo_data_url || null, {
      maxEdge: SOURCE_MAX_EDGE,
      quality: SOURCE_QUALITY,
      maxBytes: SOURCE_MAX_BYTES,
    });
    const cropResult = await compressImageDataUrl(row.crop_photo_data_url || null, {
      maxEdge: CROP_MAX_EDGE,
      quality: CROP_QUALITY,
      maxBytes: CROP_MAX_BYTES,
    });

    let nextSource = sourceResult.dataUrl || null;
    let nextCrop = cropResult.dataUrl || null;
    let nextConfidence = row.crop_confidence === "trusted" || row.crop_confidence === "fallback"
      ? row.crop_confidence
      : "none";

    if (nextSource && sourceResult.hash) {
      const key = `source:${sourceResult.hash}`;
      crossRowHashes.set(key, (crossRowHashes.get(key) || 0) + 1);
    }
    if (nextCrop && cropResult.hash) {
      const key = `crop:${cropResult.hash}`;
      crossRowHashes.set(key, (crossRowHashes.get(key) || 0) + 1);
    }

    if (nextSource && nextCrop && sourceResult.hash && cropResult.hash && sourceResult.hash === cropResult.hash) {
      nextCrop = null;
      nextConfidence = "none";
    }

    const nextDisplay = selectStoredDisplayPhoto(nextSource, nextCrop, nextConfidence);

    const changed = nextSource !== (row.source_photo_data_url || row.photo_data_url || null)
      || nextCrop !== (row.crop_photo_data_url || null)
      || nextDisplay !== (row.photo_data_url || null)
      || nextConfidence !== (row.crop_confidence || "none");

    if (!changed) continue;

    rowsChanged += 1;
    bytesSaved += Math.max(0, (sourceResult.bytesBefore - sourceResult.bytesAfter)) + Math.max(0, (cropResult.bytesBefore - cropResult.bytesAfter));

    if (!isDryRun) {
      await pool.query(
        `UPDATE wardrobe_items
         SET photo_data_url = $1,
             source_photo_data_url = $2,
             crop_photo_data_url = $3,
             crop_confidence = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [nextDisplay, nextSource, nextCrop, nextConfidence, row.id]
      );
    }
  }

  const duplicateGroups = [...crossRowHashes.entries()].filter(([, count]) => count > 1).length;
  console.info(JSON.stringify({
    mode: isDryRun ? "dry-run" : "write",
    scannedRows: rows.length,
    changedRows: rowsChanged,
    estimatedBytesSaved: bytesSaved,
    crossRowDuplicateGroups: duplicateGroups,
  }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
