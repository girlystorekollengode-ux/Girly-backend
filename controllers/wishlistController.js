import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

// Helper function to return populated wishlist
const getPopulatedWishlist = async (userId) => {
  const user = await User.findById(userId).populate({
    path: 'wishlist',
    populate: {
      path: 'category',
      select: 'name slug',
    },
  });
  return user ? user.wishlist : [];
};

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getPopulatedWishlist(req.user._id);
  res.json({
    success: true,
    data: wishlist,
  });
});

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add/:productId
// @access  Private
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Avoid duplicates
  if (user.wishlist.includes(productId)) {
    const wishlist = await getPopulatedWishlist(req.user._id);
    return res.json({
      success: true,
      data: wishlist,
    });
  }

  user.wishlist.push(productId);
  await user.save();

  const wishlist = await getPopulatedWishlist(req.user._id);

  res.json({
    success: true,
    data: wishlist,
  });
});

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/remove/:productId
// @access  Private
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
  await user.save();

  const wishlist = await getPopulatedWishlist(req.user._id);

  res.json({
    success: true,
    data: wishlist,
  });
});
