import asyncHandler from 'express-async-handler';
import Cart from '../models/Cart.js';

// Helper function to fetch populated cart
const getPopulatedCart = async (userId) => {
  return await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    select: 'name images discountPrice price stock sizes colors slug',
  });
};

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
export const getCart = asyncHandler(async (req, res) => {
  let cart = await getPopulatedCart(req.user._id);
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }
  res.json({
    success: true,
    data: cart,
  });
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
export const addToCart = asyncHandler(async (req, res) => {
  const { product, qty, size, color } = req.body;

  if (!product) {
    res.status(400);
    throw new Error('Product ID is required');
  }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  // Check if product with same size and color already exists in cart
  const existingItemIndex = cart.items.findIndex(
    (item) =>
      item.product.toString() === product &&
      item.size === size &&
      item.color === color
  );

  if (existingItemIndex > -1) {
    cart.items[existingItemIndex].qty += Number(qty) || 1;
  } else {
    cart.items.push({
      product,
      qty: Number(qty) || 1,
      size,
      color,
    });
  }

  await cart.save();
  const populatedCart = await getPopulatedCart(req.user._id);

  res.json({
    success: true,
    data: populatedCart,
  });
});

// @desc    Update item quantity in cart
// @route   PUT /api/cart/update
// @access  Private
export const updateCart = asyncHandler(async (req, res) => {
  const { itemId, qty } = req.body;

  if (!itemId || qty === undefined) {
    res.status(400);
    throw new Error('Item ID and quantity are required');
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error('Cart not found');
  }

  const item = cart.items.id(itemId);
  if (!item) {
    res.status(404);
    throw new Error('Item not found in cart');
  }

  item.qty = Number(qty);

  if (item.qty <= 0) {
    cart.items = cart.items.filter((i) => i._id.toString() !== itemId);
  }

  await cart.save();
  const populatedCart = await getPopulatedCart(req.user._id);

  res.json({
    success: true,
    data: populatedCart,
  });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:itemId
// @access  Private
export const removeFromCart = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error('Cart not found');
  }

  cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
  await cart.save();

  const populatedCart = await getPopulatedCart(req.user._id);

  res.json({
    success: true,
    data: populatedCart,
  });
});

// @desc    Clear user cart
// @route   DELETE /api/cart/clear
// @access  Private
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    cart.items = [];
    await cart.save();
  }

  res.json({
    success: true,
    message: 'Cart cleared successfully',
    data: { items: [] },
  });
});
