export default function AIMessage({ message, createdAt }) {
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex justify-start mb-4 group">
            <div className="relative max-w-[60%]">
                <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-2xl break-words">
                    {message}
                </div>
                {createdAt && (
                    <span className="absolute left-0 -bottom-5 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTime(createdAt)}
                    </span>
                )}
            </div>
        </div>
    )
}