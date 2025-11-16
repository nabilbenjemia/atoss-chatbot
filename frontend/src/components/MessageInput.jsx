import React, { useRef, useState } from "react";

export default function MessageInput({ onSendMessage }) {
  const textareaRef = useRef(null);
  const [message, setMessage] = useState("");

  const handleInput = (e) => {
    const textarea = e.target;
    setMessage(textarea.value);
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.value = "";
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="sticky bottom-0 mt-auto w-full max-w-3xl h-auto mx-auto p-4 bg-white border-t border-tum-gray z-10">
      <div className="flex items-center gap-1 bg-white rounded-2xl shadow-lg border border-tum-blue-light-2 p-1">
        <textarea
          ref={textareaRef}
          placeholder="Type your message..."
          className="flex-1 outline-none text-gray-700 placeholder-gray-400 bg-transparent resize-y min-h-[40px] max-h-[240px] overflow-y-auto pl-3 py-2 text-sm"
          rows={1}
          onInput={handleInput}
          onKeyPress={handleKeyPress}
          value={message}
        />
        <button 
          onClick={handleSend}
          className="self-end px-3 py-0 mb-2 bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors duration-200 font-semibold"
        >
          Send
        </button>
      </div>
      <p className="text-center text-xs text-tum-gray mt-2">
        © Technische Universität München 2026
      </p>
    </div>
  );
}