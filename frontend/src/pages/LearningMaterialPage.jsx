import React, { useState, useEffect } from 'react';
import learningApi from '../services/learningApi';
import VideoCard from '../components/VideoCard';
import AdminVideoCard from '../components/AdminVideoCard';
import UploadVideoCard from '../components/UploadVideoCard';
import VideoPlayerModal from '../components/VideoPlayerModal';
import VideoUploadModal from '../components/VideoUploadModal';
import { getCurrentUser } from '../services/api';

const LearningMaterialPage = () => {
    const [videos, setVideos] = useState([]);
    const [allVideos, setAllVideos] = useState([]); // Store all videos for client-side filtering
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    const [deletingVideo, setDeletingVideo] = useState(null);

    const API_BASE_URL = import.meta.env.VITE_LEARNING_API_URL || 'http://localhost:4005';
    const currentUser = getCurrentUser();
    //const isAdmin = currentUser?.role === 'admin';
    const isAdmin = 'admin'; //TODO remove

    // Initial fetch - get all videos once
    useEffect(() => {
        fetchAllVideos();
    }, []);

    // Filter videos on client side when search or category changes
    useEffect(() => {
        filterVideos();
    }, [searchTerm, selectedCategory, allVideos]);

    const fetchAllVideos = async () => {
        try {
            setLoading(true);
            const response = await learningApi.get('/api/videos');
            setAllVideos(response.data);
            setVideos(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching videos:', err);
            setError('Failed to load videos. Please ensure the learning service is running.');
            setVideos([]);
        } finally {
            setLoading(false);
        }
    };

    const filterVideos = () => {
        setSearching(true);
        
        let filtered = [...allVideos];

        // Filter by category
        if (selectedCategory) {
            filtered = filtered.filter(v => v.category === selectedCategory);
        }

        // Filter by search term (title or description)
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(v => 
                v.title.toLowerCase().includes(search) || 
                v.description.toLowerCase().includes(search)
            );
        }

        setVideos(filtered);
        setSearching(false);
    };

    const handleViewVideo = async (video) => {
        setSelectedVideo(video);
        
        try {
            await learningApi.post(`/api/videos/${video._id}/view`);
            // Update view count in both arrays
            const updateViews = (videoList) => 
                videoList.map(v => v._id === video._id ? { ...v, views: v.views + 1 } : v);
            
            setVideos(updateViews);
            setAllVideos(updateViews);
        } catch (err) {
            console.log('Could not increment view count:', err.message);
        }
    };

    const closeVideoPlayer = () => {
        setSelectedVideo(null);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEdit = (video) => {
        setEditingVideo(video);
        setShowUploadModal(true);
    };

    const handleDelete = (video) => {
        setDeletingVideo(video);
    };

    const confirmDelete = async () => {
        try {
            await learningApi.delete(`/api/videos/${deletingVideo._id}`);
            setAllVideos(allVideos.filter(v => v._id !== deletingVideo._id));
            setDeletingVideo(null);
        } catch (err) {
            console.error('Error deleting video:', err);
            alert('Failed to delete video');
        }
    };

    const handleUploadSuccess = (newVideo) => {
        if (editingVideo) {
            const updateVideo = (videoList) => 
                videoList.map(v => v._id === newVideo._id ? newVideo : v);
            setAllVideos(updateVideo);
        } else {
            setAllVideos([newVideo, ...allVideos]);
        }
        setShowUploadModal(false);
        setEditingVideo(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-tum-blue border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-xl text-gray-600">Loading videos...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Learning Materials</h1>

            {/* Filters */}
            <div className="mb-6 flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="Search videos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-tum-blue"
                    />
                    {searching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-tum-blue border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                >
                    <option value="">All Categories</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="demo">Demo</option>
                    <option value="guide">Guide</option>
                    <option value="other">Other</option>
                </select>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {/* Video Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {isAdmin && (
                    <UploadVideoCard onUploadClick={() => setShowUploadModal(true)} />
                )}
                
                {videos.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-500">
                        {searchTerm || selectedCategory ? 'No videos match your search' : 'No videos found'}
                    </div>
                ) : (
                    videos.map((video) => (
                        isAdmin ? (
                            <AdminVideoCard
                                key={video._id}
                                video={video}
                                onVideoClick={handleViewVideo}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                apiBaseUrl={API_BASE_URL}
                            />
                        ) : (
                            <VideoCard
                                key={video._id}
                                video={video}
                                onVideoClick={handleViewVideo}
                                apiBaseUrl={API_BASE_URL}
                            />
                        )
                    ))
                )}
            </div>

            {/* Video Player Modal */}
            <VideoPlayerModal
                video={selectedVideo}
                onClose={closeVideoPlayer}
                apiBaseUrl={API_BASE_URL}
            />

            {/* Upload/Edit Modal */}
            <VideoUploadModal
                isOpen={showUploadModal}
                onClose={() => {
                    setShowUploadModal(false);
                    setEditingVideo(null);
                }}
                onSuccess={handleUploadSuccess}
                editVideo={editingVideo}
            />

            {/* Delete Confirmation Modal */}
            {deletingVideo && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">Delete Video?</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete "{deletingVideo.title}"? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingVideo(null)}
                                className="flex-1 px-4 py-2 border bg-white rounded-lg border-tum-blue hover:bg-gray-100 disabled:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LearningMaterialPage;