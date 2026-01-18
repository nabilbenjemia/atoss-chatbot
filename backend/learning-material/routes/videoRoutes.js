const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

// Video routes
router.get('/', videoController.getAllVideos);
router.post('/', videoController.upload.single('video'), videoController.uploadVideo);

// Specific routes before /:id to avoid route conflicts
router.post('/:id/view', videoController.incrementViews);

// Single video CRUD - MUST be after more specific routes
router.get('/:id', videoController.getVideoById);
router.put('/:id', videoController.updateVideo);
router.delete('/:id', videoController.deleteVideo);

module.exports = router;