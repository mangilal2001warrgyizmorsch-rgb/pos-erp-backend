import AuditLog from '../models/AuditLog.js';

/**
 * Utility to record an audit log
 * 
 * @param {Object} params
 * @param {Object} params.req - Express request object (for IP and User info)
 * @param {String} params.action - Action performed ('create', 'update', 'delete', 'login', etc.)
 * @param {String} params.module - Module affected (e.g. 'Sale', 'Product', 'Purchase')
 * @param {String} params.description - Human readable description
 * @param {Object} params.details - Detailed JSON (e.g. before/after state)
 * @param {Object} session - Mongoose session (optional)
 */
export const logActivity = async ({ req, action, module, description, details }, session = null) => {
  try {
    const log = new AuditLog({
      user: req.user ? req.user._id : null,
      userName: req.user ? req.user.name : 'System',
      action,
      module,
      description,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
    });

    if (session) {
      await log.save({ session });
    } else {
      await log.save();
    }
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};
