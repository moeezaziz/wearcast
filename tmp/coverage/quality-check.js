// Quality-check pass on the downloaded images. Flags + quarantines:
//   - files with non-image magic bytes
//   - files smaller than 30KB (likely thumbnails / sprites)
//   - aspect ratios outside [0.5, 2.0]
//   - filenames whose Commons title strongly suggests off-topic (e.g.
//     train station, postage stamp, coat of arms, painting/portrait,
//     uniform officer, building, map)
//
// Quarantines flagged files into tmp/coverage/quarantine/ with a sidecar
// reason.txt so they can be re-reviewed without losing provenance.
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const STOCK_DIR = path.join(ROOT, "www/assets/recommendation-stock");
const QUARANTINE = path.join(__dirname, "quarantine");
const downloads = require("./downloads.json").filter((r) => r.status === "ok");

fs.mkdirSync(QUARANTINE, { recursive: true });

const SUSPICIOUS_TITLE = /(station|stamp|postage|coat[ _]of[ _]arms|painting|portrait|monument|map[ _]of|seal[ _]of|train|aircraft|cathedral|street[ _]sign|book[ _]cover|album[ _]cover|poster|cartoon|diagram|chart|graph|building|church|temple|mosque|bus[ _]?stop|bridge|airport|sign[ _]board|library|museum|hall|theatre|theater|palace)/i;

// Magic bytes for common image formats
function detectFormat(buf) {
  if (!buf || buf.length < 12) return null;
  const sig = buf.slice(0, 12);
  if (sig[0] === 0xff && sig[1] === 0xd8) return "jpeg";
  if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return "png";
  if (sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46) return "gif";
  if (sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50) return "webp";
  if (sig[0] === 0x3c && sig[1] === 0x3f) return "svg";
  return null;
}

// Lightweight JPEG dimension parsing — enough for our sanity gate.
function jpegDims(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    i += 2;
    if (m === 0xd8 || m === 0xd9) continue;
    if (m >= 0xc0 && m <= 0xc3) {
      const h = buf.readUInt16BE(i + 3);
      const w = buf.readUInt16BE(i + 5);
      return { w, h };
    }
    const seg = buf.readUInt16BE(i);
    i += seg;
  }
  return null;
}
function pngDims(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const flags = [];
let ok = 0;

for (const r of downloads) {
  const filename = path.basename(r.outPath);
  const fpath = path.join(STOCK_DIR, filename);
  const result = { file: filename, title: r.title, source: r.sourcePage, license: r.license, reasons: [] };
  if (!fs.existsSync(fpath)) {
    result.reasons.push("missing_on_disk");
    flags.push(result);
    continue;
  }
  const stat = fs.statSync(fpath);
  result.bytes = stat.size;
  if (stat.size < 30 * 1024) result.reasons.push(`too_small (${(stat.size/1024)|0}kb)`);
  const buf = fs.readFileSync(fpath);
  const fmt = detectFormat(buf);
  if (!fmt) result.reasons.push("not_an_image");
  else {
    result.format = fmt;
    let dims = null;
    if (fmt === "jpeg") dims = jpegDims(buf);
    else if (fmt === "png") dims = pngDims(buf);
    if (dims) {
      result.dims = `${dims.w}x${dims.h}`;
      const ratio = dims.w / dims.h;
      if (dims.w < 360 || dims.h < 360) result.reasons.push("low_res");
      if (ratio < 0.5 || ratio > 2.0) result.reasons.push(`bad_aspect_ratio (${ratio.toFixed(2)})`);
    }
  }
  if (r.title && SUSPICIOUS_TITLE.test(r.title)) result.reasons.push(`suspicious_title (${r.title.match(SUSPICIOUS_TITLE)[0]})`);

  if (result.reasons.length) {
    // quarantine
    const target = path.join(QUARANTINE, filename);
    fs.renameSync(fpath, target);
    fs.writeFileSync(target + ".reason.txt", result.reasons.join("; ") + `\nsource: ${r.sourcePage}\nlicense: ${r.license}\ntitle: ${r.title}\n`);
    flags.push(result);
  } else {
    ok++;
  }
}

console.log(`Spot-check: ${ok} kept, ${flags.length} quarantined.`);
fs.writeFileSync(path.join(__dirname, "quarantine.json"), JSON.stringify(flags, null, 2));
const md = ["# Quarantined images", ""].concat(
  flags.map((f) => `- **${f.file}** (${f.format || "?"}, ${(f.bytes||0)/1024|0}kb${f.dims ? ", " + f.dims : ""}) — ${f.reasons.join("; ")}\n  - title: ${f.title}\n  - source: ${f.source}`)
).join("\n");
fs.writeFileSync(path.join(__dirname, "quarantine.md"), md);
console.log(`Wrote quarantine.json + quarantine.md`);
