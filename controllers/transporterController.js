import Transporter from '../models/Transporter.js';

// @desc    Get all transporters
// @route   GET /api/transporters
export const getTransporters = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { vehicleNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Transporter.countDocuments(query);
    const transporters = await Transporter.find(query)
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: transporters,
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

// @desc    Get single transporter
// @route   GET /api/transporters/:id
export const getTransporter = async (req, res, next) => {
  try {
    const transporter = await Transporter.findById(req.params.id);

    if (!transporter) {
      return res.status(404).json({
        success: false,
        message: 'Transporter not found',
      });
    }

    res.status(200).json({
      success: true,
      data: transporter,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create transporter
// @route   POST /api/transporters
export const createTransporter = async (req, res, next) => {
  try {
    const transporter = await Transporter.create(req.body);
    res.status(201).json({
      success: true,
      data: transporter,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update transporter
// @route   PUT /api/transporters/:id
export const updateTransporter = async (req, res, next) => {
  try {
    const transporter = await Transporter.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!transporter) {
      return res.status(404).json({
        success: false,
        message: 'Transporter not found',
      });
    }

    res.status(200).json({
      success: true,
      data: transporter,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete transporter (soft delete)
// @route   DELETE /api/transporters/:id
export const deleteTransporter = async (req, res, next) => {
  try {
    const transporter = await Transporter.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!transporter) {
      return res.status(404).json({
        success: false,
        message: 'Transporter not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Transporter deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
