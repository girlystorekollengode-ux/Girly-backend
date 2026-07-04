import asyncHandler from 'express-async-handler';
import Coupon from '../models/Coupon.js';

// @desc    Validate a coupon code
// @route   POST /api/coupons/validate
// @access  Private
export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, orderAmount } = req.body;

  if (!code || orderAmount === undefined) {
    res.status(400);
    throw new Error('Please provide coupon code and orderAmount');
  }

  const coupon = await Coupon.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });

  if (!coupon) {
    res.status(404);
    throw new Error('Invalid or inactive coupon code');
  }

  // Check expiry
  if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
    res.status(400);
    throw new Error('Coupon has expired');
  }

  // Check usage limit
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    res.status(400);
    throw new Error('Coupon maximum usage limit has been reached');
  }

  // Check minimum order amount
  if (Number(orderAmount) < coupon.minOrderAmount) {
    res.status(400);
    throw new Error(
      `Minimum order amount to use this coupon is ₹${coupon.minOrderAmount}`
    );
  }

  // Calculate discount amount
  let discountAmount = 0;
  if (coupon.discountType === 'flat') {
    discountAmount = coupon.value;
  } else if (coupon.discountType === 'percent') {
    discountAmount = (coupon.value / 100) * Number(orderAmount);
  }

  // Ensure discount does not exceed the order amount
  if (discountAmount > Number(orderAmount)) {
    discountAmount = Number(orderAmount);
  }

  const finalAmount = Number(orderAmount) - discountAmount;

  res.json({
    success: true,
    valid: true,
    discountType: coupon.discountType,
    value: coupon.value,
    discountAmount,
    finalAmount,
  });
});

// @desc    Create a new coupon (Admin only)
// @route   POST /api/coupons
// @access  Private/Admin
export const createCoupon = asyncHandler(async (req, res) => {
  const { code, discountType, value, minOrderAmount, maxUses, expiryDate, isActive } =
    req.body;

  if (!code || !discountType || !value) {
    res.status(400);
    throw new Error('Please fill in all required coupon fields (code, type, value)');
  }

  const couponExists = await Coupon.findOne({ code: code.toUpperCase() });
  if (couponExists) {
    res.status(400);
    throw new Error('A coupon with this code already exists');
  }

  const coupon = await Coupon.create({
    code: code.toUpperCase(),
    discountType,
    value: Number(value),
    minOrderAmount: minOrderAmount !== undefined ? Number(minOrderAmount) : 0,
    maxUses: maxUses !== undefined && maxUses !== '' ? Number(maxUses) : null,
    expiryDate: expiryDate || null,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({
    success: true,
    data: coupon,
  });
});

// @desc    Get all coupons (Admin only)
// @route   GET /api/coupons
// @access  Private/Admin
export const getAllCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find({}).sort('-createdAt');
  res.json({
    success: true,
    data: coupons,
  });
});

// @desc    Update a coupon (Admin only)
// @route   PUT /api/coupons/:id
// @access  Private/Admin
export const updateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;

  const coupon = await Coupon.findById(id);

  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }

  if (code) {
    req.body.code = code.toUpperCase();
  }

  const updatedCoupon = await Coupon.findByIdAndUpdate(
    id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    data: updatedCoupon,
  });
});

// @desc    Delete a coupon (Admin only)
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
export const deleteCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const coupon = await Coupon.findById(id);

  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }

  await Coupon.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Coupon deleted successfully',
  });
});
