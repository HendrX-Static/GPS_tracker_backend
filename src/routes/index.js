import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";
import { getDevices } from "../controllers/deviceController.js";
import { getPositions } from "../controllers/positionController.js";
import { assignDevice } from "../controllers/deviceController.js";
import { registerDevice } from "../controllers/deviceController.js";
import { syncDevices } from "../services/deviceSyncService.js";

const router = express.Router();

router.get("/sync-devices", async (req, res) => {
  await syncDevices();
  res.json({ message: "Synced" });
});
router.post("/register-device", authMiddleware, registerDevice);
router.get("/devices", (req, res, next) => {
  console.log("DEVICES ROUTE HIT");
  next();
}, getDevices);
router.get("/positions", authMiddleware, getPositions);
router.get("/me", authMiddleware, (req, res) => {
  res.json(req.user);
});
router.post(
  "/assign-device",
  authMiddleware,
  requireAdmin,
  assignDevice
);

export default router;