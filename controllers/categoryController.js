import Category from '../models/Category.js';
import Product from '../models/Product.js';

// @desc    Get all categories
// @route   GET /api/categories
export const getCategories = async (req, res, next) => {
  try {
    const { search, all, page, limit = 15 } = req.query;
    const query = {};
    if (all !== 'true') {
      query.isActive = true;
    }
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    let categories;
    let total;
    let pagination = null;

    if (page) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 15;
      total = await Category.countDocuments(query);
      categories = await Category.find(query)
        .sort('name')
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
      
      pagination = {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      };
    } else {
      categories = await Category.find(query).sort('name');
    }

    // Aggregate product counts
    const productCounts = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    productCounts.forEach(pc => {
      if (pc._id) {
        countMap[pc._id.toString()] = pc.count;
      }
    });

    const data = categories.map(cat => {
      const doc = cat.toObject();
      doc.productCount = countMap[cat._id.toString()] || 0;
      return doc;
    });

    res.status(200).json({
      success: true,
      data,
      ...(pagination && { pagination })
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create category
// @route   POST /api/categories
export const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    // Check for existing active category with same name
    const existing = await Category.findOne({ name, isActive: true });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists'
      });
    }

    const count = await Category.countDocuments();
    req.body.customId = `CAT-${(count + 1).toString().padStart(3, '0')}`;
    const category = await Category.create(req.body);
    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
export const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category (soft delete)
// @route   DELETE /api/categories/:id
export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
