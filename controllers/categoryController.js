import asyncHandler from 'express-async-handler';
import slugify from 'slugify';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

// @desc    Get all active categories (nested structure)
// @route   GET /api/categories
// @access  Public
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .populate('parent')
    .sort('displayOrder');

  // Build a nested tree representation
  const parents = categories.filter((c) => !c.parent);
  const nested = parents.map((parent) => {
    const subcategories = categories.filter(
      (c) => c.parent && c.parent._id.toString() === parent._id.toString()
    );
    return {
      ...parent.toObject(),
      subcategories,
    };
  });

  res.json({
    success: true,
    data: nested,
  });
});

// @desc    Get category by slug
// @route   GET /api/categories/:slug
// @access  Public
export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const category = await Category.findOne({ slug, isActive: true }).populate('parent');

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  // Count products in this category
  const productsCount = await Product.countDocuments({ category: category._id });

  res.json({
    success: true,
    data: {
      category,
      productsCount,
    },
  });
});

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = asyncHandler(async (req, res) => {
  const { name, parent, priceRanges, displayOrder, image } = req.body;

  if (!name) {
    res.status(400);
    throw new Error('Category name is required');
  }

  const slug = slugify(name, { lower: true });

  const categoryExists = await Category.findOne({ slug });
  if (categoryExists) {
    res.status(400);
    throw new Error('A category with this name already exists');
  }

  const category = await Category.create({
    name,
    slug,
    parent: parent || null,
    priceRanges: priceRanges || [],
    displayOrder: displayOrder || 0,
    image: image || {},
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, parent, priceRanges, displayOrder, image, isActive } = req.body;

  const category = await Category.findById(id);

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  if (name) {
    category.name = name;
    category.slug = slugify(name, { lower: true });
  }

  if (parent !== undefined) {
    category.parent = parent || null;
  }

  if (priceRanges !== undefined) {
    category.priceRanges = priceRanges;
  }

  if (displayOrder !== undefined) {
    category.displayOrder = displayOrder;
  }

  if (image !== undefined) {
    category.image = image;
  }

  if (isActive !== undefined) {
    category.isActive = isActive;
  }

  const updatedCategory = await category.save();

  res.json({
    success: true,
    data: updatedCategory,
  });
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findById(id);

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  // Also check if there are subcategories depending on this category
  const subcategoriesExist = await Category.findOne({ parent: id });
  if (subcategoriesExist) {
    res.status(400);
    throw new Error('Cannot delete category: it has active subcategories');
  }

  // Check if there are products depending on this category
  const productsExist = await Product.findOne({ category: id });
  if (productsExist) {
    res.status(400);
    throw new Error('Cannot delete category: products are assigned to it');
  }

  await Category.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Category deleted successfully',
  });
});
