// Polished SVG illustration generator for the WearCast stock catalog.
//
// Goals:
//   - Style continuity with the existing reference SVGs (bottom-navy-chinos-polished.svg etc.):
//       900x900 canvas, soft tinted background, bold shape, 18px stroke,
//       a single accent line for definition, minimal extra detail.
//   - Cover every item type referenced by the missing 317 catalog entries.
//   - Recolour deterministically from a single color word, with subtle
//       material cues for linen / denim / leather / wool only (other
//       materials inherit the base look — too much texture looks busy).
//
// Usage (programmatic):
//   const { generate } = require("./svg-gen");
//   const svg = generate({ slot, item, color, material, gender });
//   fs.writeFileSync(outPath, svg);
"use strict";

// ─── Color palettes ──────────────────────────────────────────────────────
// Each palette gives four tones used by all silhouettes:
//   bg     - very pale tint behind the silhouette
//   fill   - main body color
//   stroke - dark contour
//   accent - a midtone for seams / highlights (often partial opacity)
const PALETTES = {
  black:        { bg:"#eef0f3", fill:"#1f2125", stroke:"#0b0c0f", accent:"#5b5e66" },
  white:        { bg:"#f4f6f9", fill:"#f5f6f8", stroke:"#9ba3ae", accent:"#c8cdd5" },
  cream:        { bg:"#f8f3e7", fill:"#efe4c7", stroke:"#a78c5e", accent:"#c9b58a" },
  ivory:        { bg:"#f7f2e6", fill:"#ece2c4", stroke:"#a18a5d", accent:"#c4b186" },
  beige:        { bg:"#f6efe2", fill:"#dbc7a3", stroke:"#8e7549", accent:"#b8a073" },
  tan:          { bg:"#f4ebd9", fill:"#caa775", stroke:"#7d5a31", accent:"#a98856" },
  brown:        { bg:"#efe4d4", fill:"#7c5836", stroke:"#3f2913", accent:"#b58867" },
  rust:         { bg:"#f5e0d2", fill:"#a4502b", stroke:"#5b240b", accent:"#cc724b" },
  khaki:        { bg:"#f0ecd9", fill:"#9d935d", stroke:"#56522e", accent:"#c4ba80" },
  olive:        { bg:"#eceadc", fill:"#5e6a3a", stroke:"#2f3819", accent:"#8a9659" },
  green:        { bg:"#e3eee2", fill:"#2f6b3c", stroke:"#143a1c", accent:"#5a9863" },
  navy:         { bg:"#eef3f8", fill:"#243852", stroke:"#0f1d33", accent:"#7189a8" },
  blue:         { bg:"#e9f1fa", fill:"#2f64a8", stroke:"#143560", accent:"#6892c6" },
  "light blue": { bg:"#eef6fc", fill:"#7eb1d8", stroke:"#2f5d80", accent:"#a9cee5" },
  gray:         { bg:"#eff0f2", fill:"#6c7079", stroke:"#33363d", accent:"#9aa0a8" },
  grey:         { bg:"#eff0f2", fill:"#6c7079", stroke:"#33363d", accent:"#9aa0a8" },
  charcoal:     { bg:"#ecedef", fill:"#3a3c40", stroke:"#1a1c1f", accent:"#717479" },
  red:          { bg:"#f7e3e2", fill:"#a32830", stroke:"#5e0d12", accent:"#cc555c" },
  burgundy:     { bg:"#f1dcdb", fill:"#74222c", stroke:"#3a0a10", accent:"#a14c54" },
  pink:         { bg:"#fbe9ee", fill:"#d97a90", stroke:"#783147", accent:"#e9a7b6" },
  magenta:      { bg:"#f9e1ec", fill:"#a8326d", stroke:"#5b143b", accent:"#cd6595" },
  purple:       { bg:"#ece5f1", fill:"#5b3a78", stroke:"#2c1740", accent:"#8a68a8" },
  yellow:       { bg:"#fbf4d4", fill:"#d8b020", stroke:"#7a6200", accent:"#ecd07b" },
  gold:         { bg:"#f7eed1", fill:"#b78a2e", stroke:"#6c4c10", accent:"#d8b873" },
  silver:       { bg:"#eef0f2", fill:"#a4a8af", stroke:"#5d6168", accent:"#cbcdd2" },
  pearl:        { bg:"#f3f1ec", fill:"#e6e0d2", stroke:"#9c9384", accent:"#c9c0ac" },
  nude:         { bg:"#f6e9dd", fill:"#dcb591", stroke:"#8c6242", accent:"#c79874" },
  floral:       { bg:"#fbe9ef", fill:"#d97a90", stroke:"#783147", accent:"#e9a7b6" }, // proxy
  camel:        { bg:"#f3e7d0", fill:"#b88857", stroke:"#6e4c25", accent:"#d4ad7f" },
  tortoiseshell:{ bg:"#f0e3cf", fill:"#7e5630", stroke:"#3e2611", accent:"#b48051" },
};
function paletteFor(color) {
  const k = String(color || "").toLowerCase().trim();
  return PALETTES[k] || PALETTES.gray;
}

// ─── Material texture overlay ────────────────────────────────────────────
// Only a small set get a visible cue. Others inherit the clean base look.
function materialPattern(material, accentColor, id) {
  const m = String(material || "").toLowerCase();
  if (m === "linen") {
    return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 7h14" stroke="${accentColor}" stroke-width="1" opacity="0.35"/>
    </pattern>`;
  }
  if (m === "denim") {
    return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M0 5h10" stroke="${accentColor}" stroke-width="1" opacity="0.3"/>
    </pattern>`;
  }
  if (m === "corduroy") {
    return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M7 0v14" stroke="${accentColor}" stroke-width="2.4" opacity="0.32"/>
    </pattern>`;
  }
  if (m === "leather") {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${accentColor}" stop-opacity="0.0"/>
      <stop offset="0.45" stop-color="${accentColor}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${accentColor}" stop-opacity="0"/>
    </linearGradient>`;
  }
  if (m === "wool" || m === "cashmere" || m === "merino") {
    return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="3" r="0.7" fill="${accentColor}" opacity="0.3"/>
    </pattern>`;
  }
  if (m === "knit") {
    return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 7q3.5 -7 7 0t7 0" fill="none" stroke="${accentColor}" stroke-width="1.4" opacity="0.32"/>
    </pattern>`;
  }
  if (m === "silk" || m === "satin" || m === "velvet" || m === "chiffon") {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="white" stop-opacity="0.18"/>
      <stop offset="0.55" stop-color="white" stop-opacity="0"/>
      <stop offset="1" stop-color="${accentColor}" stop-opacity="0.14"/>
    </linearGradient>`;
  }
  if (m === "faux fur") {
    return `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse">
      <path d="M4 9 q1 -4 -1 -8 M4.5 9 q-2 -3 1.5 -7" stroke="${accentColor}" stroke-width="1.1" fill="none" opacity="0.34"/>
    </pattern>`;
  }
  if (m === "tweed") {
    return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 4h8M4 0v8" stroke="${accentColor}" stroke-width="0.8" opacity="0.35"/>
    </pattern>`;
  }
  return null; // no overlay
}

// ─── Silhouette helpers ──────────────────────────────────────────────────
// Each silhouette returns the inner body markup for the SVG (everything between
// the <rect> background and the </svg> close).
//
// Conventions:
//   - Canvas is 900x900. Center axis is x=450.
//   - Use `pal.fill` for main body, `pal.stroke` for outline, `pal.accent` for accent.
//   - Always include an 18px stroke for the silhouette to match reference.
//   - Add a subtle `accent` line for definition (collar / waistband / strap / seam).

const SIL = {};

// ── TOP family ────────────────────────────────────────────────────────────
SIL.tee = (p) => `
  <path d="M260 230l85-78 50 8a90 28 0 0 0 110 0l50-8 85 78-58 90-58-32v450H378V288l-58 32Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M395 168a90 30 0 0 0 110 0" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>`;

SIL.long_sleeve_tee = (p) => `
  <path d="M226 252l92-100 56 8a96 28 0 0 0 116 0l56-8 92 100 28 290-90 14-22-176v450H368V330l-22 176-90-14 28-290Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M392 170a96 30 0 0 0 116 0" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>`;

SIL.button_up = (p) => `
  <path d="M260 230l85-78 50 8a90 28 0 0 0 110 0l50-8 85 78-58 90-58-32v450H378V288l-58 32Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M395 168 380 220 450 280 520 220 505 168" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M450 240v440" stroke="${p.accent}" stroke-width="6"/>
  <circle cx="450" cy="320" r="6" fill="${p.accent}"/>
  <circle cx="450" cy="400" r="6" fill="${p.accent}"/>
  <circle cx="450" cy="480" r="6" fill="${p.accent}"/>
  <circle cx="450" cy="560" r="6" fill="${p.accent}"/>
  <circle cx="450" cy="640" r="6" fill="${p.accent}"/>`;

SIL.polo = (p) => `
  <path d="M260 230l85-78 50 8a90 28 0 0 0 110 0l50-8 85 78-58 90-58-32v450H378V288l-58 32Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M395 168 410 226 450 260 490 226 505 168" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="438" cy="218" r="4.5" fill="${p.accent}"/>
  <circle cx="462" cy="234" r="4.5" fill="${p.accent}"/>`;

SIL.henley = (p) => `${SIL.tee(p)}
  <path d="M450 168v110" stroke="${p.accent}" stroke-width="6"/>
  <circle cx="450" cy="200" r="4.5" fill="${p.accent}"/>
  <circle cx="450" cy="232" r="4.5" fill="${p.accent}"/>`;

SIL.knit_sweater = (p, mat) => `
  <path d="M226 252l92-100 56 8a96 28 0 0 0 116 0l56-8 92 100 28 290-90 14-22-176v450H368V330l-22 176-90-14 28-290Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  ${mat ? `<path d="M226 252l92-100 56 8a96 28 0 0 0 116 0l56-8 92 100 28 290-90 14-22-176v450H368V330l-22 176-90-14 28-290Z" fill="url(#tex)" stroke="none"/>` : ""}
  <path d="M380 168q35 22 70 0q35 -22 0 -42q-35 -22 -70 0q-35 22 0 42z" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>`;

SIL.turtleneck = (p) => `
  <path d="M260 230l85-78 50 8a90 28 0 0 0 110 0l50-8 85 78-58 90-58-32v450H378V288l-58 32Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M384 102 384 180 516 180 516 102Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M384 152 516 152" stroke="${p.accent}" stroke-width="6"/>`;

SIL.hoodie = (p) => `
  <path d="M232 254l84-110q24-32 60-32h148q36 0 60 32l84 110 28 290-90 14-22-176v450H368V330l-22 176-90-14 28-290Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M376 142q-22 32-22 70q0 32 30 50q34 18 66 18q32 0 66-18q30-18 30-50q0-38-22-70" fill="${p.accent}" opacity="0.55" stroke="${p.stroke}" stroke-width="14"/>
  <path d="M450 250 410 360 490 360Z" fill="${p.accent}" opacity="0.4"/>
  <path d="M425 260v90M475 260v90" stroke="${p.accent}" stroke-width="6"/>`;

SIL.tank = (p) => `
  <path d="M310 220l60-40 60 14a40 28 0 0 0 80 0l60-14 60 40-12 540H322Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M390 195a40 24 0 0 0 80 0" fill="none" stroke="${p.accent}" stroke-width="10"/>`;

SIL.camisole = (p) => `
  <path d="M340 235v-30q0-30 38-32q12 -1 30 5q24 9 42 9t42-9q18-6 30-5q38 2 38 32v30l-10 530H350Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16" stroke-linejoin="round"/>
  <path d="M378 188 378 110M522 188 522 110" stroke="${p.accent}" stroke-width="8"/>`;

SIL.halter = (p) => `
  <path d="M340 270v-20q0-30 38-32l72 -118 72 118q38 2 38 32v20l-12 490H352Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16" stroke-linejoin="round"/>
  <path d="M450 100v60" stroke="${p.accent}" stroke-width="8"/>`;

SIL.crop_top = (p) => `${SIL.tee(p).replace("V450","V388")}`;

SIL.bodysuit = (p) => `
  <path d="M310 220l60-40 60 14a40 28 0 0 0 80 0l60-14 60 40-12 470 -68 110 -100 -50 -100 50 -68 -110Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M390 195a40 24 0 0 0 80 0" fill="none" stroke="${p.accent}" stroke-width="10"/>`;

SIL.tunic = (p) => `${SIL.long_sleeve_tee(p).replace("v450","v530")}`;

SIL.blouse = (p) => `
  <path d="M270 240l72-90 50 6a90 28 0 0 0 116 0l50-6 72 90 22 320-90 12-22-188v416H386V384l-22 188-90-12 22-320Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M392 174 410 232 450 270 490 232 508 174" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M450 240v440" stroke="${p.accent}" stroke-width="5"/>`;

SIL.wrap_blouse = (p) => `
  <path d="M270 240l72-90 50 6a90 28 0 0 0 116 0l50-6 72 90 22 320-90 12-22-188v416H386V384l-22 188-90-12 22-320Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M390 200 450 320 510 200" fill="none" stroke="${p.accent}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`;

SIL.peplum_top = (p) => `
  <path d="M270 240l72-90 50 6a90 28 0 0 0 116 0l50-6 72 90-30 230H322Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M280 470q36 -8 80 12q36 22 90 22q54 0 90 -22q44 -20 80 -12l-12 250H292Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M280 470L620 470" stroke="${p.accent}" stroke-width="6"/>`;

SIL.cardigan = (p) => `
  <path d="M232 254l84-104h268l84 104 28 290-90 14-22-176v450H368V330l-22 176-90-14 28-290Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M450 152 V760" stroke="${p.accent}" stroke-width="8"/>
  <circle cx="430" cy="240" r="6" fill="${p.accent}"/>
  <circle cx="430" cy="320" r="6" fill="${p.accent}"/>
  <circle cx="430" cy="400" r="6" fill="${p.accent}"/>
  <circle cx="430" cy="480" r="6" fill="${p.accent}"/>
  <circle cx="430" cy="560" r="6" fill="${p.accent}"/>`;

// ── DRESS family ──────────────────────────────────────────────────────────
SIL.dress_midi = (p) => `
  <path d="M280 240l60-90 60 6a90 28 0 0 0 100 0l60-6 60 90 70 480q-180 50 -350 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M395 174a90 30 0 0 0 110 0" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>
  <path d="M310 380q140 24 280 0" fill="none" stroke="${p.accent}" stroke-width="6"/>`;

SIL.dress_maxi = (p) => `
  <path d="M280 220l60-80 60 6a90 28 0 0 0 100 0l60-6 60 80 100 540q-220 50 -480 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M395 156a90 30 0 0 0 110 0" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>`;

SIL.dress_mini = (p) => `
  <path d="M280 240l60-90 60 6a90 28 0 0 0 100 0l60-6 60 90 30 280q-160 36 -300 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M395 174a90 30 0 0 0 110 0" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>`;

SIL.dress_wrap = (p) => `${SIL.dress_midi(p)}
  <path d="M340 240 460 360 580 240" fill="none" stroke="${p.accent}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`;

SIL.dress_slip = (p) => `
  <path d="M340 230v-20q0-30 38-32q12 -1 30 5q24 9 42 9t42-9q18-6 30-5q38 2 38 32v20l78 530q-200 40 -340 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16" stroke-linejoin="round"/>
  <path d="M378 188 378 110M522 188 522 110" stroke="${p.accent}" stroke-width="6"/>`;

SIL.dress_sheath = (p) => `
  <path d="M310 220l60-80 60 6a90 28 0 0 0 100 0l60-6 60 80 28 540q-180 32 -340 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M395 156a90 30 0 0 0 110 0" fill="none" stroke="${p.accent}" stroke-width="10"/>
  <path d="M450 240v530" stroke="${p.accent}" stroke-width="5"/>`;

SIL.shirtdress = (p) => `${SIL.button_up(p).replace("v450","v600")}`;

SIL.bodycon = (p) => `
  <path d="M340 220l44-70 56 6a76 22 0 0 0 86 0l56-6 44 70 16 280-32 240-110 28-110-28-32-240Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M395 156a76 22 0 0 0 86 0" fill="none" stroke="${p.accent}" stroke-width="10"/>`;

SIL.sundress = (p) => SIL.dress_midi(p);
SIL.cocktail_dress = (p) => SIL.dress_mini(p);
SIL.sweater_dress = (p) => SIL.dress_midi(p);
SIL.tshirt_dress = (p) => SIL.dress_midi(p);

// ── BOTTOM family ─────────────────────────────────────────────────────────
SIL.trousers = (p) => `
  <path d="M310 150h280l36 615H501l-51-420-51 420H274l36-615Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M310 150h280v94H310z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M450 244v520" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>`;

SIL.jeans = (p) => `${SIL.trousers(p)}
  <path d="M312 320l-36 440M588 320l36 440" stroke="${p.accent}" stroke-width="4" opacity="0.6"/>
  <path d="M310 244h280" stroke="${p.accent}" stroke-width="6"/>`;

SIL.high_waist_jeans = (p) => `
  <path d="M308 100h284l36 670H501l-51-460-51 460H272l36-670Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M308 100h284v122H308z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M450 222v540" stroke="${p.accent}" stroke-width="10"/>
  <path d="M308 192h284" stroke="${p.accent}" stroke-width="6"/>`;

SIL.shorts = (p) => `
  <path d="M270 235h360l42 330H507l-57-190-57 190H228l42-330Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M270 235h360v82H270z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M450 317v236" stroke="${p.accent}" stroke-width="12" stroke-linecap="round"/>`;

SIL.athletic_shorts = (p) => `${SIL.shorts(p)}
  <path d="M270 480q30 30 90 0t90 0t90 0t90 0" fill="none" stroke="${p.accent}" stroke-width="6" opacity="0.7"/>`;

SIL.bike_shorts = (p) => `
  <path d="M310 240h280l28 380H504l-54-250-54 250H282l28-380Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M310 240h280v62H310z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M450 302v316" stroke="${p.accent}" stroke-width="10"/>`;

SIL.leggings = (p) => `
  <path d="M324 160h252l30 610H510l-60-450-60 450H294l30-610Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M324 160h252v60H324z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M450 220v540" stroke="${p.accent}" stroke-width="6"/>`;

SIL.skirt_aline = (p) => `
  <path d="M338 200h224l108 540q-220 50 -440 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M338 200h224v60H338z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M260 660q190 40 380 0" fill="none" stroke="${p.accent}" stroke-width="6" opacity="0.6"/>`;

SIL.skirt_pencil = (p) => `
  <path d="M340 200h220l30 560q-140 30 -280 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M340 200h220v60H340z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M450 260v500" stroke="${p.accent}" stroke-width="5"/>`;

SIL.skirt_mini = (p) => `${SIL.skirt_aline(p).replace("540","240")}`;
SIL.skirt_midi = (p) => SIL.skirt_aline(p);
SIL.skirt_maxi = (p) => `${SIL.skirt_aline(p).replace("540","640")}`;

SIL.skirt_pleated = (p) => `${SIL.skirt_aline(p)}
  <path d="M380 280v440M420 290v440M460 290v440M500 290v440M540 280v440" stroke="${p.accent}" stroke-width="4" opacity="0.7"/>`;

SIL.skirt_wrap = (p) => `${SIL.skirt_aline(p)}
  <path d="M340 220 480 600 660 440" fill="none" stroke="${p.accent}" stroke-width="12" stroke-linecap="round"/>`;

SIL.tennis_skirt = (p) => `${SIL.skirt_pleated(p).replace("540","220")}`;

SIL.culottes = (p) => `${SIL.trousers(p).replace("615","440")}`;
SIL.palazzo = (p) => `
  <path d="M280 150h340l60 615H530l-72-420-72 420H220l60-615Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M280 150h340v94H280z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>`;
SIL.wide_leg = (p) => SIL.palazzo(p);
SIL.cigarette = (p) => SIL.trousers(p).replace("36 615","20 615");
SIL.capri = (p) => SIL.trousers(p).replace("615","420");
SIL.joggers = (p) => `${SIL.trousers(p)}
  <path d="M278 750q60 -16 88 0M534 750q28 16 88 0" stroke="${p.accent}" stroke-width="10" fill="none"/>`;
SIL.cargo = (p) => `${SIL.trousers(p)}
  <rect x="312" y="380" width="92" height="120" fill="none" stroke="${p.accent}" stroke-width="6"/>
  <rect x="496" y="380" width="92" height="120" fill="none" stroke="${p.accent}" stroke-width="6"/>`;
SIL.corduroy = (p) => `${SIL.trousers(p)}
  <path d="M334 244v520M376 244v520M418 244v520M460 244v520M502 244v520M544 244v520M586 244v520" stroke="${p.accent}" stroke-width="2.5" opacity="0.5"/>`;

// ── OUTER family ──────────────────────────────────────────────────────────
SIL.blazer = (p) => `
  <path d="M232 252l92-112h252l92 112 28 280-96 14-32-180v420H388V366l-32 180-96-14 28-280Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M388 152 388 240 450 320 512 240 512 152" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linejoin="round"/>
  <path d="M450 320v360" stroke="${p.accent}" stroke-width="6"/>
  <circle cx="430" cy="380" r="6" fill="${p.accent}"/>
  <circle cx="430" cy="450" r="6" fill="${p.accent}"/>
  <rect x="324" y="540" width="80" height="58" fill="none" stroke="${p.accent}" stroke-width="6"/>
  <rect x="496" y="540" width="80" height="58" fill="none" stroke="${p.accent}" stroke-width="6"/>`;

SIL.overcoat = (p) => `
  <path d="M232 240l84-100h268l84 100 36 540H394V378l-22 180-130-22Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M384 144 384 220 450 280 516 220 516 144" fill="none" stroke="${p.accent}" stroke-width="10"/>
  <path d="M450 280v500" stroke="${p.accent}" stroke-width="6"/>
  <circle cx="430" cy="340" r="6" fill="${p.accent}"/>
  <circle cx="430" cy="410" r="6" fill="${p.accent}"/>
  <circle cx="430" cy="480" r="6" fill="${p.accent}"/>
  <circle cx="430" cy="550" r="6" fill="${p.accent}"/>`;

SIL.trench = (p) => `${SIL.overcoat(p)}
  <rect x="350" y="290" width="200" height="60" fill="${p.accent}" opacity="0.18"/>
  <rect x="320" y="500" width="80" height="36" fill="none" stroke="${p.accent}" stroke-width="5"/>
  <rect x="500" y="500" width="80" height="36" fill="none" stroke="${p.accent}" stroke-width="5"/>`;

SIL.parka = (p) => `
  <path d="M232 244l84-110q24-32 60-32h148q36 0 60 32l84 110 36 540H394V378l-22 180-130-22Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M376 134q-22 32-22 70q0 32 30 50q34 18 66 18q32 0 66-18q30-18 30-50q0-38-22-70" fill="${p.accent}" opacity="0.55" stroke="${p.stroke}" stroke-width="14"/>
  <path d="M450 256v520" stroke="${p.accent}" stroke-width="6"/>
  <path d="M268 580q40 -10 90 -2M642 580q-40 -10 -90 -2" stroke="${p.accent}" stroke-width="6" fill="none"/>`;

SIL.puffer = (p) => `
  <path d="M232 244l84-100h268l84 100 36 540H394V378l-22 180-130-22Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M232 320q220 28 436 0M232 410q220 28 436 0M232 510q220 28 436 0M232 610q220 28 436 0M232 710q220 28 436 0" stroke="${p.accent}" stroke-width="5" fill="none" opacity="0.62"/>`;

SIL.bomber = (p) => `
  <path d="M232 252l92-110h252l92 110 28 470H260Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M260 720h380l-10 90q-180 30 -360 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M232 252h640" stroke="${p.accent}" stroke-width="6"/>
  <path d="M450 142v580" stroke="${p.accent}" stroke-width="6"/>`;

SIL.windbreaker = (p) => SIL.bomber(p);
SIL.shell_jacket = (p) => SIL.windbreaker(p);
SIL.rain_jacket = (p) => `${SIL.parka(p)}`;

SIL.field_jacket = (p) => `${SIL.bomber(p)}
  <rect x="320" y="320" width="100" height="80" fill="none" stroke="${p.accent}" stroke-width="6"/>
  <rect x="480" y="320" width="100" height="80" fill="none" stroke="${p.accent}" stroke-width="6"/>
  <rect x="320" y="480" width="100" height="80" fill="none" stroke="${p.accent}" stroke-width="6"/>
  <rect x="480" y="480" width="100" height="80" fill="none" stroke="${p.accent}" stroke-width="6"/>`;

SIL.leather_jacket = (p) => `${SIL.bomber(p)}
  <path d="M450 142 360 252 540 252Z" fill="${p.accent}" opacity="0.5"/>
  <path d="M450 252v420" stroke="${p.accent}" stroke-width="6"/>`;

SIL.fleece = (p, mat) => SIL.knit_sweater(p, "knit");
SIL.shacket = (p) => SIL.button_up(p);
SIL.overshirt = (p) => SIL.button_up(p);
SIL.chore_coat = (p) => SIL.field_jacket(p);
SIL.duffle_coat = (p) => `${SIL.overcoat(p)}
  <path d="M404 350h-30l30 8M404 420h-30l30 8M404 490h-30l30 8M404 560h-30l30 8" stroke="${p.accent}" stroke-width="6" fill="none"/>`;
SIL.pea_coat = (p) => SIL.overcoat(p);
SIL.denim_jacket = (p) => `${SIL.bomber(p)}
  <path d="M260 380h380M260 460h380" stroke="${p.accent}" stroke-width="4" opacity="0.6"/>
  <rect x="320" y="420" width="80" height="40" fill="none" stroke="${p.accent}" stroke-width="5"/>
  <rect x="500" y="420" width="80" height="40" fill="none" stroke="${p.accent}" stroke-width="5"/>`;

SIL.quilted_vest = (p) => `
  <path d="M310 200l-30 580H394V378l-22 180-130-22ZM590 200l30 580H506V378l22 180 130-22Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M310 200h280v50H310z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M310 320q140 16 280 0M310 420q140 16 280 0M310 520q140 16 280 0" stroke="${p.accent}" stroke-width="5" fill="none" opacity="0.6"/>`;

SIL.wrap_coat = (p) => `${SIL.overcoat(p)}
  <path d="M340 260 460 460 580 260" fill="none" stroke="${p.accent}" stroke-width="14" stroke-linecap="round"/>`;

SIL.cropped_jacket = (p) => `${SIL.blazer(p).replace("420","260")}`;
SIL.faux_fur_coat = (p, mat) => `${SIL.overcoat(p)}
  ${mat ? `<path d="M232 240l84-100h268l84 100 36 540H394V378l-22 180-130-22Z" fill="url(#tex)" stroke="none"/>` : ""}`;

SIL.cape = (p) => `
  <path d="M280 220l-50 540q220 60 440 0l-50-540 -90 -40 -160 0 -90 40Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M380 200a60 24 0 0 0 140 0" fill="none" stroke="${p.accent}" stroke-width="8"/>`;

SIL.poncho = (p) => `
  <path d="M180 220l270 -60 270 60 -50 580H230Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M380 220l70 80 70 -80" fill="none" stroke="${p.accent}" stroke-width="10"/>`;

SIL.kimono = (p) => `
  <path d="M260 200l-30 560 200 -20 0 -380 80 -100 0 -60 -100 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14" stroke-linejoin="round"/>
  <path d="M640 200l30 560 -200 -20 0 -380 -80 -100 0 -60 100 0Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14" stroke-linejoin="round"/>
  <path d="M450 200v540" stroke="${p.accent}" stroke-width="10"/>`;

SIL.duster_coat = (p) => `${SIL.overcoat(p).replace("780","880")}`;

// ── SHOES family ──────────────────────────────────────────────────────────
SIL.sneaker = (p) => `
  <path d="M180 540q40 -180 180 -180h160q60 0 80 50l140 90q80 50 60 110q-10 30 -60 30H180Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M180 580h580" stroke="${p.accent}" stroke-width="14"/>
  <path d="M380 380l40 50M460 360l40 60M540 360l40 70" stroke="${p.accent}" stroke-width="6"/>`;

SIL.running_shoe = (p) => `${SIL.sneaker(p)}
  <path d="M200 520q60 -10 120 0t120 0t120 0t140 0" stroke="${p.accent}" stroke-width="6" fill="none" opacity="0.7"/>`;

SIL.trail_runner = (p) => `${SIL.running_shoe(p)}
  <path d="M180 580 q80 30 180 0 q80 -30 180 0 q80 30 220 0" stroke="${p.accent}" stroke-width="10" fill="none"/>`;

SIL.loafer = (p) => `
  <path d="M180 540q40 -160 180 -160h220q120 0 160 90q20 50 -10 80 -30 30 -90 30H180Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M280 460h180" stroke="${p.accent}" stroke-width="8"/>
  <path d="M340 430h60q10 0 10 12 0 12 -10 12h-60q-10 0 -10 -12 0 -12 10 -12Z" fill="${p.accent}" opacity="0.6"/>`;

SIL.oxford = (p) => `${SIL.loafer(p)}
  <path d="M280 460l60 -30 80 30 80 -30 60 30" fill="none" stroke="${p.accent}" stroke-width="6"/>
  <path d="M380 480v40M420 480v40M460 480v40M500 480v40" stroke="${p.accent}" stroke-width="4"/>`;

SIL.derby = (p) => SIL.oxford(p);
SIL.brogue = (p) => `${SIL.oxford(p)}
  <circle cx="320" cy="500" r="3" fill="${p.accent}"/>
  <circle cx="350" cy="500" r="3" fill="${p.accent}"/>
  <circle cx="380" cy="500" r="3" fill="${p.accent}"/>
  <circle cx="540" cy="500" r="3" fill="${p.accent}"/>
  <circle cx="570" cy="500" r="3" fill="${p.accent}"/>`;

SIL.boot = (p) => `
  <path d="M260 200h140v340q60 -10 220 30 q80 20 80 70 t-60 60H260Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M260 540h420" stroke="${p.accent}" stroke-width="14"/>
  <path d="M260 600h420" stroke="${p.accent}" stroke-width="6"/>`;

SIL.ankle_boot = (p) => SIL.boot(p);
SIL.chelsea_boot = (p) => `${SIL.boot(p)}
  <path d="M400 220h60v300h-60Z" fill="${p.accent}" opacity="0.45"/>`;
SIL.chukka_boot = (p) => `${SIL.boot(p)}
  <path d="M280 280l60 -30 80 30 80 -30 60 30" fill="none" stroke="${p.accent}" stroke-width="5"/>`;
SIL.hiking_boot = (p) => `${SIL.boot(p)}
  <path d="M260 600 q60 30 130 0 q60 -30 130 0 q60 30 160 0" stroke="${p.accent}" stroke-width="10" fill="none"/>`;
SIL.combat_boot = (p) => SIL.hiking_boot(p);
SIL.winter_boot = (p) => `${SIL.boot(p)}
  <path d="M260 200 q140 -30 280 0" stroke="${p.accent}" stroke-width="14" fill="none"/>`;
SIL.rain_boot = (p) => SIL.boot(p);
SIL.knee_boot = (p) => `
  <path d="M280 100h130v440q60 -10 200 30 q80 20 80 70 t-60 60H280Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M280 540h420" stroke="${p.accent}" stroke-width="14"/>`;
SIL.riding_boot = (p) => SIL.knee_boot(p);

SIL.heel = (p) => `
  <path d="M180 540q40 -120 180 -120h160q120 0 160 80q20 40 -10 60 -30 20 -90 20H180Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16" stroke-linejoin="round"/>
  <path d="M580 540l40 220 -50 0 -30 -180Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16" stroke-linejoin="round"/>
  <path d="M180 580h420" stroke="${p.accent}" stroke-width="10"/>`;

SIL.stiletto = (p) => `${SIL.heel(p)}
  <path d="M620 580l24 220 -36 0 -16 -200Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.kitten_heel = (p) => `${SIL.heel(p).replace("220","120")}`;
SIL.block_heel = (p) => `${SIL.heel(p).replace("40 220","60 200")}`;
SIL.pump = (p) => SIL.heel(p);
SIL.mary_jane = (p) => `${SIL.heel(p)}
  <path d="M260 460h220" stroke="${p.accent}" stroke-width="10"/>`;

SIL.ballet_flat = (p) => `
  <path d="M180 560q40 -100 180 -100h180q120 0 160 60q20 30 -10 50 -30 20 -90 20H180Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16" stroke-linejoin="round"/>
  <path d="M180 580h440" stroke="${p.accent}" stroke-width="8"/>
  <path d="M340 480h60q10 0 10 10 0 10 -10 10h-60q-10 0 -10 -10 0 -10 10 -10Z" fill="${p.accent}" opacity="0.6"/>`;

SIL.mule = (p) => `
  <path d="M180 540q40 -130 180 -130h220q40 0 60 30l40 80q20 40 -20 60H180Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16" stroke-linejoin="round"/>
  <path d="M180 580h440" stroke="${p.accent}" stroke-width="8"/>`;

SIL.slip_on = (p) => SIL.mule(p);

SIL.sandal = (p) => `
  <path d="M200 580h440q20 0 20 20 0 20 -20 20H200Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>
  <path d="M260 580 q40 -120 130 -120 q40 0 60 60M530 580 q-40 -120 -130 -120" stroke="${p.accent}" stroke-width="14" fill="none"/>`;

SIL.strappy_sandal = (p) => `${SIL.sandal(p)}
  <path d="M280 580 q60 -160 160 -160 M620 580 q-60 -160 -160 -160 M340 580 q40 -120 100 -120" stroke="${p.accent}" stroke-width="10" fill="none"/>`;

SIL.wedge = (p) => `
  <path d="M180 540q40 -120 180 -120h220q120 0 160 60l30 130 -30 30H180Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16" stroke-linejoin="round"/>
  <path d="M180 580h470" stroke="${p.accent}" stroke-width="8"/>`;

SIL.espadrille_wedge = (p) => `${SIL.wedge(p)}
  <path d="M180 600q60 6 130 0 q60 -6 130 0 q60 6 200 0" stroke="${p.accent}" stroke-width="6" fill="none"/>
  <path d="M180 630q60 6 130 0 q60 -6 130 0 q60 6 200 0" stroke="${p.accent}" stroke-width="6" fill="none"/>`;

SIL.espadrille = (p) => `${SIL.sneaker(p)}
  <path d="M180 600q60 6 130 0 q60 -6 130 0 q60 6 200 0" stroke="${p.accent}" stroke-width="6" fill="none"/>`;

SIL.boat_shoe = (p) => `${SIL.loafer(p)}
  <path d="M260 460 q140 -20 320 0" stroke="${p.accent}" stroke-width="6" fill="none"/>`;

SIL.slide = (p) => `
  <path d="M200 540h420q40 0 40 40 0 40 -40 40H200Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16"/>
  <path d="M260 540 q60 -80 200 -80 q60 0 100 40 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>`;

// ── ACCESSORY family ──────────────────────────────────────────────────────
SIL.watch = (p) => `
  <rect x="372" y="180" width="156" height="120" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>
  <rect x="372" y="600" width="156" height="120" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>
  <rect x="350" y="300" width="200" height="300" rx="20" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <circle cx="450" cy="450" r="100" fill="white" stroke="${p.stroke}" stroke-width="14"/>
  <path d="M450 380v70l52 30" stroke="${p.stroke}" stroke-width="10" fill="none" stroke-linecap="round"/>`;

SIL.sunglasses = (p) => `
  <path d="M150 360 q0 -40 40 -40 h220 q40 0 40 40 v100 q0 40 -40 40 h-220 q-40 0 -40 -40 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>
  <path d="M490 360 q0 -40 40 -40 h220 q40 0 40 40 v100 q0 40 -40 40 h-220 q-40 0 -40 -40 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>
  <path d="M410 360 q40 -10 80 0" stroke="${p.stroke}" stroke-width="14" fill="none"/>`;

SIL.beanie = (p) => `
  <path d="M260 380q0 -200 190 -200 t190 200 v60 H260 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <rect x="240" y="430" width="420" height="100" rx="20" fill="${p.accent}" stroke="${p.stroke}" stroke-width="18"/>`;

SIL.baseball_cap = (p) => `
  <path d="M260 360q0 -180 190 -180 t190 180 v40 H260 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M260 400 q -120 30 -150 90 q -10 30 30 30 h720 q40 0 30 -30 q -30 -60 -150 -90 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <circle cx="450" cy="280" r="20" fill="${p.accent}"/>`;

SIL.sun_hat = (p) => `
  <ellipse cx="450" cy="500" rx="380" ry="80" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M280 500q0 -240 170 -240t170 240" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M280 500q0 -10 170 -10t170 10" stroke="${p.accent}" stroke-width="14"/>`;

SIL.fedora = (p) => `
  <ellipse cx="450" cy="500" rx="320" ry="60" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M310 500q0 -260 140 -260t140 260" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M310 480q140 30 280 0" stroke="${p.accent}" stroke-width="20"/>
  <path d="M450 280 v -10" stroke="${p.accent}" stroke-width="14"/>`;

SIL.bucket_hat = (p) => `
  <path d="M280 380q0 -160 170 -160t170 160 v 40 H280Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M240 420q0 -10 210 -10t210 10v40q0 30 -210 30t-210 -30Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>`;

SIL.beret = (p) => `
  <ellipse cx="450" cy="380" rx="270" ry="200" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <ellipse cx="450" cy="540" rx="240" ry="50" fill="${p.accent}" stroke="${p.stroke}" stroke-width="16"/>
  <circle cx="450" cy="200" r="22" fill="${p.accent}"/>`;

SIL.scarf = (p) => `
  <path d="M180 240h540l-30 380 -240 80 -240 -80Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M180 240h540" stroke="${p.accent}" stroke-width="14"/>
  <path d="M280 380h340 M280 460h340 M280 540h340" stroke="${p.accent}" stroke-width="6" opacity="0.5"/>`;

SIL.tie = (p) => `
  <path d="M390 180h120l-30 80 60 60 -90 460 -90 -460 60 -60Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14" stroke-linejoin="round"/>
  <path d="M390 180h120l-30 80 -60 0 z" fill="${p.accent}" stroke="${p.stroke}" stroke-width="12"/>`;

SIL.bow_tie = (p) => `
  <path d="M180 360 l 200 -80 60 70 -60 70 -200 -80 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14" stroke-linejoin="round"/>
  <path d="M720 360 l -200 -80 -60 70 60 70 200 -80 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14" stroke-linejoin="round"/>
  <rect x="410" y="320" width="80" height="80" rx="6" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.pocket_square = (p) => `
  <rect x="240" y="240" width="420" height="420" rx="14" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M240 240 L660 660 M660 240 L240 660" stroke="${p.accent}" stroke-width="6" opacity="0.4"/>`;

SIL.belt = (p) => `
  <rect x="120" y="380" width="660" height="80" rx="6" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <rect x="380" y="350" width="140" height="140" rx="14" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>
  <rect x="416" y="386" width="68" height="68" rx="8" fill="none" stroke="${p.stroke}" stroke-width="10"/>`;

SIL.tote_bag = (p) => `
  <path d="M240 320h420v360H240Z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M310 320 q30 -150 140 -150 t140 150" fill="none" stroke="${p.stroke}" stroke-width="18"/>`;

SIL.backpack = (p) => `
  <rect x="280" y="240" width="340" height="500" rx="40" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <rect x="320" y="380" width="260" height="180" rx="14" fill="${p.accent}" opacity="0.45" stroke="${p.stroke}" stroke-width="12"/>
  <path d="M340 240 q-30 -80 110 -80 t110 80" fill="none" stroke="${p.stroke}" stroke-width="18"/>`;

SIL.crossbody_bag = (p) => `
  <rect x="280" y="340" width="340" height="280" rx="20" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M280 340 q170 -240 340 0" fill="none" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.belt_bag = (p) => `
  <rect x="240" y="360" width="420" height="220" rx="40" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M240 460 q60 -10 420 0" stroke="${p.accent}" stroke-width="6" fill="none"/>`;

SIL.clutch = (p) => `
  <rect x="180" y="380" width="540" height="180" rx="14" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M180 460 h540" stroke="${p.accent}" stroke-width="8"/>
  <circle cx="450" cy="460" r="14" fill="${p.accent}" stroke="${p.stroke}" stroke-width="8"/>`;

SIL.mini_bag = (p) => `
  <rect x="320" y="320" width="260" height="260" rx="20" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M340 320 q40 -120 110 -120 t110 120" fill="none" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.hobo_bag = (p) => `
  <path d="M180 360 q140 -80 540 0 q40 200 -40 360 q-100 80 -460 0 q-80 -160 -40 -360 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M260 350 q140 -180 380 0" fill="none" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.bucket_bag = (p) => `
  <path d="M280 320h340 l30 360 -200 70 -200 -70 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18" stroke-linejoin="round"/>
  <path d="M310 320 q30 -120 140 -120 t140 120" fill="none" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.umbrella = (p) => `
  <path d="M140 460 q310 -460 620 0 q-50 30 -90 0 q-50 -40 -90 0 q-50 40 -90 0 q-50 -40 -90 0 q-50 40 -90 0 q-50 -40 -90 0 q-50 40 -80 0 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>
  <path d="M450 460 v200 q0 30 30 30 q30 0 30 -30" fill="none" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.gloves = (p) => `
  <path d="M260 220 v300 q0 60 80 60 v140 h200 v-140 q80 0 80 -60 v-260 h-40 v200 h-30 v-220 h-30 v220 h-30 v-220 h-30 v220 h-30 v-220 h-30 v240 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14" stroke-linejoin="round"/>`;

SIL.socks = (p) => `
  <rect x="320" y="200" width="260" height="380" rx="14" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M320 580 v 80 q 0 40 40 40 h 220 q 40 0 40 -40 v -80 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M320 280 h 260" stroke="${p.accent}" stroke-width="6"/>`;

SIL.necklace = (p) => `
  <path d="M180 240 q270 240 540 0" fill="none" stroke="${p.stroke}" stroke-width="14"/>
  <circle cx="450" cy="500" r="40" fill="${p.fill}" stroke="${p.stroke}" stroke-width="12"/>`;

SIL.pendant_necklace = (p) => SIL.necklace(p);
SIL.statement_necklace = (p) => `${SIL.necklace(p)}
  <ellipse cx="450" cy="540" rx="120" ry="60" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.bracelet = (p) => `
  <ellipse cx="450" cy="450" rx="240" ry="80" fill="none" stroke="${p.fill}" stroke-width="40"/>
  <ellipse cx="450" cy="450" rx="240" ry="80" fill="none" stroke="${p.stroke}" stroke-width="14"/>`;

SIL.charm_bracelet = (p) => `${SIL.bracelet(p)}
  <circle cx="380" cy="540" r="20" fill="${p.fill}" stroke="${p.stroke}" stroke-width="8"/>
  <circle cx="450" cy="560" r="20" fill="${p.fill}" stroke="${p.stroke}" stroke-width="8"/>
  <circle cx="520" cy="540" r="20" fill="${p.fill}" stroke="${p.stroke}" stroke-width="8"/>`;

SIL.earrings = (p) => `
  <circle cx="350" cy="320" r="36" fill="${p.fill}" stroke="${p.stroke}" stroke-width="12"/>
  <circle cx="550" cy="320" r="36" fill="${p.fill}" stroke="${p.stroke}" stroke-width="12"/>
  <path d="M350 360 v160 M550 360 v160" stroke="${p.stroke}" stroke-width="10"/>
  <circle cx="350" cy="540" r="28" fill="${p.fill}" stroke="${p.stroke}" stroke-width="10"/>
  <circle cx="550" cy="540" r="28" fill="${p.fill}" stroke="${p.stroke}" stroke-width="10"/>`;

SIL.hoop_earrings = (p) => `
  <circle cx="350" cy="450" r="100" fill="none" stroke="${p.fill}" stroke-width="20"/>
  <circle cx="350" cy="450" r="100" fill="none" stroke="${p.stroke}" stroke-width="6"/>
  <circle cx="550" cy="450" r="100" fill="none" stroke="${p.fill}" stroke-width="20"/>
  <circle cx="550" cy="450" r="100" fill="none" stroke="${p.stroke}" stroke-width="6"/>`;

SIL.pearl_earrings = (p) => `
  <circle cx="350" cy="450" r="60" fill="${p.fill}" stroke="${p.stroke}" stroke-width="10"/>
  <circle cx="550" cy="450" r="60" fill="${p.fill}" stroke="${p.stroke}" stroke-width="10"/>
  <circle cx="335" cy="430" r="14" fill="white" opacity="0.7"/>
  <circle cx="535" cy="430" r="14" fill="white" opacity="0.7"/>`;

SIL.brooch = (p) => `
  <circle cx="450" cy="450" r="120" fill="${p.fill}" stroke="${p.stroke}" stroke-width="14"/>
  <circle cx="450" cy="450" r="60" fill="${p.accent}" stroke="${p.stroke}" stroke-width="10"/>
  <path d="M330 450h-60 M570 450h60 M450 330v-60 M450 570v60" stroke="${p.stroke}" stroke-width="10"/>`;

SIL.hair_clip = (p) => `
  <rect x="180" y="380" width="540" height="80" rx="40" fill="${p.fill}" stroke="${p.stroke}" stroke-width="18"/>
  <path d="M180 420 q540 -10 540 0" stroke="${p.accent}" stroke-width="6"/>`;

SIL.headband = (p) => `
  <path d="M180 460 q270 -260 540 0 q-30 30 -60 0 q-210 -180 -420 0 q-30 30 -60 0 z" fill="${p.fill}" stroke="${p.stroke}" stroke-width="16"/>`;

SIL.hair_scarf = SIL.scarf;

// ─── Mapping: catalog item name → silhouette fn ──────────────────────────
const MAP = {
  // tops
  "t-shirt": SIL.tee, "tee": SIL.tee, "graphic tee": SIL.tee, "performance tee": SIL.tee, "knit tee": SIL.tee,
  "long-sleeve t-shirt": SIL.long_sleeve_tee, "long sleeve t-shirt": SIL.long_sleeve_tee,
  "polo shirt": SIL.polo, "polo": SIL.polo,
  "button-up shirt": SIL.button_up, "button up shirt": SIL.button_up, "linen shirt": SIL.button_up,
  "long-sleeve linen shirt": SIL.button_up, "oxford shirt": SIL.button_up, "chambray shirt": SIL.button_up,
  "flannel shirt": SIL.button_up, "rugby shirt": SIL.button_up, "camp shirt": SIL.button_up,
  "henley": SIL.henley,
  "knit sweater": SIL.knit_sweater, "cashmere sweater": SIL.knit_sweater,
  "merino crewneck": SIL.knit_sweater, "wool turtleneck": SIL.turtleneck, "mock-neck top": SIL.turtleneck,
  "thermal base layer": SIL.long_sleeve_tee, "sweatshirt": SIL.knit_sweater,
  "hoodie": SIL.hoodie, "zip hoodie": SIL.hoodie,
  "tank top": SIL.tank, "camisole": SIL.camisole, "halter top": SIL.halter,
  "off-shoulder top": SIL.tank, "crop top": SIL.crop_top, "bodysuit": SIL.bodysuit,
  "tunic": SIL.tunic, "blouse": SIL.blouse, "silk blouse": SIL.blouse,
  "wrap blouse": SIL.wrap_blouse, "ruffled blouse": SIL.blouse, "peplum top": SIL.peplum_top,
  "cardigan": SIL.cardigan, "knit cardigan": SIL.cardigan, "long cardigan": SIL.cardigan,
  // dresses (stored under top slot)
  "wrap dress": SIL.dress_wrap, "slip dress": SIL.dress_slip, "sundress": SIL.sundress,
  "midi dress": SIL.dress_midi, "maxi dress": SIL.dress_maxi, "mini dress": SIL.dress_mini,
  "sheath dress": SIL.dress_sheath, "shirtdress": SIL.shirtdress, "cocktail dress": SIL.cocktail_dress,
  "sweater dress": SIL.sweater_dress, "t-shirt dress": SIL.tshirt_dress, "bodycon dress": SIL.bodycon,

  // bottoms
  "jeans": SIL.jeans, "slim jeans": SIL.jeans, "relaxed jeans": SIL.jeans,
  "black jeans": SIL.jeans, "high-waist jeans": SIL.high_waist_jeans, "mom jeans": SIL.high_waist_jeans,
  "chinos": SIL.trousers, "slim chinos": SIL.trousers, "lightweight chinos": SIL.trousers,
  "tailored trousers": SIL.trousers, "wool trousers": SIL.trousers, "linen trousers": SIL.trousers,
  "wide-leg trousers": SIL.wide_leg, "pleated trousers": SIL.trousers, "cigarette pants": SIL.cigarette,
  "capri pants": SIL.capri, "culottes": SIL.culottes, "palazzo pants": SIL.palazzo,
  "joggers": SIL.joggers, "tech joggers": SIL.joggers, "track pants": SIL.joggers,
  "leggings": SIL.leggings,
  "athletic shorts": SIL.athletic_shorts, "running shorts": SIL.athletic_shorts,
  "cotton shorts": SIL.shorts, "linen shorts": SIL.shorts, "denim shorts": SIL.shorts, "bike shorts": SIL.bike_shorts,
  "cargo pants": SIL.cargo, "corduroy pants": SIL.corduroy,
  // skirts
  "a-line skirt": SIL.skirt_aline, "pencil skirt": SIL.skirt_pencil,
  "midi skirt": SIL.skirt_midi, "mini skirt": SIL.skirt_mini, "maxi skirt": SIL.skirt_maxi,
  "pleated skirt": SIL.skirt_pleated, "wrap skirt": SIL.skirt_wrap,
  "denim skirt": SIL.skirt_aline, "leather skirt": SIL.skirt_pencil, "tennis skirt": SIL.tennis_skirt,

  // outer
  "blazer": SIL.blazer, "tailored blazer": SIL.blazer, "lightweight blazer": SIL.blazer,
  "wool overcoat": SIL.overcoat, "trench coat": SIL.trench, "pea coat": SIL.pea_coat, "duffle coat": SIL.duffle_coat,
  "parka": SIL.parka, "hooded parka": SIL.parka, "insulated parka": SIL.parka,
  "down jacket": SIL.puffer, "puffer jacket": SIL.puffer,
  "bomber jacket": SIL.bomber, "field jacket": SIL.field_jacket, "leather jacket": SIL.leather_jacket,
  "windbreaker": SIL.windbreaker, "rain jacket": SIL.rain_jacket,
  "shell jacket": SIL.shell_jacket, "tech shell": SIL.shell_jacket,
  "fleece jacket": SIL.fleece, "shacket": SIL.shacket, "overshirt": SIL.overshirt,
  "denim jacket": SIL.denim_jacket, "chore coat": SIL.chore_coat,
  "quilted vest": SIL.quilted_vest,
  "wrap coat": SIL.wrap_coat, "cropped jacket": SIL.cropped_jacket, "faux fur coat": SIL.faux_fur_coat,
  "cape": SIL.cape, "poncho": SIL.poncho, "kimono": SIL.kimono, "duster coat": SIL.duster_coat,

  // shoes
  "sneakers": SIL.sneaker, "white sneakers": SIL.sneaker, "black sneakers": SIL.sneaker,
  "canvas sneakers": SIL.sneaker, "leather sneakers": SIL.sneaker,
  "running shoes": SIL.running_shoe, "performance runners": SIL.running_shoe, "trail runners": SIL.trail_runner,
  "loafers": SIL.loafer, "penny loafers": SIL.loafer, "tassel loafers": SIL.loafer,
  "suede loafers": SIL.loafer, "brown loafers": SIL.loafer,
  "oxford shoes": SIL.oxford, "derby shoes": SIL.derby, "brogues": SIL.brogue,
  "chelsea boots": SIL.chelsea_boot, "chukka boots": SIL.chukka_boot,
  "hiking boots": SIL.hiking_boot, "winter boots": SIL.winter_boot,
  "ankle boots": SIL.ankle_boot, "combat boots": SIL.combat_boot, "rain boots": SIL.rain_boot,
  "knee-high boots": SIL.knee_boot, "riding boots": SIL.riding_boot,
  "espadrilles": SIL.espadrille, "boat shoes": SIL.boat_shoe, "slip-ons": SIL.slip_on,
  "slides": SIL.slide, "sandals": SIL.sandal,
  "heels": SIL.heel, "stiletto heels": SIL.stiletto, "kitten heels": SIL.kitten_heel,
  "block heels": SIL.block_heel, "pumps": SIL.pump,
  "ballet flats": SIL.ballet_flat, "mary janes": SIL.mary_jane, "mules": SIL.mule,
  "wedge sandals": SIL.wedge, "strappy sandals": SIL.strappy_sandal, "espadrille wedges": SIL.espadrille_wedge,

  // accessories
  "watch": SIL.watch, "sunglasses": SIL.sunglasses,
  "beanie": SIL.beanie, "wool beanie": SIL.beanie,
  "baseball cap": SIL.baseball_cap, "sports cap": SIL.baseball_cap,
  "sun hat": SIL.sun_hat, "wide-brim hat": SIL.sun_hat,
  "fedora": SIL.fedora, "bucket hat": SIL.bucket_hat, "beret": SIL.beret,
  "scarf": SIL.scarf, "wool scarf": SIL.scarf, "silk scarf": SIL.scarf, "hair scarf": SIL.hair_scarf,
  "tie": SIL.tie, "bow tie": SIL.bow_tie, "pocket square": SIL.pocket_square,
  "belt": SIL.belt, "leather belt": SIL.belt,
  "tote bag": SIL.tote_bag, "backpack": SIL.backpack,
  "crossbody bag": SIL.crossbody_bag, "crossbody handbag": SIL.crossbody_bag,
  "belt bag": SIL.belt_bag,
  "clutch": SIL.clutch, "mini bag": SIL.mini_bag, "hobo bag": SIL.hobo_bag, "bucket bag": SIL.bucket_bag,
  "umbrella": SIL.umbrella, "compact umbrella": SIL.umbrella,
  "gloves": SIL.gloves, "leather gloves": SIL.gloves, "wool gloves": SIL.gloves,
  "wool socks": SIL.socks,
  "necklace": SIL.necklace, "pendant necklace": SIL.pendant_necklace, "statement necklace": SIL.statement_necklace,
  "bracelet": SIL.bracelet, "stacked bracelets": SIL.bracelet, "charm bracelet": SIL.charm_bracelet,
  "pearl earrings": SIL.pearl_earrings, "hoop earrings": SIL.hoop_earrings, "drop earrings": SIL.earrings,
  "brooch": SIL.brooch,
  "hair clip": SIL.hair_clip, "headband": SIL.headband,
};

// Slot fallbacks for unmapped items
const SLOT_FALLBACK = {
  top: SIL.tee,
  bottom: SIL.trousers,
  outer: SIL.bomber,
  shoes: SIL.sneaker,
  accessory: SIL.tote_bag,
};

function silhouetteFor(slot, item) {
  const key = String(item || "").toLowerCase().trim();
  const fn = MAP[key];
  if (fn) return { fn, key };
  return { fn: SLOT_FALLBACK[slot] || SIL.tee, key: "fallback" };
}

function generate({ slot, item, color, material, gender, label }) {
  const palette = paletteFor(color);
  const sil = silhouetteFor(slot, item);
  const matPattern = materialPattern(material, palette.accent, "tex");
  const fnArity = sil.fn.length;
  const body = fnArity > 1 ? sil.fn(palette, material) : sil.fn(palette);
  const ariaLabel = label || `${color || ""} ${material || ""} ${item || ""}`.trim();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900" role="img" aria-label="${ariaLabel.replace(/"/g, "&quot;")}">
  ${matPattern ? `<defs>${matPattern}</defs>` : ""}
  <rect width="900" height="900" fill="${palette.bg}"/>
  ${body}
</svg>`;
}

module.exports = { generate, paletteFor, silhouetteFor, PALETTES, SIL };
