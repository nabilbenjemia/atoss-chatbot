// Video Service class
const Video = require('../models/Video');

const getAllVideos = async (filters = {}) => {
    try {
        console.log('videoService.getAllVideos called with filters:', filters);
        
        const query = {};
        if (filters.category) query.category = filters.category;
        if (filters.search) {
            query.$or = [
                { title: { $regex: filters.search, $options: 'i' } },
                { description: { $regex: filters.search, $options: 'i' } }
            ];
        }
        
        console.log('MongoDB query:', JSON.stringify(query));
        
        // Check collection
        const collectionName = Video.collection.name;
        console.log('Querying collection:', collectionName);
        
        // Count total documents
        const totalCount = await Video.countDocuments();
        console.log('Total documents in collection:', totalCount);
        
        const videos = await Video.find(query).sort({ createdAt: -1 });
        console.log('Videos found with filter:', videos.length);
        
        return videos;
    } catch (error) {
        console.error('Error in videoService.getAllVideos:', error);
        throw error;
    }
};

const getVideoById = async (videoId) => {
    return await Video.findById(videoId);
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
    );
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
