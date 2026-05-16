import express from "express";
import * as businessController from "../controllers/businessController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", businessController.getProfile);
router.put("/", protect, businessController.updateProfile);

export default router;
