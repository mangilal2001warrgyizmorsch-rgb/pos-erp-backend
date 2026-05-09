import Subcategory from '../models/Subcategory.js';
import Category from '../models/Category.js';

export const getSubcategories = async (req, res, next) => {
  try {
    const { search, parentCategoryId } = req.query;
    const query = { isActive: true };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (parentCategoryId) {
      query.parentCategoryId = parentCategoryId;
    }
    
    const subcategories = await Subcategory.find(query)
      .populate('parentCategoryId', 'name customId')
      .sort('name');
      
    res.status(200).json({
      success: true,
      data: subcategories,
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
