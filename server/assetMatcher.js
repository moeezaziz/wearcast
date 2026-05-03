import { existsSync } from "fs";
import { join } from "path";

const RASTER_RE = /\.(png|jpe?g|webp)(?:$|\?)/i;
const IMAGE_RE = /\.(png|jpe?g|webp|svg)(?:$|\?)/i;

const COLOR_TERMS = [
  "off-white", "charcoal", "indigo", "navy", "black", "dark", "white", "cream", "ivory", "gray", "grey",
  "beige", "tan", "camel", "brown", "olive", "green", "blue", "burgundy", "red", "pink", "purple",
  "yellow", "orange", "gold", "silver", "pearl",
];

const MATERIAL_TERMS = [
  "merino", "wool", "fleece", "sherpa", "linen", "silk", "denim", "leather", "suede", "nylon",
  "shell", "waterproof", "weatherproof", "rain", "canvas", "rubber", "cotton", "chino", "twill",
  "knit", "metal", "steel", "mesh", "jersey", "down", "acetate", "pearl",
];

const STOP_TOKENS = new Set([
  "the", "and", "for", "with", "clean", "simple", "easy", "everyday", "comfortable", "light", "dark",
  "warm", "cool", "studio", "product", "style", "asset", "shot", "background",
]);

function cleanText(value = "", fallback = "") {
  if (value == null) return fallback;
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeText(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function wordRe(term) {
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\-/g, "[-\\s]?")}\\b`, "i");
}

function extractTerms(text = "", terms = []) {
  const normalized = cleanText(text).toLowerCase();
  return terms.filter((term) => wordRe(term).test(normalized));
}

function normalizeColor(value = "") {
  const color = cleanText(value).toLowerCase();
  if (color === "grey") return "gray";
  if (color === "ivory") return "cream";
  if (color === "camel") return "tan";
  return color;
}

function normalizeMaterial(value = "") {
  const material = cleanText(value).toLowerCase();
  if (material === "merino" || material === "merino wool") return "wool";
  if (material === "sherpa") return "fleece";
  if (material === "suede") return "leather";
  if (["shell", "waterproof", "weatherproof", "rain"].includes(material)) return "nylon";
  if (["chino", "twill"].includes(material)) return "cotton";
  if (material === "steel") return "metal";
  return material;
}

function colorCompatible(requested = [], selected = "") {
  const candidate = normalizeColor(selected);
  const wanted = requested.map(normalizeColor);
  if (!wanted.length || !candidate) return true;
  if (wanted.includes(candidate)) return true;
  if (wanted.includes("dark") && ["black", "charcoal", "navy", "indigo", "brown"].includes(candidate)) return true;
  if (wanted.includes("off-white") && ["white", "cream"].includes(candidate)) return true;
  if (wanted.includes("cream") && ["off-white", "white"].includes(candidate)) return true;
  if (wanted.includes("indigo") && ["navy", "blue"].includes(candidate)) return true;
  if (wanted.includes("navy") && candidate === "indigo") return true;
  if (wanted.includes("silver") && candidate === "gray") return true;
  return false;
}

function materialCompatible(requested = [], selected = "") {
  const candidate = normalizeMaterial(selected);
  const wanted = requested.map(normalizeMaterial);
  if (!wanted.length || !candidate) return true;
  if (wanted.includes(candidate)) return true;
  if (wanted.includes("knit") && ["wool", "cotton"].includes(candidate)) return true;
  if (wanted.includes("wool") && candidate === "knit") return true;
  if (wanted.includes("nylon") && ["down"].includes(candidate)) return true;
  return false;
}

function normalizeSlot(slot = "") {
  const text = normalizeText(slot);
  if (!text) return "";
  if (/(top|shirt|t-shirt|tee|sweater|polo|blouse|hoodie|cardigan|dress|tank|turtleneck)/.test(text)) return "top";
  if (/(bottom|pants|trousers|jeans|shorts|leggings|skirt|chinos|joggers|culottes|palazzo|capri)/.test(text)) return "bottom";
  if (/(outer|outerwear|jacket|coat|shell|parka|blazer|overshirt|shacket|windbreaker|poncho|cape|kimono)/.test(text)) return "outer";
  if (/(shoes|shoe|sneakers|boots|loafers|sandals|heels|flats|pumps|runners|trainers|slides|mules)/.test(text)) return "shoes";
  if (/(accessory|accessories|scarf|beanie|hat|gloves|umbrella|watch|sunglasses|cap|bag|belt|tie|necklace|bracelet|earrings|clutch|headband|socks)/.test(text)) return "accessory";
  return text;
}

function inferSubtype(text = "", slot = "") {
  const value = normalizeText(text);
  if (!value) return "";
  if (slot === "top") {
    if (/\bpolo\b/.test(value)) return "polo";
    if (/\b(t-?shirt|tee)\b/.test(value)) return "tee";
    if (/\b(tank|sleeveless)\b/.test(value)) return "tank";
    if (/\b(thermal|base layer|baselayer)\b/.test(value)) return "thermal";
    if (/\b(turtleneck|roll neck|rollneck|mock turtleneck)\b/.test(value)) return "turtleneck";
    if (/\bcardigan\b/.test(value)) return "cardigan";
    if (/\bhoodie\b/.test(value)) return "hoodie";
    if (/\b(sweater dress|knit dress|shirt dress|shirtdress|wrap dress|slip dress|dress)\b/.test(value)) return "dress";
    if (/\b(sweater|jumper|pullover|crewneck|knit)\b/.test(value)) return "sweater";
    if (/\b(button[-\s]?up|button[-\s]?down|oxford|shirt|blouse|poplin|linen shirt|camp collar|henley)\b/.test(value)) return "shirt";
  }
  if (slot === "bottom") {
    if (/\bjeans?|denim\b/.test(value)) return "jeans";
    if (/\bchinos?\b/.test(value)) return "chinos";
    if (/\bshorts?\b/.test(value)) return "shorts";
    if (/\b(capri|cropped pants?)\b/.test(value)) return "capri";
    if (/\b(leggings?|tights?)\b/.test(value)) return "leggings";
    if (/\b(joggers?|sweatpants?|track pants?)\b/.test(value)) return "joggers";
    if (/\bskirt\b/.test(value)) return "skirt";
    if (/\b(cargo|utility)\b/.test(value)) return "cargo";
    if (/\b(trousers?|pants|slacks?|tailored|culottes|palazzo)\b/.test(value)) return "trousers";
  }
  if (slot === "outer") {
    if (/\b(fleece|sherpa)\b/.test(value)) return "fleece";
    if (/\b(rain|waterproof|shell|weatherproof|windbreaker)\b/.test(value)) return "shell";
    if (/\b(parka|puffer|down)\b/.test(value)) return "parka";
    if (/\b(trench|pea coat|coat|overcoat|duster)\b/.test(value)) return "coat";
    if (/\bblazer\b/.test(value)) return "blazer";
    if (/\b(overshirt|shacket|shirt jacket)\b/.test(value)) return "overshirt";
    if (/\bhoodie\b/.test(value)) return "hoodie";
    if (/\bbomber\b/.test(value)) return "bomber";
    if (/\bfield jacket\b/.test(value)) return "field-jacket";
    if (/\bcardigan\b/.test(value)) return "cardigan";
    if (/\bjacket\b/.test(value)) return "jacket";
  }
  if (slot === "shoes") {
    if (/\b(loafers?|derby|oxford|dress shoe|brogue)\b/.test(value)) return "loafers";
    if (/\b(boot|chelsea|hiking|winter boot|ankle boot|riding boot|knee-high)\b/.test(value)) return "boots";
    if (/\b(sandal|slide|espadrille)\b/.test(value)) return "sandals";
    if (/\b(runners?|running|trainers?|trail|performance)\b/.test(value)) return "runners";
    if (/\b(heels?|pumps?|stiletto|mary jane|flats?|mules)\b/.test(value)) return "heels-flats";
    if (/\b(sneakers?|court shoe)\b/.test(value)) return "sneakers";
  }
  if (slot === "accessory") {
    if (/\bumbrella\b/.test(value)) return "umbrella";
    if (/\bsunglasses?\b/.test(value)) return "sunglasses";
    if (/\b(baseball cap|dad cap|snapback|sports? cap|running cap)\b/.test(value)) return "baseball-cap";
    if (/\b(wool|knit|winter|warm)\b.*\b(hat|cap)\b|\b(hat|cap)\b.*\b(wool|knit|winter|warm)\b/.test(value)) return "beanie";
    if (/\bbeanie\b/.test(value)) return "beanie";
    if (/\bberet\b/.test(value)) return "beret";
    if (/\b(sun hat|wide[-\s]?brim|wide brim|bucket hat|fedora)\b/.test(value)) return "sun-hat";
    if (/\b(hat|cap)\b/.test(value)) return "hat";
    if (/\bscarf\b/.test(value)) return "scarf";
    if (/\bgloves?\b/.test(value)) return "gloves";
    if (/\bwatch\b/.test(value)) return "watch";
    if (/\b(backpack|bag|tote|clutch|hobo|bucket bag|mini bag)\b/.test(value)) return "bag";
    if (/\bbelt\b/.test(value)) return "belt";
    if (/\b(tie|bow tie|pocket square)\b/.test(value)) return "tie";
    if (/\b(necklace|bracelet|earrings?|brooch|hair clip|headband)\b/.test(value)) return "jewelry";
    if (/\bsocks?\b/.test(value)) return "socks";
  }
  return "";
}

function familyFor(slot = "", subtype = "") {
  if (!subtype) return "";
  if (slot === "accessory") {
    if (["hat", "beanie", "beret", "sun-hat", "baseball-cap"].includes(subtype)) return "hat";
    if (["watch"].includes(subtype)) return "watch";
    if (["bag"].includes(subtype)) return "bag";
    if (["scarf"].includes(subtype)) return "scarf";
    if (["gloves"].includes(subtype)) return "gloves";
    if (["sunglasses"].includes(subtype)) return "eyewear";
    if (["umbrella"].includes(subtype)) return "umbrella";
    if (["belt"].includes(subtype)) return "belt";
    if (["tie"].includes(subtype)) return "tie";
    if (["jewelry"].includes(subtype)) return "jewelry";
    if (["socks"].includes(subtype)) return "socks";
  }
  if (slot === "shoes") {
    if (["sneakers", "runners"].includes(subtype)) return "sneakers";
    if (["loafers"].includes(subtype)) return "dress-shoes";
    if (["boots"].includes(subtype)) return "boots";
    if (["sandals"].includes(subtype)) return "sandals";
    if (["heels-flats"].includes(subtype)) return "heels-flats";
  }
  if (slot === "bottom") {
    if (subtype === "jeans") return "denim-bottom";
    if (["chinos", "trousers", "cargo"].includes(subtype)) return "woven-bottom";
    return subtype;
  }
  if (slot === "top") {
    if (["sweater", "thermal", "turtleneck", "cardigan"].includes(subtype)) return "knit-top";
    if (["shirt", "polo", "tee", "tank"].includes(subtype)) return "shirt-top";
    if (subtype === "dress") return "dress";
    return subtype;
  }
  if (slot === "outer") {
    if (["fleece", "hoodie", "cardigan"].includes(subtype)) return "soft-outer";
    if (["shell", "parka", "coat", "jacket", "field-jacket", "bomber", "overshirt", "blazer"].includes(subtype)) return "outerwear";
    return subtype;
  }
  return subtype;
}

function subtypesCompatible(slot, requested = "", candidate = "") {
  if (!requested || !candidate) return false;
  if (requested === candidate) return true;
  if (slot === "top") {
    if (["sweater", "thermal", "turtleneck"].includes(requested) && ["sweater", "thermal", "turtleneck"].includes(candidate)) return true;
    if (["shirt", "polo", "tee"].includes(requested) && ["shirt", "polo", "tee"].includes(candidate)) return requested === candidate;
  }
  if (slot === "outer") {
    if (["shell", "parka", "jacket", "field-jacket", "bomber"].includes(requested) && ["shell", "parka", "jacket", "field-jacket", "bomber"].includes(candidate)) return true;
    if (["hoodie", "fleece", "cardigan"].includes(requested) && ["hoodie", "fleece", "cardigan"].includes(candidate)) return true;
  }
  if (slot === "shoes") {
    if (["sneakers", "runners"].includes(requested) && ["sneakers", "runners"].includes(candidate)) return true;
  }
  if (slot === "accessory") {
    if (["beanie", "beret"].includes(requested) && ["beanie", "beret"].includes(candidate)) return true;
    if (["hat", "beanie", "beret", "sun-hat", "baseball-cap"].includes(requested) && ["hat", "beanie", "beret", "sun-hat", "baseball-cap"].includes(candidate)) return false;
  }
  if (slot === "bottom" && ["chinos", "trousers", "cargo"].includes(requested) && ["chinos", "trousers", "cargo"].includes(candidate)) return true;
  return false;
}

function tokenize(text = "") {
  return unique(normalizeText(text)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_TOKENS.has(token)));
}

function visualTags(text = "") {
  return {
    colors: unique(extractTerms(text, COLOR_TERMS).map(normalizeColor)),
    materials: unique(extractTerms(text, MATERIAL_TERMS).map(normalizeMaterial)),
  };
}

function itemDetailsForSlot(slot = "", context = {}) {
  const details = context?.itemDetails || {};
  if (!details || typeof details !== "object") return {};
  return slot === "accessory" ? details.accessory || {} : details[slot] || {};
}

function requestDescriptor(slot = "", itemName = "", context = {}) {
  const normalizedSlot = normalizeSlot(slot);
  const details = itemDetailsForSlot(normalizedSlot, context);
  const text = [itemName, details.color, details.material].map(cleanText).filter(Boolean).join(" ");
  const subtype = inferSubtype(text, normalizedSlot);
  const tags = visualTags(text);
  return {
    slot: normalizedSlot,
    subtype,
    family: familyFor(normalizedSlot, subtype),
    colors: tags.colors,
    materials: tags.materials,
    tokens: tokenize(text),
    text: normalizeText(text),
  };
}

function stockDescriptor(key = "", entry = {}) {
  const slot = normalizeSlot(entry.slot);
  const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
  const text = [key, entry.description, ...(entry.keywords || []), ...aliases].map(cleanText).filter(Boolean).join(" ");
  const subtype = entry.subtype || inferSubtype(text, slot);
  const tags = visualTags(text);
  return {
    id: key,
    slot,
    subtype,
    family: entry.family || familyFor(slot, subtype),
    colors: unique([...(entry.colors || []), ...tags.colors].map(normalizeColor)),
    materials: unique([...(entry.materials || []), ...tags.materials].map(normalizeMaterial)),
    tokens: tokenize(text),
    text: normalizeText(text),
    path: entry.path || "",
    description: entry.description || "",
    aliases: unique([...(entry.keywords || []), ...aliases].map(cleanText)),
    gender: entry.gender || "unisex",
  };
}

function wardrobeDescriptor(item = {}) {
  const slot = normalizeSlot(item.type);
  const text = [item.name, item.type, item.color, item.material].map(cleanText).filter(Boolean).join(" ");
  const subtype = inferSubtype(item.name, slot) || inferSubtype(item.type, slot) || inferSubtype(text, slot);
  const tags = visualTags(text);
  return {
    id: item.id ?? item.name ?? null,
    slot,
    subtype,
    family: familyFor(slot, subtype),
    colors: unique([...tags.colors, ...extractTerms(item.color, COLOR_TERMS).map(normalizeColor)]),
    materials: unique([...tags.materials, ...extractTerms(item.material, MATERIAL_TERMS).map(normalizeMaterial)]),
    tokens: tokenize(text),
    text: normalizeText(text),
    path: item.cropPhotoDataUrl || item.photoDataUrl || item.sourcePhotoDataUrl || "",
  };
}

function slotsCompatible(request = {}, candidate = {}) {
  if (!request.slot || !candidate.slot) return false;
  if (request.slot === candidate.slot) return true;
  return (
    ((request.slot === "outer" && candidate.slot === "top") || (request.slot === "top" && candidate.slot === "outer"))
    && /\b(hoodie|sweater|cardigan|fleece|overshirt|shacket)\b/.test(`${request.text} ${candidate.text}`)
  );
}

function hardGate(request = {}, candidate = {}) {
  const reasons = [];
  if (!slotsCompatible(request, candidate)) reasons.push("slot_mismatch");

  if (request.slot === "accessory") {
    if (request.family && candidate.family && request.family !== candidate.family) reasons.push("accessory_family_mismatch");
    if (request.family === "hat" && ["watch", "bag", "scarf", "eyewear", "jewelry"].includes(candidate.family)) reasons.push("impossible_hat_match");
    if (request.family === "watch" && ["hat", "bag", "scarf", "jewelry"].includes(candidate.family)) reasons.push("impossible_watch_match");
  } else if (request.family && candidate.family && request.family !== candidate.family) {
    const softTopOuter = ["top", "outer"].includes(request.slot) && ["top", "outer"].includes(candidate.slot)
      && request.family && candidate.family && /\b(hoodie|sweater|cardigan|fleece|overshirt|shacket)\b/.test(`${request.text} ${candidate.text}`);
    if (!softTopOuter) reasons.push("family_mismatch");
  }

  if (request.subtype && candidate.subtype && request.subtype !== candidate.subtype && !subtypesCompatible(request.slot, request.subtype, candidate.subtype)) {
    const genericHat = request.slot === "accessory" && request.family === "hat" && candidate.family === "hat" && request.subtype === "hat";
    if (!genericHat && (request.slot === "accessory" || request.slot === "shoes" || request.slot === "bottom")) reasons.push("subtype_mismatch");
  }

  if (request.colors.length && candidate.colors.length && !candidate.colors.some((color) => colorCompatible(request.colors, color))) {
    reasons.push("color_mismatch");
  }
  if (request.materials.length && candidate.materials.length && !candidate.materials.some((material) => materialCompatible(request.materials, material))) {
    reasons.push("material_mismatch");
  }

  return { ok: reasons.length === 0, reasons };
}

function descriptorScore(request = {}, candidate = {}) {
  const gate = hardGate(request, candidate);
  if (!gate.ok) return { score: -1000, rejected: true, reasons: gate.reasons };
  const reasons = [];
  let score = 0;
  if (request.subtype && candidate.subtype) {
    if (request.subtype === candidate.subtype) {
      score += 42;
      reasons.push("subtype_match");
    } else if (subtypesCompatible(request.slot, request.subtype, candidate.subtype)) {
      score += 22;
      reasons.push("compatible_subtype");
    } else if (request.family && request.family === candidate.family) {
      score += 10;
      reasons.push("family_match");
    }
  }
  if (request.family && candidate.family && request.family === candidate.family) {
    score += 16;
    reasons.push("family_match");
  }
  const colorMatches = request.colors.filter((wanted) => candidate.colors.some((color) => colorCompatible([wanted], color)));
  if (request.colors.length) {
    if (colorMatches.length) {
      const exact = request.colors.some((wanted) => candidate.colors.includes(wanted));
      score += exact ? 34 : 18;
      reasons.push(exact ? "color_match" : "compatible_color");
    } else if (!candidate.colors.length) {
      score -= 12;
      reasons.push("missing_candidate_color");
    }
  }
  const materialMatches = request.materials.filter((wanted) => candidate.materials.some((material) => materialCompatible([wanted], material)));
  if (request.materials.length) {
    if (materialMatches.length) {
      score += request.materials.some((wanted) => candidate.materials.includes(wanted)) ? 12 : 7;
      reasons.push("material_match");
    } else if (!candidate.materials.length) {
      score -= 6;
      reasons.push("missing_candidate_material");
    }
  }
  const overlap = request.tokens.filter((token) => candidate.tokens.includes(token)).length;
  if (overlap) {
    score += Math.min(20, overlap * 5);
    reasons.push("token_overlap");
  }
  if (request.tokens.length && overlap === request.tokens.length) {
    score += 6;
    reasons.push("all_tokens_match");
  }
  return { score, rejected: false, reasons };
}

function usableCatalogEntries(catalog = {}, assetRoot = "") {
  return Object.entries(catalog).filter(([, entry]) => {
    const imagePath = String(entry?.path || "");
    if (!imagePath || !RASTER_RE.test(imagePath)) return false;
    return !assetRoot || existsSync(join(assetRoot, imagePath));
  });
}

function stockCandidatesForRequest(request, catalog = {}, context = {}, assetRoot = "") {
  const preferences = context.preferences || {};
  const gender = String(preferences.gender || "unspecified").toLowerCase();
  return usableCatalogEntries(catalog, assetRoot)
    .map(([key, entry]) => {
      const descriptor = stockDescriptor(key, entry);
      if (descriptor.slot !== request.slot) return null;
      if (gender === "male" && descriptor.gender === "feminine") return null;
      if (gender === "female" && descriptor.gender === "masculine") return null;
      const scored = descriptorScore(request, descriptor);
      if (scored.rejected) return null;
      let score = scored.score;
      if (entry.fallback) score -= 24;
      if (entry.source === "generated") score += 2;
      return { key, entry, descriptor, score, reasons: scored.reasons };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

function wardrobeCandidatesForRequest(request, wardrobeItems = [], usedItemIds = new Set()) {
  return (Array.isArray(wardrobeItems) ? wardrobeItems : [])
    .map((item) => {
      const descriptor = wardrobeDescriptor(item);
      if (!descriptor.path) return null;
      const id = String(item.id ?? item.name ?? "");
      if (id && usedItemIds.has(id)) return null;
      const scored = descriptorScore(request, descriptor);
      if (scored.rejected) return null;
      const identity = wardrobeIdentityForRequest(request, descriptor, item);
      if (!identity.ok) return null;
      let score = scored.score + 10;
      score += identity.score;
      if (item.favorite) score += 4;
      return { item, descriptor, score, reasons: [...scored.reasons, ...identity.reasons] };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

function wardrobeIdentityForRequest(request = {}, descriptor = {}, item = {}) {
  const itemName = normalizeText(item.name);
  const requestText = normalizeText(request.text);
  if (!itemName || !requestText) return { ok: false, score: 0, reasons: ["missing_wardrobe_identity"] };
  if (itemName === requestText) return { ok: true, score: 58, reasons: ["wardrobe_exact_name"] };

  const itemTokens = tokenize(itemName);
  const requestTokens = tokenize(requestText);
  const itemTokenSet = new Set(itemTokens);
  const requestTokenSet = new Set(requestTokens);
  const itemInRequest = itemTokens.length >= 2 && itemTokens.every((token) => requestTokenSet.has(token));
  if (itemInRequest) return { ok: true, score: 44, reasons: ["wardrobe_name_in_request"] };

  const requestInItem = requestTokens.length >= 2 && requestTokens.every((token) => itemTokenSet.has(token));
  const hasExplicitColor = (request.colors || []).length > 0
    && (descriptor.colors || []).some((color) => colorCompatible(request.colors, color));
  const hasExactSubtype = request.subtype && descriptor.subtype && request.subtype === descriptor.subtype;
  if (requestInItem && hasExplicitColor && hasExactSubtype) {
    return { ok: true, score: 32, reasons: ["wardrobe_colored_name_match"] };
  }

  return { ok: false, score: 0, reasons: ["generic_not_bound_to_wardrobe"] };
}

function confidenceFromScore(score, base = 42) {
  return Math.max(0, Math.min(100, Math.round(base + score)));
}

function buildStockMatch(candidate, request, { source = "stock", adjudicated = false, llmReason = "" } = {}) {
  return {
    path: candidate.entry.path,
    source,
    key: candidate.key,
    description: candidate.entry.description || "",
    confidence: confidenceFromScore(candidate.score, source === "llm_stock" ? 46 : 44),
    matchQuality: source === "llm_stock" ? "llm_adjudicated_stock" : candidate.score >= 50 ? "strong_stock" : "stock",
    requestedDescriptor: request,
    selectedDescriptor: candidate.descriptor,
    matchReasons: unique([...(candidate.reasons || []), ...(adjudicated ? ["llm_adjudicated"] : []), llmReason ? `llm:${llmReason}` : ""]),
    adjudicated,
  };
}

function buildWardrobeMatch(candidate, request, { adjudicated = false } = {}) {
  const item = candidate.item;
  return {
    path: candidate.descriptor.path,
    source: "wardrobe",
    itemId: item.id ?? null,
    itemName: cleanText(item.name),
    type: cleanText(item.type),
    color: cleanText(item.color),
    material: cleanText(item.material),
    careInstructions: Array.isArray(item.careInstructions) ? item.careInstructions : [],
    confidence: confidenceFromScore(candidate.score, 46),
    matchScore: Math.round(candidate.score),
    matchQuality: adjudicated ? "llm_adjudicated_wardrobe" : candidate.score >= 44 ? "strong_wardrobe" : "wardrobe",
    requestedDescriptor: request,
    selectedDescriptor: candidate.descriptor,
    matchReasons: unique([...(candidate.reasons || []), ...(adjudicated ? ["llm_adjudicated"] : [])]),
    adjudicated,
  };
}

function fallbackKeyFor(request = {}, catalog = {}, assetRoot = "") {
  const options = {
    top: {
      thermal: ["top_charcoal_thermal_base_layer_wool_v1", "top_knit_sweater_hanger"],
      sweater: ["top_charcoal_crewneck_sweater_knit_v1", "top_knit_sweater_hanger"],
      shirt: ["top_white_button_up_shirt", "top_gray_button_up_shirt_cotton_v1", "top_white_tshirt_studio"],
      polo: ["top_white_polo_studio", "top_white_tshirt_studio"],
      tee: ["top_white_tshirt_studio"],
      default: ["top_white_tshirt_studio"],
    },
    bottom: {
      jeans: ["bottom_dark_indigo_jeans_denim_v1", "bottom_navy_jeans_stack", "bottom_black_jeans_denim_v1"],
      chinos: ["bottom_tan_chinos_studio", "bottom_olive_chinos_cotton_v1", "bottom_black_trousers_studio"],
      trousers: ["bottom_black_trousers_studio", "bottom_black_tailored_trousers_wool_v1"],
      shorts: ["bottom_cotton_shorts_warm", "bottom_blue_denim_shorts_studio"],
      default: ["bottom_black_trousers_studio"],
    },
    outer: {
      shell: ["outer_gray_shell_jacket_tech", "outer_black_shell_jacket_city", "outer_navy_rain_jacket_tech_v1"],
      hoodie: ["outer_gray_hoodie_cotton_v1", "outer_white_hoodie_studio"],
      fleece: ["outer_charcoal_fleece_jacket_fleece_v1", "outer_gray_hoodie_cotton_v1"],
      coat: ["outer_camel_wool_coat_wool_v1", "outer_winter_coat_studio"],
      overshirt: ["outer_charcoal_overshirt_studio", "outer_olive_lightweight_overshirt_cotton_v1"],
      default: ["outer_gray_jacket_studio"],
    },
    shoes: {
      sneakers: ["shoes_white_canvas_sneakers_canvas_v1", "shoes_black_white_sneakers_studio"],
      runners: ["shoes_white_running_sneakers_studio", "shoes_gray_trail_runners_studio"],
      boots: ["shoes_tan_winter_boots_studio", "shoes_black_chelsea_boots_leather_v1"],
      loafers: ["shoes_black_dress_loafers_studio", "shoes_brown_loafers_polished"],
      sandals: ["shoes_brown_sandals_leather_v1", "shoes_black_slides_rubber_v1"],
      default: ["shoes_black_white_sneakers_studio"],
    },
    accessory: {
      beanie: ["accessory_white_beanie_studio", "accessory_knit_beanies_outdoors", "accessory_black_beret_wool_fem_v1"],
      beret: ["accessory_black_beret_wool_fem_v1", "accessory_cream_beret_wool_fem_v1"],
      hat: ["accessory_white_beanie_studio", "accessory_black_baseball_cap_outdoors"],
      "baseball-cap": ["accessory_charcoal_baseball_cap_cotton_v1", "accessory_black_baseball_cap_outdoors", "accessory_baseball_cap_studio"],
      "sun-hat": ["accessory_white_sun_hat_studio", "accessory_tan_sun_hat_cotton_v1"],
      watch: ["accessory_black_watch_metal_v1", "accessory_watch_studio"],
      scarf: ["accessory_cream_lightweight_scarf_linen_v1", "accessory_pattern_scarf_studio"],
      gloves: ["accessory_white_gloves_studio", "accessory_black_gloves_cotton_v1"],
      bag: ["accessory_black_backpack_nylon_v1", "accessory_tote_bag_studio"],
      umbrella: ["accessory_white_umbrella_studio"],
      default: ["accessory_black_watch_metal_v1", "accessory_watch_studio"],
    },
  };
  const list = [
    ...(options[request.slot]?.[request.subtype] || []),
    ...(options[request.slot]?.default || []),
  ];
  return list.find((key) => {
    const entry = catalog[key];
    return entry?.path && RASTER_RE.test(entry.path) && (!assetRoot || existsSync(join(assetRoot, entry.path)));
  }) || null;
}

function buildFallbackMatch(request, catalog = {}, assetRoot = "") {
  const key = fallbackKeyFor(request, catalog, assetRoot);
  const entry = key ? catalog[key] : null;
  if (!entry) return null;
  return {
    path: entry.path,
    source: "raster_fallback",
    key,
    description: entry.description || "",
    confidence: 55,
    matchQuality: "curated_raster_fallback",
    requestedDescriptor: request,
    selectedDescriptor: stockDescriptor(key, entry),
    matchReasons: ["curated_fallback"],
    adjudicated: false,
  };
}

function shouldAdjudicate(best, second, request) {
  if (!best) return true;
  const confidence = confidenceFromScore(best.score, 44);
  if (confidence < 82) return true;
  if (second && best.score - second.score <= 10) return true;
  if (request.colors.length && !best.descriptor.colors.some((color) => colorCompatible(request.colors, color))) return true;
  return false;
}

async function adjudicateStockWithLlm(request, candidates, context = {}, services = {}) {
  const chatCompletion = services.chatCompletion;
  const parseModelJson = services.parseModelJson || JSON.parse;
  if (!chatCompletion || !candidates.length) return null;
  const compact = candidates.slice(0, 8).map((candidate) => ({
    key: candidate.key,
    slot: candidate.descriptor.slot,
    subtype: candidate.descriptor.subtype,
    family: candidate.descriptor.family,
    colors: candidate.descriptor.colors,
    materials: candidate.descriptor.materials,
    aliases: candidate.descriptor.aliases.slice(0, 8),
    description: candidate.descriptor.description,
    filename: candidate.entry.path.split("/").pop(),
    score: Math.round(candidate.score),
  }));
  const prompt = `Choose the best WearCast stock image for the recommended outfit item.

Recommended descriptor:
${JSON.stringify({
  slot: request.slot,
  subtype: request.subtype,
  family: request.family,
  colors: request.colors,
  materials: request.materials,
  text: request.text,
  weather: context.weather || {},
  preferences: context.preferences || {},
})}

Candidate stock images:
${JSON.stringify(compact)}

Return ONLY compact valid JSON:
{"selectedKey":"candidate_key_or_null","confidence":0-100,"reason":"short reason"}

Rules:
- Accuracy beats coverage.
- Select null if all candidates are wrong or misleading.
- Do not choose a different accessory family. A hat/beanie is never a watch, bag, scarf, sunglasses, or jewelry.
- Do not choose a conflicting color when the requested color is explicit.
- Do not choose a conflicting visual material such as wool vs metal, denim vs linen, leather vs canvas, shell/nylon vs knit.`;

  try {
    const text = await chatCompletion([{ role: "user", content: prompt }], {
      maxTokens: 120,
      compactJsonRetry: true,
      traceLabel: "asset-stock-match",
      timeoutMs: 10000,
    });
    const parsed = parseModelJson(text);
    const selectedKey = cleanText(parsed?.selectedKey);
    const confidence = Number(parsed?.confidence);
    if (!selectedKey || selectedKey === "null" || !Number.isFinite(confidence) || confidence < 68) return null;
    const selected = candidates.find((candidate) => candidate.key === selectedKey);
    if (!selected) return null;
    const gate = hardGate(request, selected.descriptor);
    if (!gate.ok) return null;
    return {
      ...selected,
      score: Math.max(selected.score, confidence - 44),
      reasons: unique([...(selected.reasons || []), `llm_reason:${cleanText(parsed?.reason).slice(0, 80)}`]),
      llmReason: cleanText(parsed?.reason).slice(0, 80),
    };
  } catch (err) {
    services.log?.("warn", "asset_stock_match_llm_failed", { error: err?.message || String(err), slot: request.slot, text: request.text });
    return null;
  }
}

async function matchSlot({ slot, itemName, outputKey, catalog, wardrobeItems, usedItemIds, context, services, assetRoot }) {
  const request = requestDescriptor(slot, itemName, context);
  const wardrobeCandidates = wardrobeCandidatesForRequest(request, wardrobeItems, usedItemIds);
  if (wardrobeCandidates[0] && confidenceFromScore(wardrobeCandidates[0].score, 46) >= 80) {
    const match = buildWardrobeMatch(wardrobeCandidates[0], request);
    const id = String(match.itemId ?? match.itemName ?? "");
    if (id) usedItemIds.add(id);
    return [outputKey, match];
  }

  const stockCandidates = stockCandidatesForRequest(request, catalog, context, assetRoot);
  const bestStock = stockCandidates[0] || null;
  const secondStock = stockCandidates[1] || null;
  if (bestStock && !shouldAdjudicate(bestStock, secondStock, request)) {
    return [outputKey, buildStockMatch(bestStock, request)];
  }

  const llmStock = await adjudicateStockWithLlm(request, stockCandidates, context, services);
  if (llmStock) return [outputKey, buildStockMatch(llmStock, request, { source: "llm_stock", adjudicated: true, llmReason: llmStock.llmReason })];

  if (wardrobeCandidates[0] && confidenceFromScore(wardrobeCandidates[0].score, 46) >= 72) {
    const match = buildWardrobeMatch(wardrobeCandidates[0], request);
    const id = String(match.itemId ?? match.itemName ?? "");
    if (id) usedItemIds.add(id);
    return [outputKey, match];
  }

  if (bestStock && confidenceFromScore(bestStock.score, 44) >= 68) return [outputKey, buildStockMatch(bestStock, request)];
  return [outputKey, buildFallbackMatch(request, catalog, assetRoot)];
}

function compactStockAssetForLlm(key = "", entry = {}) {
  const descriptor = stockDescriptor(key, entry);
  return {
    key,
    slot: descriptor.slot,
    subtype: descriptor.subtype,
    family: descriptor.family,
    colors: descriptor.colors.slice(0, 5),
    materials: descriptor.materials.slice(0, 4),
    gender: descriptor.gender,
    aliases: descriptor.aliases.slice(0, 6),
    description: cleanText(descriptor.description).slice(0, 90),
    filename: String(entry.path || "").split("/").pop(),
  };
}

function stockAssetAllowedForGender(entryOrDescriptor = {}, preferences = {}) {
  const userGender = String(preferences?.gender || "unspecified").toLowerCase();
  const assetGender = String(entryOrDescriptor?.gender || "unisex").toLowerCase();
  if (userGender === "male" && assetGender === "feminine") return false;
  if (userGender === "female" && assetGender === "masculine") return false;
  return true;
}

function nonVisualHardGateReasons(request = {}, descriptor = {}) {
  return hardGate(request, descriptor).reasons
    .filter((reason) => !["color_mismatch", "material_mismatch"].includes(reason));
}

function scoreLlmCandidate(request = {}, descriptor = {}, { fallback = false } = {}) {
  const hardReasons = nonVisualHardGateReasons(request, descriptor);
  if (hardReasons.length) return null;
  let score = 0;
  if (request.subtype && descriptor.subtype) {
    if (request.subtype === descriptor.subtype) score += 48;
    else if (subtypesCompatible(request.slot, request.subtype, descriptor.subtype)) score += 28;
  }
  if (request.family && descriptor.family && request.family === descriptor.family) score += 18;
  const colorMatches = request.colors.filter((wanted) => descriptor.colors.some((color) => colorCompatible([wanted], color)));
  if (request.colors.length && colorMatches.length) {
    score += request.colors.some((wanted) => descriptor.colors.includes(wanted)) ? 30 : 16;
  }
  const materialMatches = request.materials.filter((wanted) => descriptor.materials.some((material) => materialCompatible([wanted], material)));
  if (request.materials.length && materialMatches.length) {
    score += request.materials.some((wanted) => descriptor.materials.includes(wanted)) ? 10 : 6;
  }
  const overlap = request.tokens.filter((token) => descriptor.tokens.includes(token)).length;
  score += Math.min(24, overlap * 6);
  if (fallback) score -= 18;
  return score;
}

function compactWardrobeAssetForLlm(item = {}) {
  const descriptor = wardrobeDescriptor(item);
  return {
    id: item.id ?? item.name ?? "",
    slot: descriptor.slot,
    subtype: descriptor.subtype,
    family: descriptor.family,
    name: cleanText(item.name),
    type: cleanText(item.type),
    color: cleanText(item.color),
    material: cleanText(item.material),
    hasPhoto: !!descriptor.path,
  };
}

function stockCandidateByKey(key = "", catalog = {}, request = {}, context = {}) {
  const resolvedKey = resolveCatalogSelectionKey(key, catalog);
  const entry = catalog[resolvedKey];
  if (!resolvedKey || !entry || !entry.path || !RASTER_RE.test(entry.path)) return null;
  if (!stockAssetAllowedForGender(entry, context.preferences || {})) return null;
  const descriptor = stockDescriptor(resolvedKey, entry);
  const gate = hardGate(request, descriptor);
  const hardReasons = nonVisualHardGateReasons(request, descriptor);
  if (hardReasons.length) return null;
  return { key: resolvedKey, entry, descriptor, score: 50, reasons: unique(["llm_slot_selected", ...gate.reasons]) };
}

function normalizeSelectionKey(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveCatalogSelectionKey(value = "", catalog = {}) {
  const raw = cleanText(value);
  if (raw && catalog[raw]) return raw;
  const normalized = normalizeSelectionKey(raw);
  if (!normalized) return "";
  if (catalog[normalized]) return normalized;
  const candidates = Object.entries(catalog || {}).map(([key, entry]) => {
    const filename = String(entry?.path || "").split("/").pop() || "";
    return {
      key,
      keyNorm: normalizeSelectionKey(key),
      filenameNorm: normalizeSelectionKey(filename),
    };
  });
  const exact = candidates.find((candidate) => candidate.keyNorm === normalized || candidate.filenameNorm === normalized);
  if (exact) return exact.key;
  const withoutStudio = normalized.replace(/_studio(?:_product|_asset)?$/i, "");
  const trimmed = candidates.find((candidate) =>
    candidate.keyNorm === withoutStudio ||
    candidate.filenameNorm === withoutStudio ||
    withoutStudio.startsWith(candidate.keyNorm) ||
    candidate.keyNorm.startsWith(withoutStudio)
  );
  return trimmed?.key || "";
}

function wardrobeCandidateById(id = "", wardrobeItems = [], request = {}) {
  const item = (Array.isArray(wardrobeItems) ? wardrobeItems : []).find((candidate) => {
    const candidateId = String(candidate?.id ?? candidate?.name ?? "");
    return candidateId && String(id) === candidateId;
  });
  if (!item) return null;
  const descriptor = wardrobeDescriptor(item);
  if (!descriptor.path) return null;
  const hardReasons = nonVisualHardGateReasons(request, descriptor);
  if (hardReasons.length) return null;
  const identity = wardrobeIdentityForRequest(request, descriptor, item);
  if (!identity.ok) return null;
  return {
    item,
    descriptor,
    score: 50 + (identity.ok ? identity.score : 0),
    reasons: unique(["llm_slot_selected", ...identity.reasons]),
  };
}

function buildLlmAssetSelectionPrompt(task = {}, stockAssets = [], wardrobeAssets = []) {
  return `Choose the best visual asset for one WearCast outfit recommendation slot.

Recommended outfit item:
${JSON.stringify({
  outputKey: task.outputKey,
  slot: task.slot,
  itemName: task.itemName,
  descriptor: task.request,
})}

Available wardrobe items with photos:
${JSON.stringify(wardrobeAssets)}

Available stock images:
${JSON.stringify(stockAssets)}

Return ONLY compact valid JSON:
{"source":"stock|wardrobe|null","key":"stock_key_or_empty","id":"wardrobe_id_or_empty","confidence":0-100,"reason":"short"}

Rules:
- Accuracy beats speed and coverage.
- Do not explain outside JSON. Do not list alternatives.
- Pick a wardrobe item only when the recommended item is explicitly that same saved garment/accessory by name and identity. Do not use wardrobe as a loose substitute.
- If you choose wardrobe, the app will display that wardrobe item's real name and photo.
- Otherwise pick the most visually accurate stock image.
- Do not cross slots. A hat/beanie must never be a watch, bag, scarf, sunglasses, or jewelry. A watch must never be a hat, scarf, or bag.
- Respect explicit color and material when a compatible asset exists.
- Return null for a slot only if every option would be misleading.`;
}

function stockAssetsForLlmTask(task = {}, catalog = {}, context = {}, assetRoot = "", limit = 60) {
  return usableCatalogEntries(catalog, assetRoot)
    .filter(([, entry]) => stockAssetAllowedForGender(entry, context.preferences || {}))
    .map(([key, entry]) => {
      const descriptor = stockDescriptor(key, entry);
      const score = scoreLlmCandidate(task.request, descriptor, { fallback: !!entry.fallback });
      if (score == null) return null;
      return { key, entry, descriptor, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ key, entry, score }) => ({
      ...compactStockAssetForLlm(key, entry),
      score: Math.round(score),
    }));
}

function wardrobeAssetsForLlmTask(task = {}, wardrobeItems = [], limit = 20) {
  return (Array.isArray(wardrobeItems) ? wardrobeItems : [])
    .map((item) => {
      const descriptor = wardrobeDescriptor(item);
      if (!descriptor.path) return null;
      const score = scoreLlmCandidate(task.request, descriptor);
      if (score == null) return null;
      const identity = wardrobeIdentityForRequest(task.request, descriptor, item);
      if (!identity.ok) return null;
      return { item, score: score + identity.score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, score }) => ({
      ...compactWardrobeAssetForLlm(item),
      score: Math.round(score),
    }));
}

async function selectAssetForSlotWithLlm(task = {}, catalog = {}, wardrobeItems = [], context = {}, services = {}, assetRoot = "") {
  const chatCompletion = services.chatCompletion;
  const parseModelJson = services.parseModelJson || JSON.parse;
  if (!chatCompletion || !task?.outputKey) return null;

  const stockAssets = stockAssetsForLlmTask(task, catalog, context, assetRoot);
  const wardrobeAssets = wardrobeAssetsForLlmTask(task, wardrobeItems);
  if (!stockAssets.length && !wardrobeAssets.length) return null;

  const prompt = buildLlmAssetSelectionPrompt(task, stockAssets, wardrobeAssets);
  try {
    const startedAt = Date.now();
    services.log?.("info", "asset_slot_llm_started", {
      outputKey: task.outputKey,
      slot: task.slot,
      promptChars: prompt.length,
      stockCount: stockAssets.length,
      wardrobeCount: wardrobeAssets.length,
      gender: context.preferences?.gender || "unspecified",
    });
    const text = await chatCompletion([{ role: "user", content: prompt }], {
      maxTokens: 150,
      compactJsonRetry: true,
      traceLabel: `asset-slot-match:${task.outputKey}`,
      timeoutMs: 12000,
    });
    const parsed = parseModelJson(text);
    const selection = parsed?.matches?.[task.outputKey] || (task.outputKey === "accessory-0" ? parsed?.matches?.accessory : null) || parsed;
    services.log?.("info", "asset_slot_llm_completed", {
      outputKey: task.outputKey,
      slot: task.slot,
      durationMs: Date.now() - startedAt,
      source: cleanText(selection?.source),
      key: cleanText(selection?.key),
      id: cleanText(selection?.id),
    });
    return selection && typeof selection === "object" ? selection : null;
  } catch (err) {
    services.log?.("warn", "asset_slot_llm_failed", {
      error: err?.message || String(err),
      outputKey: task.outputKey,
      slot: task.slot,
    });
    return null;
  }
}

async function selectAssetsWithParallelSlotLlms(tasks = [], catalog = {}, wardrobeItems = [], context = {}, services = {}, assetRoot = "") {
  if (!tasks.length) return {};
  const startedAt = Date.now();
  services.log?.("info", "asset_parallel_slot_llm_started", {
    slots: tasks.map((task) => task.outputKey),
    gender: context.preferences?.gender || "unspecified",
  });
  const settled = await Promise.allSettled(tasks.map((task) =>
    selectAssetForSlotWithLlm(task, catalog, wardrobeItems, context, services, assetRoot)
  ));
  const selections = {};
  settled.forEach((result, index) => {
    const task = tasks[index];
    selections[task.outputKey] = result.status === "fulfilled" ? result.value : null;
  });
  services.log?.("info", "asset_parallel_slot_llm_completed", {
    durationMs: Date.now() - startedAt,
    slots: tasks.map((task) => task.outputKey),
    fulfilled: settled.filter((result) => result.status === "fulfilled" && result.value).length,
    rejected: settled.filter((result) => result.status === "rejected").length,
  });
  return selections;
}

export function validateStockCatalogIntegrity(catalog = {}, { assetRoot = "", log = console.warn } = {}) {
  const issues = [];
  for (const [key, entry] of Object.entries(catalog || {})) {
    const path = String(entry?.path || "");
    const descriptor = stockDescriptor(key, entry || {});
    if (!path) issues.push({ key, issue: "missing_path" });
    else if (!IMAGE_RE.test(path)) issues.push({ key, path, issue: "invalid_image_extension" });
    else if (!RASTER_RE.test(path)) issues.push({ key, path, issue: "non_raster_main_asset" });
    else if (assetRoot && !existsSync(join(assetRoot, path))) issues.push({ key, path, issue: "missing_file" });
    if (!descriptor.slot) issues.push({ key, path, issue: "missing_slot" });
    if (!descriptor.subtype) issues.push({ key, path, issue: "missing_subtype" });
    if (!descriptor.colors.length) issues.push({ key, path, issue: "missing_color_tags" });
  }
  if (issues.length && log) log("[assetMatcher] catalog integrity issues", { count: issues.length, issues: issues.slice(0, 25) });
  return issues;
}

export async function buildRobustRecommendationAssetMatches(outfit = {}, wardrobeItems = [], preferredKeys = null, context = {}, options = {}) {
  const catalog = options.catalog || {};
  const services = options.services || {};
  const assetRoot = options.assetRoot || "";
  const output = {};
  const usedItemIds = new Set();
  const tasks = [];
  for (const slot of ["top", "bottom", "outer", "shoes"]) {
    const itemName = cleanText(outfit?.[slot]);
    if (itemName) tasks.push({ slot, itemName, outputKey: slot });
  }
  const accessories = Array.isArray(outfit?.accessories) ? outfit.accessories : [outfit?.accessories];
  accessories.map(cleanText).filter(Boolean).slice(0, 1).forEach((itemName, index) => {
    tasks.push({ slot: "accessory", itemName, outputKey: `accessory-${index}` });
  });
  for (const task of tasks) {
    const [key, match] = await matchSlot({
      ...task,
      catalog,
      wardrobeItems,
      usedItemIds,
      context,
      services,
      assetRoot,
      preferredKeys,
    });
    output[key] = match || null;
  }
  return output;
}

export async function buildLlmSelectedRecommendationAssetMatches(outfit = {}, wardrobeItems = [], preferredKeys = null, context = {}, options = {}) {
  const catalog = options.catalog || {};
  const services = options.services || {};
  const assetRoot = options.assetRoot || "";
  const output = {};
  const tasks = [];
  for (const slot of ["top", "bottom", "outer", "shoes"]) {
    const itemName = cleanText(outfit?.[slot]);
    if (itemName) {
      tasks.push({
        slot,
        itemName,
        outputKey: slot,
        request: requestDescriptor(slot, itemName, context),
      });
    }
  }
  const accessories = Array.isArray(outfit?.accessories) ? outfit.accessories : [outfit?.accessories];
  accessories.map(cleanText).filter(Boolean).slice(0, 1).forEach((itemName, index) => {
    tasks.push({
      slot: "accessory",
      itemName,
      outputKey: `accessory-${index}`,
      request: requestDescriptor("accessory", itemName, context),
    });
  });

  const selections = await selectAssetsWithParallelSlotLlms(tasks, catalog, wardrobeItems, context, services, assetRoot);
  services.log?.("info", "asset_parallel_slot_llm_selection", {
    selections: tasks.map((task) => ({
      outputKey: task.outputKey,
      source: cleanText(selections?.[task.outputKey]?.source || (task.outputKey === "accessory-0" ? selections?.accessory?.source : "")),
      key: cleanText(selections?.[task.outputKey]?.key || (task.outputKey === "accessory-0" ? selections?.accessory?.key : "")),
      id: cleanText(selections?.[task.outputKey]?.id || (task.outputKey === "accessory-0" ? selections?.accessory?.id : "")),
      confidence: selections?.[task.outputKey]?.confidence ?? (task.outputKey === "accessory-0" ? selections?.accessory?.confidence : null),
    })),
  });
  const usedItemIds = new Set();
  for (const task of tasks) {
    const selection = selections?.[task.outputKey] || (task.outputKey === "accessory-0" ? selections?.accessory : null) || null;
    const source = cleanText(selection?.source).toLowerCase();
    const confidence = Number(selection?.confidence);
    const reason = cleanText(selection?.reason).slice(0, 100);
    let match = null;

    if (source === "wardrobe" || selection?.id) {
      const candidate = wardrobeCandidateById(selection?.id, wardrobeItems, task.request);
      const id = String(candidate?.item?.id ?? candidate?.item?.name ?? "");
      if (candidate && (!id || !usedItemIds.has(id)) && (!Number.isFinite(confidence) || confidence >= 55)) {
        match = buildWardrobeMatch({
          ...candidate,
          confidence: Number.isFinite(confidence) ? Math.round(confidence) : candidate.confidence,
          reasons: unique([...(candidate.reasons || []), reason ? `llm_reason:${reason}` : ""]),
        }, task.request, { adjudicated: true });
        if (Number.isFinite(confidence)) match.confidence = Math.max(match.confidence || 0, Math.round(confidence));
        if (id) usedItemIds.add(id);
      }
    } else if (source === "stock" || source === "llm_stock" || selection?.key) {
      const candidate = stockCandidateByKey(selection?.key, catalog, task.request, context);
      if (candidate && (!Number.isFinite(confidence) || confidence >= 55)) {
        match = buildStockMatch({
          ...candidate,
          score: Number.isFinite(confidence) ? Math.max(12, confidence - 46) : candidate.score,
          reasons: unique([...(candidate.reasons || []), reason ? `llm_reason:${reason}` : ""]),
        }, task.request, { source: "llm_stock", adjudicated: true, llmReason: reason });
        if (Number.isFinite(confidence)) match.confidence = Math.max(match.confidence || 0, Math.round(confidence));
      }
    }

    output[task.outputKey] = match || buildFallbackMatch(task.request, catalog, assetRoot);
  }
  return output;
}

export function buildRobustRecommendationImageMatches(outfit = {}, preferredKeys = null, context = {}, options = {}) {
  const catalog = options.catalog || {};
  const assetRoot = options.assetRoot || "";
  const output = {};
  for (const slot of ["top", "bottom", "outer", "shoes"]) {
    const itemName = cleanText(outfit?.[slot]);
    if (!itemName) continue;
    const request = requestDescriptor(slot, itemName, context);
    const best = stockCandidatesForRequest(request, catalog, context, assetRoot)[0];
    output[slot] = best && confidenceFromScore(best.score, 44) >= 68
      ? buildStockMatch(best, request)
      : buildFallbackMatch(request, catalog, assetRoot);
  }
  const accessories = Array.isArray(outfit?.accessories) ? outfit.accessories : [outfit?.accessories];
  accessories.map(cleanText).filter(Boolean).slice(0, 1).forEach((itemName, index) => {
    const request = requestDescriptor("accessory", itemName, context);
    const best = stockCandidatesForRequest(request, catalog, context, assetRoot)[0];
    output[`accessory-${index}`] = best && confidenceFromScore(best.score, 44) >= 68
      ? buildStockMatch(best, request)
      : buildFallbackMatch(request, catalog, assetRoot);
  });
  return output;
}

export const __assetMatcherTest = {
  cleanText,
  normalizeText,
  normalizeSlot,
  inferSubtype,
  familyFor,
  requestDescriptor,
  stockDescriptor,
  hardGate,
  descriptorScore,
  stockCandidatesForRequest,
  buildFallbackMatch,
  buildLlmAssetSelectionPrompt,
};
