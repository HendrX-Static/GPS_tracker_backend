import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";
import { getDevices } from "../controllers/deviceController.js";
import { getPositions } from "../controllers/positionController.js";

const router = express.Router();

router.get("/devices", authMiddleware, getDevices);
router.get("/positions", getPositions);
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