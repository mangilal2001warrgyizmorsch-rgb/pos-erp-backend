import AuditLog from '../models/AuditLog.js';

export const getActivityLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, user, action, module, startDate, endDate } = req.query;

    const query = {};

    if (user) {
      if (user.match(/^[0-9a-fA-F]{24}$/)) {
        query.user = user;
      } else {
        query.userName = { $regex: user, $options: 'i' };
      }
    }
    if (action) {
      query.action = action;
    }
    if (module) {
      query.module = module;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('user', 'name role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};
