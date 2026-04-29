"use strict";
const fs = require("fs");
const path = require("path");
const credits = require("./credits.json");

const escape = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const cleanArtist = (a) =>
  escape((a || "").replace(/[\r\n]+/g, " ").trim().slice(0, 160) || "Unknown contributor");

const byLicense = {};
for (const c of credits) {
  const k = c.license || "Unknown";
  (byLicense[k] = byLicense[k] || []).push(c);
}

const summaryRows = Object.entries(byLicense)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([lic, arr]) => `<tr><td>${escape(lic)}</td><td>${arr.length}</td></tr>`)
  .join("\n");

const fileRows = credits
  .slice()
  .sort((a, b) => a.file.localeCompare(b.file))
  .map(
    (c) =>
      `<tr><td><code>${escape(c.file)}</code></td><td>${escape(c.license)}</td><td>${cleanArtist(c.artist)}</td><td><a href="${escape(c.source)}" rel="noopener">view source</a></td></tr>`
  )
  .join("\n");

const today = new Date().toISOString().slice(0, 10);
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WearCast — Image Credits</title>
  <meta name="theme-color" content="#0b1220" />
  <link rel="icon" href="icon.svg?v=13" type="image/svg+xml" />
  <link rel="stylesheet" href="styles.css?v=13" />
  <style>
    table.credits { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.credits th, table.credits td { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(0,0,0,0.08); vertical-align: top; }
    table.credits th { font-weight: 700; background: rgba(0,0,0,0.03); position: sticky; top: 0; }
    table.credits td code { font-size: 12px; word-break: break-all; }
    .credits-summary { width: auto; min-width: 320px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <a href="./" style="display:flex; align-items:center; gap:12px; text-decoration:none; color:inherit;">
        <img class="logo" src="icon.svg?v=13" alt="WearCast logo" />
        <div class="title">
          <h1>WearCast</h1>
          <p class="subtitle">Image Credits</p>
        </div>
      </a>
    </div>
    <div class="header-actions">
      <a class="btn secondary" href="./" style="text-decoration:none;">Back</a>
    </div>
  </header>

  <main>
    <section class="card">
      <div class="prose">
        <p><strong>Last updated:</strong> ${today}</p>
        <p>
          The clothing reference images on WearCast outfit recommendation cards are sourced from
          <a href="https://commons.wikimedia.org/" rel="noopener">Wikimedia Commons</a>
          under permissive Creative Commons and public-domain licenses. Each file's license,
          original contributor, and source URL is listed below. WearCast is grateful to every
          photographer who released their work openly.
        </p>
        <p class="muted">
          If you are an image contributor and would like a different attribution format,
          or your image removed, please contact us via the
          <a href="./support.html">Support</a> page. We respond within five business days.
        </p>

        <h2>Summary by license</h2>
        <table class="credits credits-summary">
          <thead><tr><th>License</th><th>Images</th></tr></thead>
          <tbody>
${summaryRows}
          </tbody>
        </table>

        <h2>All ${credits.length} images</h2>
      </div>
    </section>
    <section class="card">
      <table class="credits">
        <thead><tr><th>File</th><th>License</th><th>Contributor</th><th>Source</th></tr></thead>
        <tbody>
${fileRows}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>
`;
const outPath = path.resolve(__dirname, "../../www/credits.html");
fs.writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${html.length} bytes, ${credits.length} rows)`);
