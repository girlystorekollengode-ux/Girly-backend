import asyncHandler from 'express-async-handler';
import slugify from 'slugify';
import Product from '../models/Product.js';
import User from '../models/User.js';
import APIFeatures from '../utils/apiFeatures.js';

// @desc    Get all active products with filters, sorting, pagination
// @route   GET /api/products
// @access  Public
export const getProducts = asyncHandler(async (req, res) => {
  // Fetch total count before pagination limits are applied
  const countFeatures = new APIFeatures(Product.find({ isActive: true }), req.query)
    .search()
    .filter();
  const total = await countFeatures.query.countDocuments();

  const apiFeatures = new APIFeatures(
    Product.find({ isActive: true }).populate('category', 'name slug'),
    req.query
  )
    .search()
    .filter()
    .sort()
    .paginate();

  const products = await apiFeatures.query;

  const limit = Number(req.query.limit) || 12;
  const page = Number(req.query.page) || 1;
  const pages = Math.ceil(total / limit) || 1;

  res.json({
    success: true,
    total,
    page,
    pages,
    products,
    data: products,
    pagination: {
      page,
      limit,
      totalPages: pages,
      totalProducts: total,
    },
  });
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id).populate('category', 'name slug');

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json({
    success: true,
    data: product,
  });
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ isFeatured: true, isActive: true })
    .populate('category', 'name slug')
    .limit(8);

  res.json({
    success: true,
    products,
  });
});

// @desc    Search products by search term q
// @route   GET /api/products/search
// @access  Public
export const searchProducts = asyncHandler(async (req, res) => {
  const searchTerm = req.query.q;

  const keyword = searchTerm
    ? {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { tags: { $regex: searchTerm, $options: 'i' } },
        ],
      }
    : {};

  const products = await Product.find({ ...keyword, isActive: true }).populate(
    'category',
    'name slug'
  );

  res.json({
    success: true,
    products,
  });
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    images,
    price,
    discountPrice,
    category,
    subcategory,
    stock,
    sizes,
    colors,
    tags,
    isFeatured,
    isActive,
  } = req.body;

  if (!name || !description || !price || !discountPrice || !category) {
    res.status(400);
    throw new Error('Please fill in all required product fields');
  }

  const slug = `${slugify(name, { lower: true })}-${Date.now()}`;

  const product = await Product.create({
    name,
    slug,
    description,
    images: images || [],
    price,
    discountPrice,
    category,
    subcategory,
    stock: stock || 0,
    sizes: sizes || [],
    colors: colors || [],
    tags: tags || [],
    isFeatured: isFeatured || false,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({
    success: true,
    data: product,
  });
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const product = await Product.findById(id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (name) {
    req.body.slug = `${slugify(name, { lower: true })}-${Date.now()}`;
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).populate('category', 'name slug');

  res.json({
    success: true,
    data: updatedProduct,
  });
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  await Product.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Product deleted successfully',
  });
});

// @desc    Toggle product isFeatured state
// @route   PATCH /api/products/:id/featured
// @access  Private/Admin
export const toggleFeatured = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  product.isFeatured = !product.isFeatured;
  await product.save();

  res.json({
    success: true,
    data: product,
  });
});

// @desc    Toggle product isActive state
// @route   PATCH /api/products/:id/active
// @access  Private/Admin
export const toggleActive = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  product.isActive = !product.isActive;
  await product.save();

  res.json({
    success: true,
    data: product,
  });
});

// @desc    Get top most wishlisted products
// @route   GET /api/products/wishlist-stats
// @access  Private/Admin
export const getWishlistStats = asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    { $unwind: '$wishlist' },
    { $group: { _id: '$wishlist', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const populatedStats = await Promise.all(
    stats.map(async (item) => {
      const product = await Product.findById(item._id)
        .select('name price discountPrice images')
        .populate('category', 'name slug');
      return {
        product,
        count: item.count,
      };
    })
  );

  res.json({
    success: true,
    data: populatedStats.filter((item) => item.product !== null),
  });
});
