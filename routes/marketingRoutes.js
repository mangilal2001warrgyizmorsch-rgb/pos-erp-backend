import express from "express";
import { getCampaigns, getCampaignLogs, createCampaign } from "../controllers/marketingController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/campaigns", protect, getCampaigns);
router.post("/campaigns", protect, authorize('admin', 'manager'), createCampaign);
router.get("/campaigns/:id/logs", protect, getCampaignLogs);

export default router;
