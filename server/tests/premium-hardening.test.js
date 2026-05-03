import test from "node:test";
import assert from "node:assert/strict";
import { syncVerifiedStoreKitSubscription, verifyStoreKitJws } from "../storekit.js";

test("direct client subscription status cannot grant premium", async () => {
  await assert.rejects(
    () => syncVerifiedStoreKitSubscription(1, {
      status: "premium_active",
      plan: "annual",
      trialActive: false,
      renewalStatus: "active",
    }),
    /signed StoreKit transactions/
  );
});

test("fake StoreKit transaction JWS is rejected", () => {
  assert.throws(() => verifyStoreKitJws("fake.fake.fake"), /Invalid StoreKit JWS payload|Invalid StoreKit JWS shape/);
});
