import express from 'express';
import { getActivityLogs } from '../controllers/activityLogController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Only admin can view audit logs
router.get('/', protect, authorize('admin'), getActivityLogs);

export default router;
