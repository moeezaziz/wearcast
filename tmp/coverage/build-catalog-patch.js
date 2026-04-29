// Reads tmp/coverage/downloads.json (status=ok rows) and emits a JS snippet
// of new STOCK_IMAGE_CATALOG entries ready to paste into server/index.js.
//
// Each new entry mirrors the shape used by the existing catalog: slot, path,
// description, keywords (with color and material front-loaded so the matcher
// scores them strongly).
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const downloads = require("./downloads.json");

const ok = downloads.filter((r) => r.status === "ok");
console.log(`Catalog patch source: ${ok.length} new images.`);

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

const baseKeywordsByItem = {
  // Primary noun aliases used at match time.
  "Backpack": ["backpack","rucksack","daypack"],
  "Bow tie": ["bow tie","bowtie"],
  "Bracelet": ["bracelet","bangle","cuff bracelet"],
  "Fedora": ["fedora","felt hat","trilby"],
  "Necklace": ["necklace","chain","pendant"],
  "Pocket square": ["pocket square","handkerchief"],
  "Tie": ["tie","necktie"],
  "Quilted vest": ["quilted vest","gilet","vest","puffer vest"],
  "Brogues": ["brogues","wingtips","oxford brogues"],
  "Espadrilles": ["espadrilles","canvas espadrilles"],
  "Sandals": ["sandals","leather sandals","summer sandals"],
  "Slides": ["slides","slip-on slides"],
  "Slip-ons": ["slip-ons","slip on shoes","canvas slip-ons"],
  "Cardigan": ["cardigan","button cardigan","knit cardigan"],
  "Henley": ["henley","henley shirt","henley top"],
  "Wool turtleneck": ["wool turtleneck","turtleneck","roll neck","mock turtleneck"],
  "Polo shirt": ["polo","polo shirt","collared polo"],
  "Button-up shirt": ["button-up","button-down","oxford","dress shirt","collared shirt","button-up shirt"],
  "Linen shirt": ["linen shirt","camp shirt","summer shirt","short-sleeve linen shirt"],
  "Long-sleeve linen shirt": ["long-sleeve linen shirt","long sleeve linen shirt"],
  "Long-sleeve t-shirt": ["long-sleeve t-shirt","long sleeve tee","long sleeve top"],
  "Oxford shirt": ["oxford","oxford shirt","collared shirt","button-up"],
  "Knit tee": ["knit tee","cotton knit tee","minimal knit top"],
  "Knit sweater": ["knit sweater","sweater","jumper","pullover","crewneck sweater"],
  "Cashmere sweater": ["cashmere sweater","fine knit sweater"],
  "Merino crewneck": ["merino crewneck","merino sweater","merino knit"],
  "T-shirt": ["t-shirt","tee","tshirt","crew neck","short sleeve"],
  "Tank top": ["tank top","sleeveless top","summer tank"],
  "Sweatshirt": ["sweatshirt","crewneck sweatshirt"],
  "Hoodie": ["hoodie","pullover hoodie","casual hoodie"],
  "Camp shirt": ["camp shirt","short-sleeve linen shirt","cabana shirt"],
  "Mock-neck top": ["mock-neck top","mock neck","mock turtleneck"],
  "Performance tee": ["performance tee","training tee","athletic tee"],
  "Graphic tee": ["graphic tee","printed tee","streetwear tee"],
  "Flannel shirt": ["flannel shirt","plaid shirt","brushed cotton shirt"],
  "Rugby shirt": ["rugby shirt","striped rugby"],
  "Thermal base layer": ["thermal base layer","thermal","base layer"],
  // Bottoms
  "Jeans": ["jeans","denim","denim pants"],
  "Slim jeans": ["slim jeans","slim denim"],
  "Relaxed jeans": ["relaxed jeans","loose jeans"],
  "Black jeans": ["black jeans","black denim"],
  "Chinos": ["chinos","chino trousers"],
  "Slim chinos": ["slim chinos","tailored chinos"],
  "Lightweight chinos": ["lightweight chinos","summer chinos"],
  "Tailored trousers": ["tailored trousers","trousers","slacks","dress pants"],
  "Wool trousers": ["wool trousers","tailored wool trousers"],
  "Wide-leg trousers": ["wide-leg trousers","wide leg pants"],
  "Linen trousers": ["linen trousers","summer trousers"],
  "Pleated trousers": ["pleated trousers","pleated pants"],
  "Corduroy pants": ["corduroy pants","cord trousers"],
  "Cargo pants": ["cargo pants","utility pants"],
  "Joggers": ["joggers","jogger pants","sweatpants"],
  "Tech joggers": ["tech joggers","performance joggers"],
  "Track pants": ["track pants","training pants"],
  "Athletic shorts": ["athletic shorts","sport shorts","training shorts"],
  "Running shorts": ["running shorts","performance shorts"],
  "Cotton shorts": ["cotton shorts","chino shorts","tailored shorts"],
  "Linen shorts": ["linen shorts","summer shorts"],
  "Denim shorts": ["denim shorts","jean shorts"],
  "Leggings": ["leggings","tights"],
  // Outers
  "Blazer": ["blazer","light blazer","tailored blazer"],
  "Tailored blazer": ["tailored blazer","blazer"],
  "Lightweight blazer": ["lightweight blazer","summer blazer"],
  "Wool overcoat": ["wool overcoat","overcoat","long coat"],
  "Trench coat": ["trench coat","trench"],
  "Parka": ["parka","hooded parka"],
  "Hooded parka": ["hooded parka","parka"],
  "Insulated parka": ["insulated parka","winter parka"],
  "Down jacket": ["down jacket","puffer"],
  "Puffer jacket": ["puffer jacket","puffer","quilted jacket"],
  "Zip hoodie": ["zip hoodie","hooded layer","zip up hoodie"],
  "Overshirt": ["overshirt","shirt jacket","shacket"],
  "Shacket": ["shacket","shirt jacket","light overshirt"],
  "Denim jacket": ["denim jacket","jean jacket"],
  "Bomber jacket": ["bomber jacket","bomber"],
  "Leather jacket": ["leather jacket","biker jacket"],
  "Field jacket": ["field jacket","utility jacket","m-65"],
  "Chore coat": ["chore coat","work jacket","french chore coat"],
  "Windbreaker": ["windbreaker","wind jacket"],
  "Rain jacket": ["rain jacket","waterproof jacket","weather shell"],
  "Shell jacket": ["shell jacket","technical shell","light shell"],
  "Tech shell": ["tech shell","technical shell","performance shell"],
  "Fleece jacket": ["fleece jacket","fleece pullover"],
  "Pea coat": ["pea coat","peacoat","wool peacoat"],
  "Duffle coat": ["duffle coat","toggle coat"],
  // Shoes
  "Sneakers": ["sneakers","trainers","casual shoes"],
  "White sneakers": ["white sneakers","white leather sneakers"],
  "Black sneakers": ["black sneakers","black leather sneakers"],
  "Canvas sneakers": ["canvas sneakers","canvas trainers"],
  "Leather sneakers": ["leather sneakers","minimal leather sneakers"],
  "Running shoes": ["running shoes","running sneakers","athletic shoes"],
  "Trail runners": ["trail runners","trail running shoes","trail shoes"],
  "Performance runners": ["performance runners","running sneakers"],
  "Loafers": ["loafers","slip-on loafers"],
  "Penny loafers": ["penny loafers","loafers"],
  "Tassel loafers": ["tassel loafers","loafers"],
  "Suede loafers": ["suede loafers","loafers"],
  "Brown loafers": ["brown loafers","tan loafers"],
  "Oxford shoes": ["oxford shoes","derbys","dress shoes"],
  "Derby shoes": ["derby shoes","derbys","dress shoes"],
  "Chelsea boots": ["chelsea boots","ankle boots"],
  "Chukka boots": ["chukka boots","desert boots"],
  "Hiking boots": ["hiking boots","trail boots"],
  "Winter boots": ["winter boots","insulated boots","waterproof boots"],
  "Ankle boots": ["ankle boots","leather ankle boots"],
  "Combat boots": ["combat boots","military boots"],
  "Rain boots": ["rain boots","wellies","wellingtons"],
  "Boat shoes": ["boat shoes","deck shoes"],
  // Accessories already covered above
  "Watch": ["watch","wristwatch","classic watch"],
  "Sunglasses": ["sunglasses","shades"],
  "Beanie": ["beanie","knit cap","winter hat"],
  "Wool beanie": ["wool beanie","beanie"],
  "Baseball cap": ["baseball cap","cap","dad cap"],
  "Sports cap": ["sports cap","running cap","athletic cap"],
  "Sun hat": ["sun hat","wide-brim sun hat"],
  "Wide-brim hat": ["wide-brim hat","brim hat","sun hat"],
  "Bucket hat": ["bucket hat"],
  "Scarf": ["scarf","neck scarf"],
  "Wool scarf": ["wool scarf","warm scarf"],
  "Silk scarf": ["silk scarf","neck scarf"],
  "Belt": ["belt","leather belt"],
  "Leather belt": ["leather belt","belt"],
  "Tote bag": ["tote bag","tote","carryall","everyday bag"],
  "Crossbody bag": ["crossbody bag","crossbody","shoulder bag"],
  "Belt bag": ["belt bag","waist bag","fanny pack"],
  "Umbrella": ["umbrella","compact umbrella","rain umbrella"],
  "Compact umbrella": ["compact umbrella","umbrella"],
  "Gloves": ["gloves","light gloves"],
  "Leather gloves": ["leather gloves","gloves"],
  "Wool gloves": ["wool gloves","warm gloves"],
  "Wool socks": ["wool socks","crew socks","warm socks"],
};

function entryFor(row) {
  const key = `${row.slot}_${slug(row.color)}_${slug(row.item)}_${slug(row.material)}_v1`;
  const filename = path.basename(row.outPath);
  const itemKws = baseKeywordsByItem[row.item] || [row.item.toLowerCase()];
  // Front-load color + material so requests like "Black wool button-up shirt"
  // score this entry above the white-only legacy entry.
  const keywords = [
    `${row.color} ${row.item}`.toLowerCase(),
    `${row.color} ${row.material} ${row.item}`.toLowerCase(),
    `${row.material} ${row.item}`.toLowerCase(),
    ...itemKws,
  ];
  return {
    key,
    entry: {
      slot: row.slot,
      path: `assets/recommendation-stock/${filename}`,
      description: `${row.color} ${row.material} ${row.item.toLowerCase()} (Wikimedia Commons, ${row.license})`,
      keywords: [...new Set(keywords)],
      attribution: row.attribution || "",
      licenseSource: row.sourcePage || row.source,
    },
  };
}

const entries = ok.map(entryFor);

// Stable JS source output
const lines = entries.map(({ key, entry }) => {
  const kw = entry.keywords.map((k) => JSON.stringify(k)).join(", ");
  return `  ${key}: {
    slot: "${entry.slot}",
    path: "${entry.path}",
    description: ${JSON.stringify(entry.description)},
    keywords: [${kw}],
    // attribution: ${JSON.stringify(entry.attribution).slice(0, 200)}
    // source: ${entry.licenseSource}
  },`;
});

const out = `// Auto-generated by tmp/coverage/build-catalog-patch.js — paste these
// inside the existing STOCK_IMAGE_CATALOG object in server/index.js.
${lines.join("\n")}
`;
fs.writeFileSync(path.join(__dirname, "catalog-patch.js"), out);
console.log(`Wrote ${path.join(__dirname, "catalog-patch.js")} with ${entries.length} entries.`);

// Also write a compact attribution log Apple's privacy review can ingest.
const credits = ok.map((r) => ({
  file: path.basename(r.outPath),
  source: r.sourcePage,
  artist: r.attribution || "",
  license: r.license,
}));
fs.writeFileSync(path.join(__dirname, "credits.json"), JSON.stringify(credits, null, 2));
const md = ["# WearCast stock-image attribution",""].concat(
  credits.map((c) => `- **${c.file}** — ${c.license} — ${c.artist || "anon"} — ${c.source}`)
).join("\n");
fs.writeFileSync(path.join(__dirname, "credits.md"), md);
console.log(`Wrote credits.json + credits.md (${credits.length} rows).`);
