import React, { useState, useEffect } from 'react';
import axios from 'axios';

const VideoUploadModal = ({ isOpen, onClose, onSuccess, editVideo = null }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'tutorial',
        tags: ''
    });
    const [videoFile, setVideoFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);

    const API_BASE_URL = import.meta.env.VITE_LEARNING_API_URL || 'http://localhost:4005';

    useEffect(() => {
        if (editVideo) {
            setFormData({
                title: editVideo.title || '',
                description: editVideo.description || '',
                category: editVideo.category || 'tutorial',
                tags: editVideo.tags?.join(', ') || ''
            });
        } else {
            setFormData({
                title: '',
                description: '',
                category: 'tutorial',
                tags: ''
            });
        }
        setVideoFile(null);
        setThumbnailFile(null);
        setError(null);
    }, [editVideo, isOpen]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleFileChange = (e) => {
        setVideoFile(e.target.files[0]);
    };

    const handleThumbnailChange = (e) => {
        setThumbnailFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setUploading(true);
        setUploadProgress(0);

        try {
            const token = localStorage.getItem('auth_token');
            
            if (editVideo) {
                const updateData = new FormData();
                updateData.append('title', formData.title);
                updateData.append('description', formData.description);
                updateData.append('category', formData.category);
                updateData.append('tags', formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag));
                if (thumbnailFile) {
                    updateData.append('thumbnail', thumbnailFile);
                }

                const response = await axios.put(
                    `${API_BASE_URL}/api/videos/${editVideo._id}`,
                    updateData,
                    {
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );
                onSuccess(response.data);
            } else {
                // Upload new video
                if (!videoFile) {
                    setError('Please select a video file');
                    setUploading(false);
                    return;
                }

                const uploadData = new FormData();
                uploadData.append('video', videoFile);
                uploadData.append('title', formData.title);
                uploadData.append('description', formData.description || '');
                uploadData.append('category', formData.category);
                
                // Handle tags properly - send as comma-separated string
                const tagsString = formData.tags
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag)
                    .join(',');
                uploadData.append('tags', tagsString);

                console.log('Uploading video with data:', {
                    title: formData.title,
                    description: formData.description,
                    category: formData.category,
                    tags: tagsString,
                    fileSize: videoFile.size,
                    fileName: videoFile.name
                });

                const response = await axios.post(
                    `${API_BASE_URL}/api/videos`,
                    uploadData,
                    {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            Authorization: `Bearer ${token}`
                        },
                        onUploadProgress: (progressEvent) => {
                            const percentCompleted = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            setUploadProgress(percentCompleted);
                        }
                    }
                );
                
                console.log('Upload successful:', response.data);
                onSuccess(response.data);
            }

            onClose();
        } catch (err) {
            console.error('Upload error:', err);
            console.error('Error response:', err.response?.data);
            setError(err.response?.data?.error || err.response?.data?.details || 'Failed to upload video');
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-[600px] h-[85vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                    <h2 className="text-xl font-bold">
                        {editVideo ? 'Edit Video' : 'Upload New Video'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-200 text-xl h-8 w-8 bg-tum-blue flex items-center justify-center hover:bg-tum-blue-dark"
                        disabled={uploading}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                        {!editVideo && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Video File *</label>
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={uploading}
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-2">Title *</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-tum-blue"
                                disabled={uploading}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-tum-blue"
                                disabled={uploading}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Category *</label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-tum-blue"
                                    disabled={uploading}
                                    required
                                >
                                    <option value="tutorial">Tutorial</option>
                                    <option value="demo">Demo</option>
                                    <option value="guide">Guide</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Tags</label>
                                <input
                                    type="text"
                                    name="tags"
                                    value={formData.tags}
                                    onChange={handleChange}
                                    placeholder="e.g., beginner, advanced"
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-tum-blue"
                                    disabled={uploading}
                                />
                            </div>
                        </div>

                        {editVideo && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Thumbnail</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e => setThumbnailFile(e.target.files[0])}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    disabled={uploading}
                                />
                            </div>
                        )}

                        {uploading && (
                            <div className="pt-4">
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div 
                                        className="bg-tum-blue h-3 rounded-full transition-all duration-300" 
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                <p className="text-sm text-gray-600 mt-2 text-center">
                                    {uploadProgress}% uploaded...
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 p-4 border-t flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border bg-white rounded-lg border-tum-blue hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={uploading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-tum-blue text-white rounded-lg hover:bg-tum-blue-dark disabled:bg-gray-400"
                            disabled={uploading}
                        >
                            {uploading ? 'Uploading...' : editVideo ? 'Update' : 'Upload'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VideoUploadModal;
