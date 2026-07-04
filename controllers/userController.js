import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

// @desc    Get all users list (Admin only)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort('-createdAt');
  const count = await User.countDocuments();

  res.json({
    success: true,
    count,
    data: users,
  });
});

// @desc    Get user by ID & their order history (Admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .select('-password')
    .populate({
      path: 'wishlist',
      select: 'name price discountPrice images category',
      populate: {
        path: 'category',
        select: 'name slug',
      },
    });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const orders = await Order.find({ user: id }).sort('-createdAt');
  const cart = await Cart.findOne({ user: id }).populate({
    path: 'items.product',
    select: 'name price discountPrice images',
  });

  res.json({
    success: true,
    data: {
      user,
      orders,
      cart: cart ? cart.items : [],
    },
  });
});

// @desc    Ban or unban a user (Admin only)
// @route   PUT /api/users/:id/ban
// @access  Private/Admin
export const banUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Prevent admin from self-banning
  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot ban yourself');
  }

  user.isBanned = !user.isBanned;

  // Clear refresh token if banning user
  if (user.isBanned) {
    user.refreshToken = undefined;
  }

  await user.save();

  res.json({
    success: true,
    message: user.isBanned ? 'User banned successfully' : 'User unbanned successfully',
    data: user,
  });
});

// @desc    Update user profile details
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.name = req.body.name || user.name;
  user.phone = req.body.phone || user.phone;

  if (req.body.addresses !== undefined) {
    user.addresses = req.body.addresses;
  }

  const updatedUser = await user.save();

  res.json({
    success: true,
    data: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      addresses: updatedUser.addresses,
    },
  });
});

// @desc    Change user account password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Please provide currentPassword and newPassword');
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    res.status(400);
    throw new Error('Incorrect current password');
  }

  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
});

// @desc    Add a saved shipping address
// @route   POST /api/users/address
// @access  Private
export const addAddress = asyncHandler(async (req, res) => {
  const { label, street, city, state, pincode, isDefault } = req.body;

  if (!label || !street || !city || !state || !pincode) {
    res.status(400);
    throw new Error('Please fill in all address fields');
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // If new address is default, clear current defaults
  const flagDefault = isDefault === true || isDefault === 'true';
  if (flagDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  // If it is the first address, make it default automatically
  const shouldBeDefault = user.addresses.length === 0 ? true : flagDefault;

  user.addresses.push({
    label,
    street,
    city,
    state,
    pincode,
    isDefault: shouldBeDefault,
  });

  await user.save();

  res.status(201).json({
    success: true,
    data: user.addresses,
  });
});

// @desc    Delete a saved shipping address
// @route   DELETE /api/users/address/:addressId
// @access  Private
export const deleteAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if target exists
  const targetAddress = user.addresses.id(addressId);
  if (!targetAddress) {
    res.status(404);
    throw new Error('Address not found');
  }

  const wasDefault = targetAddress.isDefault;

  // Filter out address
  user.addresses = user.addresses.filter(
    (addr) => addr._id.toString() !== addressId
  );

  // If deleted address was the default, make the first remaining address the default
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  res.json({
    success: true,
    data: user.addresses,
  });
});
