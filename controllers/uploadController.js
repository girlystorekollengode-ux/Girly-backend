import asyncHandler from 'express-async-handler';
import { cloudinary } from '../config/cloudinary.js';

// @desc    Upload multiple images to Cloudinary
// @route   POST /api/upload/image
// @access  Private/Admin
export const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error('Please upload at least one image file');
  }

  const images = req.files.map((file) => ({
    url: file.path,
    public_id: file.filename,
  }));

  res.json({
    success: true,
    images,
  });
});

// @desc    Delete an image from Cloudinary
// @route   DELETE /api/upload/image
// @access  Private/Admin
export const deleteImage = asyncHandler(async (req, res) => {
  const { public_id } = req.body;

  if (!public_id) {
    res.status(400);
    throw new Error('Please provide the public_id of the image to delete');
  }

  const result = await cloudinary.uploader.destroy(public_id);

  if (result.result === 'not found') {
    res.status(404);
    throw new Error('Image not found on Cloudinary');
  }

  res.json({
    success: true,
    message: 'Image deleted successfully',
    result,
  });
});
