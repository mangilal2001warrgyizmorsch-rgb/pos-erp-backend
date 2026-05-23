import Supplier from '../models/Supplier.js';

// @desc    Get all suppliers
// @route   GET /api/suppliers
export const getSuppliers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, hasBalance } = req.query;

    const query = { isActive: true };
    const filterConditions = [];

    if (search) {
      filterConditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { gstNumber: { $regex: search, $options: 'i' } },
        ]
      });
    }

    if (hasBalance === 'true') {
      filterConditions.push({
        $or: [
          { outstandingBalance: { $gt: 0 } },
          { $and: [ { openingBalanceType: 'Payable' }, { openingBalance: { $gt: 0 } } ] }
        ]
      });
    }

    if (filterConditions.length > 0) {
      query.$and = filterConditions;
    }

    const total = await Supplier.countDocuments(query);
    const suppliers = await Supplier.find(query)
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.status(200).json({
      success: true,
      data: suppliers,
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

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
export const getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    res.status(200).json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create supplier
// @route   POST /api/suppliers
export const createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    res.status(200).json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete supplier (soft delete)
// @route   DELETE /api/suppliers/:id
export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
