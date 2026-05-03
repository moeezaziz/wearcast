import { createPublicKey, verify, X509Certificate } from "crypto";
import { upsertUserSubscription } from "./premium.js";

const PRODUCT_PLANS = new Map([
  ["wearcast_ai_premium_monthly", "monthly"],
  ["wearcast_ai_premium_annual", "annual"],
]);

function base64UrlDecode(value = "") {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function parseJwtPart(value) {
  try {
    return JSON.parse(base64UrlDecode(value).toString("utf8"));
  } catch {
    return null;
  }
}

function trimPositiveInteger(bytes) {
  let offset = 0;
  while (offset < bytes.length - 1 && bytes[offset] === 0) offset += 1;
  let value = bytes.slice(offset);
  if (value[0] & 0x80) value = Buffer.concat([Buffer.from([0]), value]);
  return value;
}

function derLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  const bytes = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function ecdsaJoseToDer(signature) {
  if (signature.length !== 64) throw new Error("Invalid ES256 signature length");
  const r = trimPositiveInteger(signature.slice(0, 32));
  const s = trimPositiveInteger(signature.slice(32));
  const sequence = Buffer.concat([
    Buffer.from([0x02]),
    derLength(r.length),
    r,
    Buffer.from([0x02]),
    derLength(s.length),
    s,
  ]);
  return Buffer.concat([Buffer.from([0x30]), derLength(sequence.length), sequence]);
}

function verifyCertificateChain(x5c = [], now = new Date()) {
  if (!Array.isArray(x5c) || x5c.length < 2) {
    throw new Error("StoreKit JWS is missing certificate chain");
  }
  const certs = x5c.map((entry) => new X509Certificate(Buffer.from(entry, "base64")));
  for (const cert of certs) {
    if (Date.parse(cert.validFrom) > now.getTime() || Date.parse(cert.validTo) < now.getTime()) {
      throw new Error("StoreKit certificate is outside its validity window");
    }
  }
  for (let i = 0; i < certs.length - 1; i += 1) {
    if (!certs[i].verify(certs[i + 1].publicKey)) {
      throw new Error("StoreKit certificate chain signature is invalid");
    }
  }
  const root = certs[certs.length - 1];
  if (!root.subject.includes("Apple Root CA") || !root.verify(root.publicKey)) {
    throw new Error("StoreKit certificate chain does not terminate at Apple Root CA");
  }
  return certs[0];
}

export function verifyStoreKitJws(signedValue, { bundleId = process.env.APP_BUNDLE_ID || "com.wearcast.app", now = Date.now() } = {}) {
  const parts = String(signedValue || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid StoreKit JWS shape");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJwtPart(encodedHeader);
  const payload = parseJwtPart(encodedPayload);
  if (!header || !payload) throw new Error("Invalid StoreKit JWS payload");
  if (header.alg !== "ES256") throw new Error("Unsupported StoreKit JWS algorithm");

  const leafCert = verifyCertificateChain(header.x5c, new Date(now));
  const ok = verify(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey(leafCert.publicKey),
    ecdsaJoseToDer(base64UrlDecode(encodedSignature))
  );
  if (!ok) throw new Error("Invalid StoreKit JWS signature");

  if (payload.bundleId !== bundleId) throw new Error("StoreKit transaction bundleId mismatch");
  if (!PRODUCT_PLANS.has(payload.productId)) throw new Error("Unsupported StoreKit product");
  return payload;
}

function deriveSubscriptionFromTransactions(transactions = [], { bundleId, now = Date.now() } = {}) {
  const verified = [];
  for (const entry of transactions) {
    const signedTransactionInfo = typeof entry === "string" ? entry : entry?.signedTransactionInfo;
    if (!signedTransactionInfo) continue;
    verified.push(verifyStoreKitJws(signedTransactionInfo, { bundleId, now }));
  }
  const active = verified
    .filter((transaction) => !transaction.revocationDate)
    .filter((transaction) => !transaction.expiresDate || Number(transaction.expiresDate) > now)
    .filter((transaction) => PRODUCT_PLANS.has(transaction.productId))
    .sort((a, b) => {
      const planScore = PRODUCT_PLANS.get(b.productId) === "annual" ? 1 : 0;
      const otherPlanScore = PRODUCT_PLANS.get(a.productId) === "annual" ? 1 : 0;
      return planScore - otherPlanScore || Number(b.expiresDate || b.purchaseDate || 0) - Number(a.expiresDate || a.purchaseDate || 0);
    });

  if (!active.length) {
    return { status: "free", plan: "free", trialActive: false, renewalStatus: "none" };
  }
  const best = active[0];
  const trialActive = best.offerType === 1 || best.offerType === "INTRODUCTORY";
  return {
    status: trialActive ? "premium_trial" : "premium_active",
    plan: PRODUCT_PLANS.get(best.productId) || "free",
    trialActive,
    renewalStatus: "active",
  };
}

export async function syncVerifiedStoreKitSubscription(userId, snapshot = {}) {
  const transactions = Array.isArray(snapshot.transactions) ? snapshot.transactions : [];
  if (!transactions.length) {
    if ("status" in snapshot || "plan" in snapshot || "trialActive" in snapshot || "renewalStatus" in snapshot) {
      throw Object.assign(new Error("Subscription status must come from signed StoreKit transactions"), { status: 422 });
    }
    return upsertUserSubscription(userId, {
      status: "free",
      plan: "free",
      trialActive: false,
      renewalStatus: "none",
    });
  }
  const subscription = deriveSubscriptionFromTransactions(transactions);
  return upsertUserSubscription(userId, subscription);
}
