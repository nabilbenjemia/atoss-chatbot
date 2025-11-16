export default function UserMessage({ message, timestamp }) {
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex justify-end mb-4 group">
            <div className="relative max-w-[60%]">
                <div className="bg-tum-blue text-white px-4 py-2 rounded-2xl">
                    {message}
                </div>
                {timestamp && (
                    <span className="absolute right-0 -bottom-5 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTime(timestamp)}
                    </span>
                )}
            </div>
        </div>
    )
}