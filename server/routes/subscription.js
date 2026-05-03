import { Router } from "express";
import { requireAuth } from "../auth.js";
import { syncVerifiedStoreKitSubscription } from "../storekit.js";

const router = Router();

router.use(requireAuth);

router.post("/snapshot", async (req, res) => {
  try {
    const subscription = await syncVerifiedStoreKitSubscription(req.userId, req.body || {});
    res.json({ ok: true, subscription });
  } catch (err) {
    console.error("subscription snapshot error:", err);
    const status = Number(err.status || 0) || (/StoreKit|transaction|signature|certificate|bundleId|product/i.test(err.message || "") ? 422 : 500);
    res.status(status).json({ error: status === 500 ? "Failed to sync subscription state" : err.message });
  }
});

export default router;
