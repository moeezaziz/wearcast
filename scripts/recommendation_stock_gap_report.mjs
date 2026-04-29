const baseUrl = (process.env.WEARCAST_ADMIN_URL || process.env.WEARCAST_AUDIT_URL || "https://wearcast.fly.dev").replace(/\/$/, "");
const token = process.env.STOCK_GAP_ADMIN_TOKEN || "";
const limit = Math.max(1, Math.min(100, Number(process.env.STOCK_GAP_LIMIT || 50)));

const url = new URL(`${baseUrl}/api/recommend/stock-gaps`);
url.searchParams.set("limit", String(limit));

const res = await fetch(url, {
  headers: token ? { "X-WearCast-Admin-Token": token } : {},
});
const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  throw new Error(`Stock gap report returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
}

if (!res.ok) {
  throw new Error(`Stock gap report failed (${res.status}): ${JSON.stringify(data)}`);
}

const rows = Array.isArray(data.rows) ? data.rows : [];
console.log(`# WearCast Stock Image Gap Backlog\n`);
console.log(`Source: ${baseUrl}`);
console.log(`Rows: ${rows.length}\n`);
if (!rows.length) {
  console.log("No stock image gaps recorded yet.");
} else {
  rows.forEach((row, index) => {
    const requested = row.requested || {};
    const selected = row.selected_stock || {};
    const context = row.context || {};
    console.log(`${index + 1}. ${row.request_count}x ${row.slot}: ${row.item_name}`);
    console.log(`   requested: ${requested.subtype || "generic"} ${requested.colors?.join("/") || "any color"} ${requested.materials?.join("/") || "any material"}`);
    console.log(`   selected: ${selected.key || "none"} (${selected.matchQuality || selected.source || "unknown"})`);
    console.log(`   reasons: ${(row.reasons || []).join(", ") || "none"}`);
    console.log(`   context: ${context.gender || "unspecified"}, ${context.styleFocus || "auto"}, ${context.weatherLabel || "weather unknown"}\n`);
  });
}
