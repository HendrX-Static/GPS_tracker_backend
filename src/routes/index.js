import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { 
  getDevices, 
  createDevice, 
  assignDeviceToUser,
  getDevicesForUser,
  unassignDeviceFromUser,
  deleteDevice
} from "../controllers/deviceController.js";
import { getPositions } from "../controllers/positionController.js";
import { syncDevices } from "../services/deviceSyncService.js";
import { adminOnly } from "../middleware/roles.js";
import { getUsers } from "../controllers/userController.js";

const router = express.Router();

router.get("/sync-devices", async (req, res) => {
  await syncDevices();
  res.json({ message: "Synced" });
});
router.post("/devices", authMiddleware, adminOnly, createDevice);
router.delete("/devices/:deviceId", authMiddleware, adminOnly, deleteDevice);
router.post("/assign-device", authMiddleware, adminOnly, assignDeviceToUser);
router.post("/unassign-device", authMiddleware, adminOnly, unassignDeviceFromUser);
router.get("/devices", authMiddleware, getDevices);
router.get("/users", authMiddleware, adminOnly, getUsers);
router.get("/users/:userId/devices", authMiddleware, adminOnly, getDevicesForUser);
router.get("/positions", authMiddleware, getPositions);
router.get("/me", authMiddleware, (req, res) => {
  res.json(req.user);
});

export default router;
