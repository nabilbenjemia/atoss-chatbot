// controllers/videoController.js
const videoService = require('../services/videoService');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', 'uploads', 'videos');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit (recommended for tutorials)
    fileFilter: (req, file, cb) => {
        const allowedExtensions = /mp4|avi|mov|wmv|flv|mkv/;
        const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
        
        // Allow common video MIME types
        const allowedMimeTypes = [
            'video/mp4',
            'video/avi',
            'video/x-msvideo',
            'video/quicktime',
            'video/x-ms-wmv',
            'video/x-flv',
            'video/x-matroska',  // MKV
            'video/mkv'           // Alternative MKV MIME type
        ];
        
        const mimetypeValid = allowedMimeTypes.includes(file.mimetype);
        
        if (mimetypeValid && extname) {
            return cb(null, true);
        }
        
        console.log('Rejected file:', {
            filename: file.originalname,
            mimetype: file.mimetype,
            extension: path.extname(file.originalname)
        });
        
        cb(new Error('Only video files are allowed (mp4, avi, mov, wmv, flv, mkv)'));
    }
});

// Helper function to get video duration
const getVideoDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                const duration = metadata.format.duration;
                resolve(Math.round(duration)); // Duration in seconds
            }
        });
    });
};

// Helper function to generate thumbnail
const generateThumbnail = (videoPath, thumbnailPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: ['00:00:02'], // Take screenshot at 2 seconds
                filename: path.basename(thumbnailPath),
                folder: path.dirname(thumbnailPath),
                size: '320x240'
            })
            .on('end', () => resolve(thumbnailPath))
            .on('error', (err) => reject(err));
    });
};

// GET /api/videos
const getAllVideos = async (req, res) => {
    try {
        console.log('getAllVideos called with query:', req.query);
        const videos = await videoService.getAllVideos(req.query);
        console.log('Videos found:', videos.length);
        console.log('Video IDs:', videos.map(v => v._id));
        res.json(videos);
    } catch (error) {
        console.error('Error in getAllVideos:', error);
        res.status(500).json({ error: error.message });
    }
};

// GET /api/videos/:id
const getVideoById = async (req, res) => {
    try {
        const { id } = req.params;
        const video = await videoService.getVideoById(id);
        
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }
        
        res.status(200).json(video);
    } catch (error) {
        console.error('Error retrieving video:', error);
        res.status(500).json({ error: "Failed to retrieve video", details: error.message });
    }
};

// POST /api/videos - with file upload
const uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Video file is required" });
        }
        
        const filePath = path.join(__dirname, '..', 'uploads', 'videos', req.file.filename);
        
        // Get video duration
        const duration = await getVideoDuration(filePath);
        
        // Generate thumbnail
        const thumbnailsDir = path.join(__dirname, '..', 'uploads', 'thumbnails');
        if (!fs.existsSync(thumbnailsDir)) {
            fs.mkdirSync(thumbnailsDir, { recursive: true });
        }
        
        const thumbnailFilename = `${path.parse(req.file.filename).name}.jpg`;
        const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
        
        await generateThumbnail(filePath, thumbnailPath);
        
        const videoData = {
            title: req.body.title,
            description: req.body.description || '',
            url: `/uploads/videos/${req.file.filename}`,
            duration: duration,
            thumbnail: `/uploads/thumbnails/${thumbnailFilename}`,
            category: req.body.category || 'other',
            tags: req.body.tags ? req.body.tags.split(',') : [],
            uploadedBy: req.body.uploadedBy
        };
        
        if (!videoData.title) {
            return res.status(400).json({ error: "Title is required" });
        }
        
        const video = await videoService.uploadVideo(videoData);
        res.status(201).json(video);
    } catch (error) {
        console.error('Error creating video:', error);
        res.status(500).json({ error: "Failed to create video", details: error.message });
    }
};

// PUT /api/videos/:id
const updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const updatedVideo = await videoService.updateVideo(id, updateData);
        
        if (!updatedVideo) {
            return res.status(404).json({ error: "Video not found" });
        }
        
        res.status(200).json(updatedVideo);
    } catch (error) {
        console.error('Error updating video:', error);
        res.status(500).json({ error: "Failed to update video", details: error.message });
    }
};

// DELETE /api/videos/:id
const deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const video = await videoService.getVideoById(id);
        
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }
        
        // Delete video file
        const videoPath = path.join(__dirname, '..', video.url);
        if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
        }
        
        // Delete thumbnail
        if (video.thumbnail) {
            const thumbnailPath = path.join(__dirname, '..', video.thumbnail);
            if (fs.existsSync(thumbnailPath)) {
                fs.unlinkSync(thumbnailPath);
            }
        }
        
        // Delete from database
        const deletedVideo = await videoService.deleteVideo(id);
        
        if (!deletedVideo) {
            return res.status(404).json({ error: "Failed to delete video from database" });
        }
        
        res.status(200).json({ message: "Video deleted successfully" });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ error: "Failed to delete video", details: error.message });
    }
};

// POST /api/videos/:id/view
const incrementViews = async (req, res) => {
    try {
        const { id } = req.params;
        const video = await videoService.incrementViews(id);
        
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }
        
        res.status(200).json({ views: video.views });
    } catch (error) {
        console.error('Error incrementing views:', error);
        res.status(500).json({ error: "Failed to increment views", details: error.message });
    }
};

module.exports = {
    getAllVideos,
    getVideoById,
    uploadVideo,
    updateVideo,
    deleteVideo,
    incrementViews,
    upload
};
