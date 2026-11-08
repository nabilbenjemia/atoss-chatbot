import React, { useRef, useState } from "react";
import PropTypes from "prop-types";

export default function MessageInput({ onSendMessage, onInterrupt, isStreaming, isDarkMode }) {
  const textareaRef = useRef(null);
  const [message, setMessage] = useState("");

  const handleInput = (e) => {
    const textarea = e.target;
    setMessage(textarea.value);
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // if user clicks send button
  const handleSend = () => {
    if (message.trim() && !isStreaming) {  // ADD: Check isStreaming
      onSendMessage(message);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.value = "";
      }
    }
  };
  // if user presses enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {  // ADD: Check isStreaming
      e.preventDefault();
      handleSend();
    }
  };

  return (
   <div className={`sticky bottom-0 mt-auto w-full max-w-3xl h-auto mx-auto p-4 z-10 ${isDarkMode ? 'bg-[#212121] border-t border-gray-700' : 'bg-white border-t border-tum-gray'}`}>
      <div className={`flex items-center gap-1 rounded-2xl shadow-lg p-1 ${isDarkMode ? 'bg-[#2f2f2f] border border-gray-700' : 'bg-white border border-tum-blue-light-2'}`}>
        <textarea
          ref={textareaRef}
          placeholder={isStreaming ? "AI is responding..." : "Type your message..."}  // CHANGE: Dynamic placeholder
          disabled={isStreaming}  // ADD: Disable during streaming
          className={`flex-1 outline-none resize-y min-h-[40px] max-h-[240px] overflow-y-auto pl-3 py-2 text-sm ${
            isDarkMode 
              ? (isStreaming ? 'bg-[#1f1f1f] cursor-not-allowed text-gray-200 placeholder-gray-500' : 'bg-transparent text-gray-200 placeholder-gray-500')
              : (isStreaming ? 'bg-gray-100 cursor-not-allowed text-gray-700 placeholder-gray-400' : 'bg-transparent text-gray-700 placeholder-gray-400')
          }`}
          rows={1}
          onInput={handleInput}
          onKeyPress={handleKeyPress}
          value={message}
        />
        
        {/* CHANGE: Conditional button rendering */}
        {isStreaming ? (
          <button 
            onClick={onInterrupt}
            className="self-end px-3 py-0 mb-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors duration-200 font-semibold"
          >
            Stop
          </button>
        ) : (
          <button 
            onClick={handleSend}
            disabled={!message.trim()}
            className="self-end px-3 py-0 mb-2 bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </div>
      <p className={`text-center text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-tum-gray'}`}>
        © Technische Universität München 2026
      </p>
    </div>
  );
}

// PropTypes validation 
MessageInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  onInterrupt: PropTypes.func.isRequired,
  isStreaming: PropTypes.bool.isRequired,
  isDarkMode: PropTypes.bool,
};