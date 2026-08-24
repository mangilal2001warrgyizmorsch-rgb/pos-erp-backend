import Integration from '../models/Integration.js';

// @desc    Get integration settings
// @route   GET /api/integrations
// @access  Private/Admin
export const getIntegrations = async (req, res, next) => {
  try {
    let integration = await Integration.findOne();
    if (!integration) {
      integration = await Integration.create({});
    }
    res.status(200).json({
      success: true,
      data: integration,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update integration settings
// @route   PUT /api/integrations
// @access  Private/Admin
export const updateIntegrations = async (req, res, next) => {
  try {
    let integration = await Integration.findOne();
    
    if (!integration) {
      integration = await Integration.create(req.body);
    } else {
      integration = await Integration.findByIdAndUpdate(
        integration._id,
        req.body,
        { new: true, runValidators: true }
      );
    }

    res.status(200).json({
      success: true,
      data: integration,
    });
  } catch (error) {
    next(error);
  }
};
