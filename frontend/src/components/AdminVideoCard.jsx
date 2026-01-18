import React, { useState, useRef, useEffect } from 'react';

const AdminVideoCard = ({ video, onVideoClick, onEdit, onDelete, apiBaseUrl }) => {
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
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer relative">
            {/* Three dots menu */}
            <div className="absolute top-2 right-2 z-20" ref={dropdownRef}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowOptions(!showOptions);
                    }}
                    className="bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-800 shadow-sm"
                >
                    ⋮
                </button>
                
                {showOptions && (
                    <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[120px] py-2 z-30 flex flex-col gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(video);
                                setShowOptions(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white hover:bg-blue-50 text-gray-700 text-sm transition-colors"
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
                            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white hover:bg-red-50 text-red-600 text-sm transition-colors"
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

            {/* Video Info */}
            <div className="p-3 flex flex-col">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2 overflow-hidden text-ellipsis min-h-[2.5rem]">
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
                    className="w-full bg-tum-blue text-white py-1.5 text-sm rounded-lg hover:bg-tum-blue-dark transition-colors mt-auto"
                >
                    Watch Video
                </button>
            </div>
        </div>
    );
};

export default AdminVideoCard;
