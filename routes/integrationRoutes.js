import express from 'express';
const router = express.Router();
import { getIntegrations, updateIntegrations } from '../controllers/integrationController.js';
import { protect, authorize } from '../middleware/auth.js';

router.route('/')
  .get(protect, authorize('admin'), getIntegrations)
  .put(protect, authorize('admin'), updateIntegrations);

export default router;
