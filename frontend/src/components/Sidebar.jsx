import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tum_klinikum_logo, new_chat_logo, search_logo, minimize_logo, maximize_logo, profile_photo_mock, expand_down_logo,  expand_up_logo } from '../assets';
import { authAPI, getCurrentUser } from '../services/api';

export default function Sidebar({ conversationTitles, setConversationTitles, setConversationId, userId }) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Filter conversations based on search query
  const filteredConversations = conversationTitles.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLogoutDropdown(false);
      }
    };

    if (showLogoutDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLogoutDropdown]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      navigate('/?logout=success');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout API fails, clear local storage and redirect
      navigate('/?logout=success');
    }
  };

  const handleCreateNewConversation = async () => {
    console.log("handleCreateNewConversation is called");
    try {
        //Create new conversation
        const res = await fetch('http://localhost:4004/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId })          
        });
        const data = await res.json();

        //Update selected conversation ID
        setConversationId(data._id);
        console.log("Created new conversation:", data);

        // Refresh conversation titles
        /*
        const titlesRes = await fetch(`http://localhost:4004/api/conversations/user/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        const titlesData = await titlesRes.json();
        setConversationTitles(titlesData); // update sidebar
        console.log("Updated conversation titles:", titlesData);
        */

    } catch (error) {
        console.error("Failed to create conversation or fetch titles:", error);
    }
};



  return ( 
    <div className={`bg-tum-blue-light-4 ${isMinimized ? 'w-12' : 'w-64'} text-black h-screen p-2 rounded-r-2xl flex flex-col transition-all duration-300`}>
      <div className={`flex ${isMinimized ? 'justify-center' : 'justify-between'} items-start mb-1`}>
        {!isMinimized && <img src={tum_klinikum_logo} alt="TUM Klinikum Logo" className="h-16 w-auto -ml-5 -my-2" />}
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-2 bg-tum-blue-light-4 rounded w-10 h-10 flex items-center justify-center focus:outline-none border-0"
        >
          {isMinimized ? <img src={maximize_logo} alt="Maximize" className="h-4" /> : <img src={minimize_logo} alt="Minimize" className="h-4" />}
        </button>
      </div>

      {!isMinimized && (
        <>
          <ul>
              <li className="flex items-center p-0 cursor-pointer rounded hover:bg-tum-blue-light-2" 
                onClick={() => {console.log("New chat clicked");
                                handleCreateNewConversation();}}>
                <img src={new_chat_logo} alt="New Chat Logo" className="h-4 text-sm" />
                <span className="ml-3">New chat</span>
              </li>
              
              {!isSearching ? (
                <li 
                  className="flex items-center p-0 cursor-pointer rounded hover:bg-tum-blue-light-2"
                  onClick={() => setIsSearching(true)}
                >
                  <img src={search_logo} alt="Search Logo" className="h-4" />
                  <span className="ml-3">Search chats</span>
                </li>
              ) : (
                <li className="flex items-center p-0">
                  <img src={search_logo} alt="Search Logo" className="h-4" />
                  <div className="relative flex-1 ml-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search conversations..."
                      className="w-full px-3 py-1 pr-8 text-sm border border-tum-gray rounded focus:outline-none focus:border-tum-blue"
                      autoFocus
                    />
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none p-0 border-0 bg-transparent"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )}
          </ul>

          <div className="border-t border-tum-gray m-2"></div>

          <button className="bg-tum-blue-light-4 text-left font-medium w-14 h-8 flex items-center justify-center font-medium focus:outline-none border-0" onClick={() => setIsHistoryVisible(!isHistoryVisible)}>
            Chats {isHistoryVisible ? <img src={expand_up_logo} alt="Collapse" className="w-3 h-3 ml-1 mt-1" /> : <img src={expand_down_logo} alt="Expand" className="w-3 h-3 ml-1 mt-1" />}
          </button>

          {isHistoryVisible && (
            <nav className="mt-2 mr-2 flex-1 overflow-y-auto pr-3">
              <ul>
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conv) => (
                    <li 
                      key={conv._id} 
                      className="flex items-center p-1 mb-1 cursor-pointer rounded hover:bg-tum-blue-light-2"
                      onClick={() => {
                        console.log("Selected conversation ID:", conv._id);
                        setConversationId(conv._id);
                      }}
                    >
                      <span className="truncate text-sm font-montserrat">
                        {conv.title}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-400 text-center py-2">
                    No conversations found
                  </li>
                )}
              </ul>
            </nav>
          )}

          <div className="relative mt-auto" ref={dropdownRef}>
            <div 
              className="flex items-center gap-3 p-1 border-gray-700 cursor-pointer rounded hover:bg-tum-blue-light-2"
              onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
            >
              <div className="w-8 h-8 rounded-full bg-gray-500 overflow-hidden">
                <img
                  src={profile_photo_mock} 
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* User info */}
              <div className="flex flex-col flex-1">
                <span className="text-sm font-medium text-tum-black">
                  {currentUser?.email?.split('@')[0] || 'User'}
                </span>
                <span className="text-xs text-gray-400">
                  {currentUser?.role || 'TUM Klinikum Staff'}
                </span>
              </div>
            </div>

            {/* Logout dropdown */}
            {showLogoutDropdown && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-tum-white border border-tum-grey-7 rounded-lg shadow-lg z-10">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-tum-black bg-tum-white hover:bg-tum-blue-light-2 rounded-lg transition-colors"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {isMinimized && (
        <>
            <nav className="mt-1">
              <ul>
                  <li className="flex items-center p-2 cursor-pointer rounded hover:bg-tum-blue-light-2 justify-center" 
                    onClick={() => {console.log("New chat clicked");
                                    handleCreateNewConversation();}}>
                    <img src={new_chat_logo} alt="New Chat Logo" className="h-4" />
                  </li>
                  <li className="flex items-center p-2 cursor-pointer rounded hover:bg-tum-blue-light-2 justify-center">
                    <img src={search_logo} alt="Search Logo" className="h-4" />
                  </li>
              </ul>
          </nav>
          <div className="relative mt-auto" ref={dropdownRef}>
            <div 
              className="w-8 h-8 rounded-full bg-gray-500 overflow-hidden cursor-pointer hover:ring-2 hover:ring-tum-blue"
              onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
              title="Click to logout"
            >
              <img
                src={profile_photo_mock} 
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Logout dropdown for minimized state */}
            {showLogoutDropdown && (
              <div className="absolute bottom-full left-0 mb-2 bg-tum-white border border-tum-grey-7 rounded-lg shadow-lg z-10 whitespace-nowrap">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-tum-black bg-tum-white hover:bg-tum-blue-light-2 rounded-lg transition-colors"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
