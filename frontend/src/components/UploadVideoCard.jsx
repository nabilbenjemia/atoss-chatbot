import React from 'react';

const UploadVideoCard = ({ onUploadClick }) => {
    return (
        <div 
            onClick={onUploadClick}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border-2 border-dashed border-gray-300 hover:border-tum-blue flex items-center justify-center min-h-[280px]"
        >
            <div className="text-center p-6">
                <div className="text-6xl text-gray-300 mb-3">+</div>
                <h3 className="font-semibold text-lg text-gray-600 mb-2">Upload Video</h3>
                <p className="text-sm text-gray-400">Click to add a new video</p>
            </div>
        </div>
    );
};

export default UploadVideoCard;
