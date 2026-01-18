// Video Service class
const Video = require('../models/Video');

const getAllVideos = async (filters = {}) => {
    const query = {};
    
    if (filters.category) {
        query.category = filters.category;
    }
    
    if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
    }
    
    if (filters.search) {
        query.$text = { $search: filters.search };
    }
    
    return await Video.find(query)
        .populate('uploadedBy', 'username email')
        .sort({ createdAt: -1 });
};

const getVideoById = async (videoId) => {
    return await Video.findById(videoId)
        .populate('uploadedBy', 'username email');
};

const uploadVideo = async (videoData) => {
    const video = await Video.create(videoData);
    return video;
};

const updateVideo = async (videoId, updateData) => {
    return await Video.findByIdAndUpdate(
        videoId,
        updateData,
        { new: true, runValidators: true }
    ).populate('uploadedBy', 'username email');
};

const deleteVideo = async (videoId) => {
    return await Video.findByIdAndDelete(videoId);
};

const incrementViews = async (videoId) => {
    const video = await Video.findById(videoId);
    if (video) {
        await video.incrementViews();
    }
    return video;
};

module.exports = {
    getAllVideos,
    getVideoById,
    uploadVideo,
    updateVideo,
    deleteVideo,
    incrementViews
};
