const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

/**
 * Video Routes - endpoints for video management and file operations
 */

// GET /api/videos
router.get('/', videoController.getAllVideos);

// POST /api/videos
router.post('/', videoController.upload.single('video'), videoController.uploadVideo);

// POST /api/videos/:id/view
router.post('/:id/view', videoController.incrementViews);

// GET /api/videos/:id
router.get('/:id', videoController.getVideoById);

// PUT /api/videos/:id
router.put('/:id', videoController.uploadThumbnail.single('thumbnail'), videoController.updateVideo);

// DELETE /api/videos/:id
router.delete('/:id', videoController.deleteVideo);

module.exports = router;