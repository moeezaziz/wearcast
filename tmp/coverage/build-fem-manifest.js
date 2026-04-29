// Focused feminine-catalog manifest: one entry per (silhouette × small set of
// base colors). Aim ~120 rows, not 5000 — Commons doesn't have hyper-specific
// stock for women's "burgundy silk peplum top" anyway, and the matcher's
// gender boost will route real LLM outputs to the closest gendered entry.
"use strict";
const fs = require("fs");
const path = require("path");

// Each entry: { slot, item, defaultMaterial, baseColors }
// baseColors are limited to 2-3 (the colors photographers actually shoot).
const SILHOUETTES = [
  // --- Tops ---
  { slot: "top", item: "Blouse", material: "silk", colors: ["white","black","cream","navy"] },
  { slot: "top", item: "Silk blouse", material: "silk", colors: ["white","black","cream"] },
  { slot: "top", item: "Wrap blouse", material: "silk", colors: ["black","navy","cream"] },
  { slot: "top", item: "Camisole", material: "silk", colors: ["black","cream","navy"] },
  { slot: "top", item: "Halter top", material: "silk", colors: ["black","white","red"] },
  { slot: "top", item: "Off-shoulder top", material: "cotton", colors: ["white","black","cream"] },
  { slot: "top", item: "Crop top", material: "cotton", colors: ["white","black","beige"] },
  { slot: "top", item: "Bodysuit", material: "jersey", colors: ["black","white","beige"] },
  { slot: "top", item: "Tunic", material: "linen", colors: ["white","black","cream"] },
  { slot: "top", item: "Knit cardigan", material: "wool", colors: ["cream","black","navy","beige"] },
  { slot: "top", item: "Long cardigan", material: "wool", colors: ["cream","black","beige"] },
  { slot: "top", item: "Ruffled blouse", material: "silk", colors: ["white","black","navy"] },
  { slot: "top", item: "Peplum top", material: "cotton", colors: ["white","black","navy"] },
  // --- Dresses (stored under "top" slot — outfit cards treat dress as top) ---
  { slot: "top", item: "Wrap dress", material: "jersey", colors: ["black","navy","red","green"] },
  { slot: "top", item: "Slip dress", material: "silk", colors: ["black","cream","navy"] },
  { slot: "top", item: "Sundress", material: "cotton", colors: ["white","blue","yellow","floral"] },
  { slot: "top", item: "Midi dress", material: "linen", colors: ["black","white","cream","navy"] },
  { slot: "top", item: "Maxi dress", material: "cotton", colors: ["black","white","cream"] },
  { slot: "top", item: "Mini dress", material: "cotton", colors: ["black","red","white"] },
  { slot: "top", item: "Sheath dress", material: "wool", colors: ["black","navy","red"] },
  { slot: "top", item: "Shirtdress", material: "cotton", colors: ["white","blue","khaki"] },
  { slot: "top", item: "Cocktail dress", material: "silk", colors: ["black","navy","red"] },
  { slot: "top", item: "Sweater dress", material: "wool", colors: ["black","cream","camel"] },
  { slot: "top", item: "T-shirt dress", material: "cotton", colors: ["white","black","gray"] },
  { slot: "top", item: "Bodycon dress", material: "jersey", colors: ["black","red","white"] },
  // --- Skirts ---
  { slot: "bottom", item: "A-line skirt", material: "cotton", colors: ["black","navy","beige"] },
  { slot: "bottom", item: "Pencil skirt", material: "wool", colors: ["black","navy","beige"] },
  { slot: "bottom", item: "Midi skirt", material: "cotton", colors: ["black","white","beige"] },
  { slot: "bottom", item: "Mini skirt", material: "denim", colors: ["blue","black","white"] },
  { slot: "bottom", item: "Maxi skirt", material: "linen", colors: ["black","cream","beige"] },
  { slot: "bottom", item: "Pleated skirt", material: "cotton", colors: ["black","navy","cream"] },
  { slot: "bottom", item: "Wrap skirt", material: "linen", colors: ["black","cream","navy"] },
  { slot: "bottom", item: "Denim skirt", material: "denim", colors: ["blue","black","white"] },
  { slot: "bottom", item: "Leather skirt", material: "leather", colors: ["black","brown"] },
  { slot: "bottom", item: "Tennis skirt", material: "cotton", colors: ["white","navy","black"] },
  // --- Bottoms (feminine cuts) ---
  { slot: "bottom", item: "High-waist jeans", material: "denim", colors: ["blue","black","white"] },
  { slot: "bottom", item: "Mom jeans", material: "denim", colors: ["blue","black"] },
  { slot: "bottom", item: "Wide-leg trousers", material: "wool", colors: ["black","cream","navy"] },
  { slot: "bottom", item: "Cigarette pants", material: "cotton", colors: ["black","navy","beige"] },
  { slot: "bottom", item: "Capri pants", material: "cotton", colors: ["black","white","navy"] },
  { slot: "bottom", item: "Culottes", material: "linen", colors: ["black","cream","navy"] },
  { slot: "bottom", item: "Palazzo pants", material: "linen", colors: ["black","cream","white"] },
  { slot: "bottom", item: "Bike shorts", material: "jersey", colors: ["black","navy"] },
  // --- Outer (feminine cuts) ---
  { slot: "outer", item: "Wrap coat", material: "wool", colors: ["camel","black","beige"] },
  { slot: "outer", item: "Faux fur coat", material: "faux fur", colors: ["beige","black","brown"] },
  { slot: "outer", item: "Cropped jacket", material: "wool", colors: ["black","cream","red"] },
  { slot: "outer", item: "Cape", material: "wool", colors: ["camel","black","navy"] },
  { slot: "outer", item: "Poncho", material: "wool", colors: ["beige","black","gray"] },
  { slot: "outer", item: "Kimono", material: "silk", colors: ["black","floral","cream"] },
  { slot: "outer", item: "Duster coat", material: "wool", colors: ["camel","black","navy"] },
  // --- Shoes (feminine silhouettes) ---
  { slot: "shoes", item: "Heels", material: "leather", colors: ["black","nude","red"] },
  { slot: "shoes", item: "Stiletto heels", material: "leather", colors: ["black","nude"] },
  { slot: "shoes", item: "Kitten heels", material: "leather", colors: ["black","nude"] },
  { slot: "shoes", item: "Block heels", material: "leather", colors: ["black","tan","white"] },
  { slot: "shoes", item: "Pumps", material: "leather", colors: ["black","nude","red"] },
  { slot: "shoes", item: "Ballet flats", material: "leather", colors: ["black","nude","red"] },
  { slot: "shoes", item: "Mary Janes", material: "leather", colors: ["black","red"] },
  { slot: "shoes", item: "Mules", material: "leather", colors: ["black","tan","white"] },
  { slot: "shoes", item: "Wedge sandals", material: "leather", colors: ["tan","black","gold"] },
  { slot: "shoes", item: "Strappy sandals", material: "leather", colors: ["black","gold","silver"] },
  { slot: "shoes", item: "Espadrille wedges", material: "canvas", colors: ["tan","black","white"] },
  { slot: "shoes", item: "Knee-high boots", material: "leather", colors: ["black","brown"] },
  { slot: "shoes", item: "Riding boots", material: "leather", colors: ["brown","black"] },
  // --- Accessories (feminine bias) ---
  { slot: "accessory", item: "Clutch", material: "leather", colors: ["black","gold","silver"] },
  { slot: "accessory", item: "Mini bag", material: "leather", colors: ["black","tan","red"] },
  { slot: "accessory", item: "Hobo bag", material: "leather", colors: ["black","brown","tan"] },
  { slot: "accessory", item: "Bucket bag", material: "leather", colors: ["black","tan","cream"] },
  { slot: "accessory", item: "Crossbody handbag", material: "leather", colors: ["black","tan","red"] },
  { slot: "accessory", item: "Hair clip", material: "metal", colors: ["gold","silver","tortoiseshell"] },
  { slot: "accessory", item: "Headband", material: "silk", colors: ["black","red","gold"] },
  { slot: "accessory", item: "Hair scarf", material: "silk", colors: ["red","black","navy"] },
  { slot: "accessory", item: "Pearl earrings", material: "pearl", colors: ["pearl","white"] },
  { slot: "accessory", item: "Hoop earrings", material: "gold", colors: ["gold","silver"] },
  { slot: "accessory", item: "Drop earrings", material: "gold", colors: ["gold","silver"] },
  { slot: "accessory", item: "Statement necklace", material: "metal", colors: ["gold","silver"] },
  { slot: "accessory", item: "Pendant necklace", material: "gold", colors: ["gold","silver"] },
  { slot: "accessory", item: "Brooch", material: "metal", colors: ["gold","silver"] },
  { slot: "accessory", item: "Stacked bracelets", material: "gold", colors: ["gold","silver"] },
  { slot: "accessory", item: "Charm bracelet", material: "silver", colors: ["silver","gold"] },
  { slot: "accessory", item: "Beret", material: "wool", colors: ["black","red","navy","cream"] },
];

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const rows = [];
for (const s of SILHOUETTES) {
  for (const color of s.colors) {
    rows.push({
      slot: s.slot,
      item: s.item,
      color,
      material: s.material,
      priority: "P1",                  // feminine catalog is single-priority
      gender: "feminine",
      suggestedKey: `${s.slot}_${slug(color)}_${slug(s.item)}_${slug(s.material)}_fem_v1`,
      suggestedFilename: `assets/recommendation-stock/${s.slot}-${slug(color)}-${slug(s.item)}-${slug(s.material)}-fem.jpg`,
      // Force "women" / "fashion" into the query so Commons biases toward
      // gendered photography rather than e.g. military "blouse".
      searchQuery: `women ${color} ${s.item} fashion`,
    });
  }
}

fs.writeFileSync(path.join(__dirname, "manifest-fem.json"), JSON.stringify(rows, null, 2));
console.log(`Feminine manifest: ${rows.length} rows across ${SILHOUETTES.length} silhouettes`);
console.log("Wrote manifest-fem.json");
