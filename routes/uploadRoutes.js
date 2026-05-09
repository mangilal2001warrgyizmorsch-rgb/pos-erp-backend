import express from 'express';
const router = express.Router();
import upload from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/auth.js';

// @desc    Upload single image
// @route   POST /api/upload/single/:folder
router.post('/single/:folder', protect, (req, res, next) => {
  const uploadSingle = upload.single('image');
  
  uploadSingle(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const folder = req.params.folder;
    res.status(200).json({
      success: true,
      data: {
        imageUrl: `/uploads/${folder}/${req.file.filename}`,
        fileName: req.file.filename
      }
    });
  });
});

// @desc    Upload multiple images
// @route   POST /api/upload/multiple/:folder
router.post('/multiple/:folder', protect, (req, res, next) => {
  const uploadMultiple = upload.array('images', 10); // Max 10 images
  
  uploadMultiple(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload at least one file' });
    }

    const folder = req.params.folder;
    const images = req.files.map(file => ({
      imageUrl: `/uploads/${folder}/${file.filename}`,
      fileName: file.filename
    }));

    res.status(200).json({
      success: true,
      data: images
    });
  });
});

export default router;
