import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import Coupon from '../models/Coupon.js';

// Initialize Razorpay (Dummy fallback keys if env not defined to prevent server startup crash)
const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
  });
};

// Helper to calculate order pricing securely from the database
export const calculateOrderAmount = async (items, couponCode) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Please select at least one item');
  }

  let subtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const dbProduct = await Product.findById(item.product);
    if (!dbProduct) {
      throw new Error(`Product not found in database: ${item.name || item.product}`);
    }

    const price = dbProduct.discountPrice !== undefined && dbProduct.discountPrice !== null && dbProduct.discountPrice > 0
      ? dbProduct.discountPrice
      : dbProduct.price;

    subtotal += price * item.qty;

    verifiedItems.push({
      product: dbProduct._id,
      name: dbProduct.name,
      image: dbProduct.images?.[0]?.url || '',
      price: price,
      qty: item.qty,
      size: item.size,
      color: item.color,
    });
  }

  // Shipping delivery charges: free above 999, else 50
  const shippingFee = subtotal > 999 || subtotal === 0 ? 0 : 50;

  // Coupon discount calculation
  let couponDiscount = 0;
  if (couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase().trim(),
      isActive: true,
    });
    if (coupon) {
      const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < new Date();
      const usageLimitReached = coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;
      const minAmountMet = subtotal >= coupon.minOrderAmount;

      if (!isExpired && !usageLimitReached && minAmountMet) {
        if (coupon.discountType === 'flat') {
          couponDiscount = coupon.value;
        } else if (coupon.discountType === 'percent') {
          couponDiscount = (coupon.value / 100) * subtotal;
        }
      }
    }
  }

  const finalAmount = Math.max(0, subtotal + shippingFee - couponDiscount);

  return {
    subtotal,
    shippingFee,
    couponDiscount,
    finalAmount,
    verifiedItems,
  };
};

// @desc    Create Razorpay Order
// @route   POST /api/orders/create-razorpay-order
// @access  Private
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { items, couponCode } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Please select at least one item to checkout');
  }

  // Compute finalAmount securely on the backend
  const { finalAmount } = await calculateOrderAmount(items, couponCode);

  if (finalAmount <= 0) {
    res.status(400);
    throw new Error('Order amount must be greater than 0 for Razorpay checkout');
  }

  const razorpay = getRazorpayInstance();

  const options = {
    amount: Math.round(finalAmount * 100), // amount in paise
    currency: 'INR',
    receipt: `receipt_order_${Date.now()}`,
  };

  try {
    const razorpayOrder = await razorpay.orders.create(options);
    res.status(201).json({
      success: true,
      order: razorpayOrder,
    });
  } catch (error) {
    res.status(500);
    throw new Error(`Razorpay Order creation failed: ${error.message}`);
  }
});

// @desc    Verify Razorpay Payment Signature and create Order
// @route   POST /api/orders/verify-payment
// @access  Private
export const verifyPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    orderData,
  } = req.body;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !orderData
  ) {
    res.status(400);
    throw new Error('Missing payment details or order information');
  }

  // 1. Signature Verification
  const shasum = crypto.createHmac(
    'sha256',
    process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
  );
  shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const digest = shasum.digest('hex');

  if (digest !== razorpay_signature) {
    res.status(400);
    throw new Error('Payment verification failed. Invalid signature.');
  }

  // Calculate pricing securely from database
  const { subtotal, shippingFee, couponDiscount, finalAmount, verifiedItems } =
    await calculateOrderAmount(orderData.items, orderData.couponCode);

  // 2. Validate inventory stock before saving order
  for (const item of verifiedItems) {
    const dbProduct = await Product.findById(item.product);
    if (!dbProduct) {
      res.status(404);
      throw new Error(`Product not found: ${item.name}`);
    }
    if (dbProduct.stock < item.qty) {
      res.status(400);
      throw new Error(
        `Insufficient stock for product ${item.name}. Available: ${dbProduct.stock}`
      );
    }
  }

  // 3. Fetch Razorpay Order and verify that the payment matches the database prices
  const razorpay = getRazorpayInstance();
  try {
    const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
    if (rzpOrder.amount !== Math.round(finalAmount * 100)) {
      res.status(400);
      throw new Error('Payment verification failed. Amount paid does not match database record.');
    }
  } catch (err) {
    res.status(400);
    throw new Error(`Razorpay Order verification failed: ${err.message}`);
  }

  // 4. Create the Order document using validated backend information
  const order = await Order.create({
    user: req.user._id,
    items: verifiedItems,
    shippingAddress: orderData.shippingAddress,
    paymentMethod: 'razorpay',
    paymentStatus: 'paid',
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    orderStatus: 'confirmed',
    totalMRP: subtotal,
    totalDiscount: 0,
    deliveryCharge: shippingFee,
    finalAmount: finalAmount,
    couponCode: orderData.couponCode,
    couponDiscount: couponDiscount,
  });

  // 5. Decrement product stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.qty },
    });
  }

  // 6. Increment coupon usage
  if (order.couponCode) {
    await Coupon.findOneAndUpdate(
      { code: order.couponCode.toUpperCase() },
      { $inc: { usedCount: 1 } }
    );
  }

  // 7. Clear user cart
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

  res.status(201).json({
    success: true,
    data: order,
  });
});

// @desc    Get logged in user orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt');
  res.json({
    success: true,
    data: orders,
  });
});

// @desc    Get order details by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id).populate('user', 'name email');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Allow access only if it is the order owner or an admin
  if (
    order.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    res.status(403);
    throw new Error('Not authorized to view this order');
  }

  res.json({
    success: true,
    data: order,
  });
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Allow cancellation only if user matches
  if (
    order.user.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    res.status(403);
    throw new Error('Not authorized to cancel this order');
  }

  if (order.orderStatus !== 'pending' && order.orderStatus !== 'confirmed') {
    res.status(400);
    throw new Error(
      `Cannot cancel order once it is in ${order.orderStatus} status`
    );
  }

  order.orderStatus = 'cancelled';
  order.paymentStatus = 'refunded'; // Mark refund status if cancelled after pay
  await order.save();

  // Restore inventory stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: item.qty },
    });
  }

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    data: order,
  });
});

// @desc    Get all orders (Admin only)
// @route   GET /api/orders
// @access  Private/Admin
export const getAllOrders = asyncHandler(async (req, res) => {
  const { orderStatus } = req.query;

  const filter = {};
  if (orderStatus) {
    filter.orderStatus = orderStatus;
  }

  const orders = await Order.find(filter)
    .populate('user', 'name email')
    .sort('-createdAt');

  res.json({
    success: true,
    data: orders,
  });
});

// @desc    Update order status (Admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { orderStatus } = req.body;

  if (!orderStatus) {
    res.status(400);
    throw new Error('Please provide an orderStatus');
  }

  const order = await Order.findById(id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  order.orderStatus = orderStatus;
  await order.save();

  res.json({
    success: true,
    message: 'Order status updated successfully',
    data: order,
  });
});

// @desc    Get admin order & revenue metrics
// @route   GET /api/orders/stats
// @access  Private/Admin
export const getOrderStats = asyncHandler(async (req, res) => {
  // 1. Total revenue (sum of finalAmount for paid orders)
  const revenueResult = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $group: { _id: null, total: { $sum: '$finalAmount' } } },
  ]);
  const totalRevenue = revenueResult[0] ? revenueResult[0].total : 0;

  // 2. Count by each orderStatus
  const statusCountsResult = await Order.aggregate([
    { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
  ]);
  const statusCounts = {};
  statusCountsResult.forEach((item) => {
    statusCounts[item._id] = item.count;
  });

  // 3. Today's revenue and orders
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayRevenueResult = await Order.aggregate([
    {
      $match: {
        paymentStatus: 'paid',
        createdAt: { $gte: startOfToday },
      },
    },
    { $group: { _id: null, total: { $sum: '$finalAmount' } } },
  ]);
  const todayRevenue = todayRevenueResult[0] ? todayRevenueResult[0].total : 0;

  const todayOrders = await Order.countDocuments({
    createdAt: { $gte: startOfToday },
  });

  res.json({
    success: true,
    data: {
      totalRevenue,
      statusCounts,
      todayRevenue,
      todayOrders,
    },
  });
});

// @desc    Create Free Order (0-Amount Checkout)
// @route   POST /api/orders/create-free-order
// @access  Private
export const createFreeOrder = asyncHandler(async (req, res) => {
  const { orderData } = req.body;

  if (!orderData || !orderData.items) {
    res.status(400);
    throw new Error('Please provide order information');
  }

  // Calculate pricing securely from database
  const { subtotal, shippingFee, couponDiscount, finalAmount, verifiedItems } =
    await calculateOrderAmount(orderData.items, orderData.couponCode);

  // Final amount verification (must be <= 0)
  if (finalAmount > 0) {
    res.status(400);
    throw new Error('Final amount is greater than 0. Payment is required.');
  }

  // 1. Validate inventory stock before saving order
  for (const item of verifiedItems) {
    const dbProduct = await Product.findById(item.product);
    if (!dbProduct) {
      res.status(404);
      throw new Error(`Product not found: ${item.name}`);
    }
    if (dbProduct.stock < item.qty) {
      res.status(400);
      throw new Error(
        `Insufficient stock for product ${item.name}. Available: ${dbProduct.stock}`
      );
    }
  }

  // 2. Create the Order document
  const order = await Order.create({
    user: req.user._id,
    items: verifiedItems,
    shippingAddress: orderData.shippingAddress,
    paymentMethod: 'coupon',
    paymentStatus: 'paid',
    orderStatus: 'confirmed',
    totalMRP: subtotal,
    totalDiscount: 0,
    deliveryCharge: shippingFee,
    finalAmount: 0,
    couponCode: orderData.couponCode,
    couponDiscount: couponDiscount,
  });

  // 3. Decrement product stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.qty },
    });
  }

  // 4. Increment coupon usage
  if (order.couponCode) {
    await Coupon.findOneAndUpdate(
      { code: order.couponCode.toUpperCase() },
      { $inc: { usedCount: 1 } }
    );
  }

  // 5. Clear user cart
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

  res.status(201).json({
    success: true,
    data: order,
  });
});

