import express from 'express';
import {
  createRazorpayOrder,
  verifyPayment,
  createFreeOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getOrderStats,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.post('/create-razorpay-order', protect, createRazorpayOrder);
router.post('/verify-payment', protect, verifyPayment);
router.post('/create-free-order', protect, createFreeOrder);
router.get('/my-orders', protect, getMyOrders);

// Admin-specific analytics endpoints (place static path /stats before parameter path /:id)
router.get('/stats', protect, adminOnly, getOrderStats);
router.get('/', protect, adminOnly, getAllOrders);

router.get('/:id', protect, getOrderById);
router.put('/:id/cancel', protect, cancelOrder);
router.put('/:id/status', protect, adminOnly, updateOrderStatus);

export default router;
