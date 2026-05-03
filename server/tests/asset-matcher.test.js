import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLlmSelectedRecommendationAssetMatches,
  buildRobustRecommendationAssetMatches,
  buildRobustRecommendationImageMatches,
  __assetMatcherTest,
} from "../assetMatcher.js";

const catalog = {
  accessory_black_watch: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-black-watch-metal-studio.jpg",
    description: "black metal watch",
    keywords: ["black watch", "wristwatch", "metal watch"],
  },
  accessory_black_beanie: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-knit-beanies-outdoors-studio.jpg",
    description: "black wool knit beanie",
    keywords: ["black beanie", "black wool hat", "knit hat", "winter hat"],
  },
  accessory_cream_scarf: {
    slot: "accessory",
    path: "assets/recommendation-stock/accessory-cream-lightweight-scarf-linen-studio.png",
    description: "cream wool scarf",
    keywords: ["cream scarf", "wool scarf", "warm scarf"],
  },
  bottom_dark_jeans: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-dark-indigo-jeans-denim-studio.png",
    description: "dark indigo denim jeans",
    keywords: ["navy jeans", "dark jeans", "indigo denim jeans"],
  },
  bottom_black_trousers: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-black-trousers-studio.jpg",
    description: "black trousers",
    keywords: ["black trousers", "pants", "slacks"],
  },
  bottom_tan_chinos: {
    slot: "bottom",
    path: "assets/recommendation-stock/bottom-tan-chinos-cotton-studio.jpg",
    description: "tan cotton chinos",
    keywords: ["tan chinos", "cotton chinos"],
  },
  shoes_white_canvas: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-white-canvas-sneakers-canvas-studio.png",
    description: "white canvas sneakers",
    keywords: ["white canvas sneakers", "canvas trainers"],
  },
  shoes_generic: {
    slot: "shoes",
    path: "assets/recommendation-stock/shoes-black-white-sneakers-studio.jpg",
    description: "black and white sneakers",
    keywords: ["sneakers", "trainers"],
  },
};

function syncMatch(outfit, itemDetails = {}) {
  return buildRobustRecommendationImageMatches(outfit, null, { itemDetails }, { catalog });
}

test("black wool hat chooses a beanie, never a watch", () => {
  const matches = syncMatch({ accessories: ["Black Wool Hat"] }, { accessory: { color: "black", material: "wool" } });
  assert.equal(matches["accessory-0"].key, "accessory_black_beanie");
  assert.notEqual(matches["accessory-0"].key, "accessory_black_watch");
});

test("black watch chooses a watch, never a hat", () => {
  const matches = syncMatch({ accessories: ["Black Watch"] }, { accessory: { color: "black", material: "metal" } });
  assert.equal(matches["accessory-0"].key, "accessory_black_watch");
});

test("navy jeans choose denim instead of black trousers", () => {
  const matches = syncMatch({ bottom: "Navy Jeans" }, { bottom: { color: "navy", material: "denim" } });
  assert.equal(matches.bottom.key, "bottom_dark_jeans");
});

test("white canvas sneakers choose canvas sneakers", () => {
  const matches = syncMatch({ shoes: "White Canvas Sneakers" }, { shoes: { color: "white", material: "canvas" } });
  assert.equal(matches.shoes.key, "shoes_white_canvas");
});

test("tan chinos choose tan chinos instead of black trousers", () => {
  const matches = syncMatch({ bottom: "Tan Chinos" }, { bottom: { color: "tan", material: "cotton" } });
  assert.equal(matches.bottom.key, "bottom_tan_chinos");
});

test("cream wool scarf chooses scarf, not beanie or watch", () => {
  const matches = syncMatch({ accessories: ["Cream Wool Scarf"] }, { accessory: { color: "cream", material: "wool" } });
  assert.equal(matches["accessory-0"].key, "accessory_cream_scarf");
});

test("low-confidence ambiguous stock cases can be adjudicated by LLM", async () => {
  const ambiguousCatalog = {
    accessory_gray_watch: {
      slot: "accessory",
      path: "assets/recommendation-stock/accessory-gray-watch-metal-studio.jpg",
      description: "gray metal watch",
      keywords: ["watch", "metal watch"],
    },
    accessory_black_watch: catalog.accessory_black_watch,
  };
  let called = false;
  const matches = await buildRobustRecommendationAssetMatches(
    { accessories: ["Polished Accessory"] },
    [],
    null,
    { itemDetails: { accessory: { color: "", material: "" } } },
    {
      catalog: ambiguousCatalog,
      services: {
        chatCompletion: async () => {
          called = true;
          return JSON.stringify({ selectedKey: "accessory_black_watch", confidence: 92, reason: "dark watch is closest" });
        },
        parseModelJson: JSON.parse,
      },
    }
  );
  assert.equal(called, true);
  assert.equal(matches["accessory-0"].key, "accessory_black_watch");
  assert.equal(matches["accessory-0"].source, "llm_stock");
});

test("LLM cannot override hard-gate incompatibilities", async () => {
  const matches = await buildRobustRecommendationAssetMatches(
    { accessories: ["Black Wool Hat"] },
    [],
    null,
    { itemDetails: { accessory: { color: "black", material: "wool" } } },
    {
      catalog,
      services: {
        chatCompletion: async () => JSON.stringify({ selectedKey: "accessory_black_watch", confidence: 99, reason: "bad pick" }),
        parseModelJson: JSON.parse,
      },
    }
  );
  assert.notEqual(matches["accessory-0"].key, "accessory_black_watch");
  assert.equal(matches["accessory-0"].key, "accessory_black_beanie");
});

test("wardrobe photos are not used for generic compatible recommendations", async () => {
  const matches = await buildRobustRecommendationAssetMatches(
    { top: "Knit Cardigan" },
    [{
      id: "w1",
      type: "top",
      name: "Cream Knit Cardigan",
      color: "Cream",
      material: "Wool knit",
      photoDataUrl: "data:image/jpeg;base64,wardrobe",
    }],
    null,
    { itemDetails: { top: { material: "knit" } } },
    { catalog }
  );
  assert.notEqual(matches.top?.source, "wardrobe");
});

test("wardrobe photos are used when the recommendation names the wardrobe item", async () => {
  const matches = await buildRobustRecommendationAssetMatches(
    { top: "Cream Knit Cardigan" },
    [{
      id: "w1",
      type: "top",
      name: "Cream Knit Cardigan",
      color: "Cream",
      material: "Wool knit",
      photoDataUrl: "data:image/jpeg;base64,wardrobe",
    }],
    null,
    { itemDetails: { top: { color: "cream", material: "knit" } } },
    { catalog }
  );
  assert.equal(matches.top?.source, "wardrobe");
  assert.equal(matches.top?.itemName, "Cream Knit Cardigan");
});

test("hard gate rejects impossible accessory family matches", () => {
  const request = __assetMatcherTest.requestDescriptor("accessory", "Black Wool Hat", { itemDetails: { accessory: { color: "black", material: "wool" } } });
  const watch = __assetMatcherTest.stockDescriptor("accessory_black_watch", catalog.accessory_black_watch);
  assert.equal(__assetMatcherTest.hardGate(request, watch).ok, false);
});

test("slot LLM prompt excludes weather/preferences and gender-filters stock", async () => {
  const genderedCatalog = {
    top_masculine_button_down: {
      slot: "top",
      gender: "masculine",
      path: "assets/recommendation-stock/top-masculine-button-down.jpg",
      description: "masculine button-down shirt",
      keywords: ["button-down shirt"],
    },
    top_feminine_blouse: {
      slot: "top",
      gender: "feminine",
      path: "assets/recommendation-stock/top-feminine-blouse.jpg",
      description: "feminine blouse",
      keywords: ["blouse", "shirt"],
    },
    top_unisex_tee: {
      slot: "top",
      gender: "unisex",
      path: "assets/recommendation-stock/top-unisex-tee.jpg",
      description: "unisex tee",
      keywords: ["tee", "shirt"],
    },
  };
  let prompt = "";
  const matches = await buildLlmSelectedRecommendationAssetMatches(
    { top: "Soft Blouse" },
    [],
    null,
    {
      weather: { weatherLabel: "Rain", temperature: 4 },
      preferences: { gender: "female", styleFocus: "formal" },
      itemDetails: { top: { color: "white", material: "cotton" } },
    },
    {
      catalog: genderedCatalog,
      services: {
        chatCompletion: async (messages) => {
          prompt = messages[0].content;
          return JSON.stringify({
            matches: {
              top: { source: "stock", key: "top_feminine_blouse", confidence: 91, reason: "closest blouse" },
            },
          });
        },
        parseModelJson: JSON.parse,
      },
    }
  );

  assert.equal(prompt.includes("Context:"), false);
  assert.equal(prompt.includes("Rain"), false);
  assert.equal(prompt.includes("formal"), false);
  assert.equal(prompt.includes("top_masculine_button_down"), false);
  assert.equal(prompt.includes("top_feminine_blouse"), true);
  assert.equal(prompt.includes("top_unisex_tee"), true);
  assert.equal(matches.top.key, "top_feminine_blouse");
});

test("slot LLM calls run in parallel and receive only their slot candidates", async () => {
  const slotCatalog = {
    top_unisex_tee: {
      slot: "top",
      gender: "unisex",
      path: "assets/recommendation-stock/top-unisex-tee.jpg",
      description: "white cotton tee",
      keywords: ["white tee", "cotton tee"],
    },
    shoes_white_canvas: {
      slot: "shoes",
      gender: "unisex",
      path: "assets/recommendation-stock/shoes-white-canvas.jpg",
      description: "white canvas sneakers",
      keywords: ["white canvas sneakers"],
    },
  };
  let active = 0;
  let maxActive = 0;
  const prompts = [];
  const matches = await buildLlmSelectedRecommendationAssetMatches(
    { top: "White Cotton Tee", shoes: "White Canvas Sneakers" },
    [],
    null,
    {
      itemDetails: {
        top: { color: "white", material: "cotton" },
        shoes: { color: "white", material: "canvas" },
      },
      preferences: { gender: "unspecified" },
    },
    {
      catalog: slotCatalog,
      services: {
        chatCompletion: async (messages) => {
          const prompt = messages[0].content;
          prompts.push(prompt);
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 25));
          active -= 1;
          if (prompt.includes('"outputKey":"top"')) {
            assert.equal(prompt.includes("shoes_white_canvas"), false);
            return JSON.stringify({ source: "stock", key: "top_unisex_tee", confidence: 95, reason: "tee match" });
          }
          if (prompt.includes('"outputKey":"shoes"')) {
            assert.equal(prompt.includes("top_unisex_tee"), false);
            return JSON.stringify({ source: "stock", key: "shoes_white_canvas", confidence: 95, reason: "sneaker match" });
          }
          return JSON.stringify({ source: null, confidence: 0, reason: "unexpected slot" });
        },
        parseModelJson: JSON.parse,
      },
    }
  );

  assert.equal(prompts.length, 2);
  assert.equal(maxActive, 2);
  assert.equal(matches.top.key, "top_unisex_tee");
  assert.equal(matches.shoes.key, "shoes_white_canvas");
});
