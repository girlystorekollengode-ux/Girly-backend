import asyncHandler from 'express-async-handler';
import Review from '../models/Review.js';
import Product from '../models/Product.js';

// @desc    Get all reviews for a product
// @route   GET /api/reviews/:productId
// @access  Public
export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const reviews = await Review.find({ product: productId })
    .populate('user', 'name')
    .sort('-createdAt');

  res.json({
    success: true,
    data: reviews,
  });
});

// @desc    Create a new product review
// @route   POST /api/reviews/:productId
// @access  Private
export const addReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, comment, images } = req.body;

  if (!rating) {
    res.status(400);
    throw new Error('Please provide a rating value');
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Check if already reviewed
  const alreadyReviewed = await Review.findOne({
    user: req.user._id,
    product: productId,
  });

  if (alreadyReviewed) {
    res.status(400);
    throw new Error('You have already reviewed this product');
  }

  // Create review
  const review = await Review.create({
    user: req.user._id,
    product: productId,
    rating: Number(rating),
    comment: comment || '',
    images: images || [],
  });

  // Update product model: push rating to ratings array and increment numReviews
  product.ratings.push({
    user: req.user._id,
    value: Number(rating),
  });
  product.numReviews = product.ratings.length;
  await product.save();

  res.status(201).json({
    success: true,
    data: review,
  });
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);

  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  // Enforce delete authorization (owner or admin)
  if (
    review.user.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    res.status(403);
    throw new Error('Not authorized to delete this review');
  }

  // Find product and filter out rating
  const product = await Product.findById(review.product);
  if (product) {
    product.ratings = product.ratings.filter(
      (r) => r.user.toString() !== review.user.toString()
    );
    product.numReviews = product.ratings.length;
    await product.save();
  }

  await Review.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Review deleted successfully',
  });
});

// @desc    Get logged in user's reviews
// @route   GET /api/reviews/my/reviews
// @access  Private
export const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id })
    .populate('product', 'name images')
    .sort('-createdAt');

  res.json({
    success: true,
    data: reviews,
  });
});

