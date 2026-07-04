import express from 'express';
import { uploadImages, deleteImage } from '../controllers/uploadController.js';
import { upload } from '../config/cloudinary.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Apply auth protection and admin check to all upload endpoints
router.use(protect);
router.use(adminOnly);

// POST /image - uploads up to 5 images using multer storage configured for Cloudinary
router.post('/image', upload.array('images', 5), uploadImages);

// DELETE /image - removes an uploaded image by its public_id
router.delete('/image', deleteImage);

export default router;
