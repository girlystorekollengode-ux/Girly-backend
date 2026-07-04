import express from 'express';
import {
  getAllUsers,
  getUserById,
  banUser,
  updateProfile,
  changePassword,
  addAddress,
  deleteAddress,
} from '../controllers/userController.js';
import { getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

// User specific profile routes (all protected)
router.get('/profile', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/address', protect, addAddress);
router.delete('/address/:addressId', protect, deleteAddress);

// Admin-specific user routes (protected + adminOnly)
router.get('/', protect, adminOnly, getAllUsers);
router.get('/:id', protect, adminOnly, getUserById);
router.put('/:id/ban', protect, adminOnly, banUser);

export default router;
