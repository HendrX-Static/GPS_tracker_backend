import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";
import { 
  getDevices, 
  createDevice, 
  assignDeviceToUser 
} from "../controllers/deviceController.js";
import { getPositions } from "../controllers/positionController.js";
import { assignDevice } from "../controllers/deviceController.js";
import { syncDevices } from "../services/deviceSyncService.js";
import { adminOnly } from "../middleware/roles.js";

const router = express.Router();

router.get("/sync-devices", async (req, res) => {
  await syncDevices();
  res.json({ message: "Synced" });
});
router.post("/devices", authMiddleware, adminOnly, createDevice);
router.post("/assign-device", authMiddleware, adminOnly, assignDeviceToUser);
router.get("/devices", authMiddleware, getDevices);
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