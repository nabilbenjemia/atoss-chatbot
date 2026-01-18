import React from 'react';

const VideoCard = ({ video, onVideoClick, apiBaseUrl }) => {
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
            {/* Thumbnail - smaller height */}
            <div className="relative">
                <img
                    src={`${apiBaseUrl}${video.thumbnail}`}
                    alt={video.title}
                    className="w-full h-36 object-cover"
                    onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/320x180?text=No+Thumbnail';
                    }}
                />
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                    {formatDuration(video.duration)}
                </div>
            </div>

            {/* Video Info - more compact */}
            <div className="p-3">
                <h3 className="font-semibold text-sm mb-1 line-clamp-1 overflow-hidden text-ellipsis">
                    {video.title}
                </h3>
                <p className="text-gray-600 text-xs mb-2 line-clamp-1 overflow-hidden text-ellipsis">
                    {video.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="bg-gray-100 px-2 py-1 rounded">
                        {video.category}
                    </span>
                    <span>{video.views} views</span>
                </div>
                <button
                    onClick={() => onVideoClick(video)}
                    className="w-full bg-tum-blue text-white py-1.5 text-sm rounded-lg hover:bg-tum-blue-dark transition-colors"
                >
                    Watch Video
                </button>
            </div>
        </div>
    );
};

export default VideoCard;
