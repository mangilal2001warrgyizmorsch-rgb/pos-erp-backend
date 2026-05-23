import Subcategory from '../models/Subcategory.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

export const getSubcategories = async (req, res, next) => {
  try {
    const { search, parentCategoryId, all, page, limit = 15 } = req.query;
    const query = {};
    if (all !== 'true') {
      query.isActive = true;
    }
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (parentCategoryId && parentCategoryId !== 'all') {
      query.parentCategoryId = parentCategoryId;
    }

    let subcategories;
    let total;
    let pagination = null;

    if (page) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 15;
      total = await Subcategory.countDocuments(query);
      subcategories = await Subcategory.find(query)
        .populate('parentCategoryId', 'name customId')
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
      subcategories = await Subcategory.find(query)
        .populate('parentCategoryId', 'name customId')
        .sort('name');
    }

    // Aggregate product counts
    const productCounts = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$subcategoryId', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    productCounts.forEach(pc => {
      if (pc._id) {
        countMap[pc._id.toString()] = pc.count;
      }
    });

    const data = subcategories.map(subcat => {
      const doc = subcat.toObject();
      doc.productCount = countMap[subcat._id.toString()] || 0;
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

export const createSubcategory = async (req, res, next) => {
  try {
    const count = await Subcategory.countDocuments();
    req.body.customId = `SUBCAT-${(count + 1).toString().padStart(3, '0')}`;
    
    const subcategory = await Subcategory.create(req.body);
    const populated = await subcategory.populate('parentCategoryId', 'name customId');
    
    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubcategory = async (req, res, next) => {
  try {
    const subcategory = await Subcategory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('parentCategoryId', 'name customId');

    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    res.status(200).json({
      success: true,
      data: subcategory,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubcategory = async (req, res, next) => {
  try {
    const subcategory = await Subcategory.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
