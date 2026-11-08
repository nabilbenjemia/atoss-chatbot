import React from 'react';

const VideoCard = ({ video, onVideoClick, apiBaseUrl, isDarkMode }) => {
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-72 flex flex-col ${isDarkMode ? 'bg-[#2f2f2f]' : 'bg-white'}`}>
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
            <div className="p-3 flex flex-col h-full">
                {/* Top: title + description */}
                <div className="flex-1">
                    <h3 className={`font-semibold text-sm mb-1 line-clamp-1 overflow-hidden text-ellipsis ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>
                        {video.title}
                    </h3>
                    <p className={`text-xs mb-1 line-clamp-1 overflow-hidden text-ellipsis min-h-[1.5rem] ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>
                        {video.description || '\u00A0'}
                    </p>
                </div>

                {/* Category row */}
                <div className={`flex items-center justify-between text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span className={`px-2 py-0.5 rounded ${isDarkMode ? 'bg-tum-grey-3 text-tum-grey-1' : 'bg-gray-100'}`}>
                        {video.category}
                    </span>
                    <span>{video.views} views</span>
                </div>

                {/* Button at bottom */}
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
