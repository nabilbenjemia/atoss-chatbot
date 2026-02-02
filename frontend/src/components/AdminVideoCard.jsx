import React, { useState, useRef, useEffect } from 'react';

const AdminVideoCard = ({ video, onVideoClick, onEdit, onDelete, apiBaseUrl, isDarkMode }) => {
    const [showOptions, setShowOptions] = useState(false);
    const dropdownRef = useRef(null);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowOptions(false);
            }
        };

        if (showOptions) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showOptions]);

    return (
        <div className={`rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-72 flex flex-col relative ${isDarkMode ? 'bg-tum-grey-2' : 'bg-white'}`}>
            {/* Three dots menu */}
            <div className="absolute top-2 right-2 z-20" ref={dropdownRef}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowOptions(!showOptions);
                    }}
                    className={`rounded-full w-7 h-7 flex items-center justify-center shadow-sm ${isDarkMode ? 'bg-tum-grey-3 text-white hover:bg-tum-grey-1 hover:text-tum-grey-3' : 'bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-600 hover:text-gray-800'}`}
                >
                    ⋮
                </button>
                
                {showOptions && (
                    <div className={`absolute right-0 mt-2 border border-tum-grey-1 rounded-xl shadow-xl min-w-[120px] py-2 z-30 flex flex-col gap-2 ${isDarkMode ? 'bg-tum-grey-2 text-tum-grey-1' : 'bg-white text-gray-700'}`}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(video);
                                setShowOptions(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-full ${isDarkMode ? 'bg-tum-grey-2 hover:bg-tum-grey-3 text-tum-grey-1' : 'bg-white hover:bg-blue-50 text-gray-700'} text-sm transition-colors`}
                        >
                            {/* Edit icon (SVG) */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13zm0 0V17h4" />
                            </svg>
                            Edit
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(video);
                                setShowOptions(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-full ${isDarkMode ? 'bg-tum-grey-2 hover:bg-red-50 text-red-600' : 'bg-white hover:bg-red-50 text-red-600'} text-sm transition-colors`}
                        >
                            {/* Delete icon (SVG) */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Thumbnail */}
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

            {/* Video Info - same layout as VideoCard */}
            <div className="p-3 flex flex-col h-full">
                <div className="flex-1">
                    <h3 className={`font-semibold text-sm mb-1 line-clamp-1 overflow-hidden text-ellipsis ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>
                        {video.title}
                    </h3>
                    <p className={`text-xs mb-1 line-clamp-1 overflow-hidden text-ellipsis min-h-[1.5rem] ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>
                        {video.description || '\u00A0'}
                    </p>
                </div>
                
                <div className={`flex items-center justify-between text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span className={`px-2 py-0.5 rounded ${isDarkMode ? 'bg-tum-grey-3 text-tum-grey-1' : 'bg-gray-100'}`}>
                        {video.category}
                    </span>
                    <span>{video.views} views</span>
                </div>
                
                <button
                    onClick={() => onVideoClick(video)}
                    className={`w-full bg-tum-blue text-white py-1.5 text-sm rounded-lg hover:bg-tum-blue-dark transition-colors`}
                >
                    Watch Video
                </button>
            </div>
        </div>
    );
};

export default AdminVideoCard;
