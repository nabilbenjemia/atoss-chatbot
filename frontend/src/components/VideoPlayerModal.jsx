import React from 'react';

const VideoPlayerModal = ({ video, onClose, apiBaseUrl, isDarkMode }) => {
    if (!video) return null;

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className={`${isDarkMode ? 'bg-[#2f2f2f]' : 'bg-white'} rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
                {/* Close Button */}
                <div className={`flex justify-between items-center p-4 border-b ${isDarkMode ? 'border-[#404040]' : 'border-gray-200'}`}>
                    <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{video.title}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-200 text-xl h-8 w-8 bg-tum-blue flex items-center justify-center hover:bg-tum-blue-dark rounded"
                    >
                        &times;
                    </button>
                </div>

                {/* Video Player */}
                <div className="p-4">
                    <video
                        controls
                        autoPlay
                        className="w-full rounded-lg"
                        src={`${apiBaseUrl}${video.url}`}
                    >
                        Your browser does not support the video tag.
                    </video>

                    {/* Video Details */}
                    <div className="mt-4">
                        <div className="flex items-center gap-4 text-sm mb-3">
                            <span className={`px-3 py-1 rounded ${isDarkMode ? 'bg-[#404040] text-[#b0b0b0]' : 'bg-gray-100 text-gray-600'}`}>
                                {video.category}
                            </span>
                            <span className={isDarkMode ? 'text-[#b0b0b0]' : 'text-gray-600'}>{video.views} views</span>
                            <span className={isDarkMode ? 'text-[#b0b0b0]' : 'text-gray-600'}>{formatDuration(video.duration)}</span>
                        </div>
                        <p className={isDarkMode ? 'text-[#d0d0d0]' : 'text-gray-700'}>{video.description}</p>
                        {video.tags && video.tags.length > 0 && (
                            <div className="mt-3 flex gap-2 flex-wrap">
                                {video.tags.map((tag, index) => (
                                    <span
                                        key={index}
                                        className={`px-2 py-1 rounded text-sm ${isDarkMode ? 'bg-tum-blue/20 text-tum-blue-light' : 'bg-blue-100 text-tum-blue'}`}
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerModal;
