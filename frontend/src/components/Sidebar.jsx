import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tum_klinikum_logo, tum_logo_darkmode, new_chat_logo, search_logo, minimize_logo, maximize_logo, profile_photo_mock, expand_down_logo,  expand_up_logo, delete_logo } from '../assets';
import { authAPI, getCurrentUser, userAPI } from '../services/api';

export default function Sidebar({ conversationTitles, setConversationTitles, setConversationId, conversationId, userId, onNewChat, isDarkMode = false }) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [userProfile, setUserProfile] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Get language from user profile or default to English
  const language = userProfile?.preferences?.language || 'en';
  
  // Translations
  const translations = {
    en: {
      newChat: 'New chat',
      searchChats: 'Search chats',
      chats: 'Chats',
      logOut: 'Log out',
      profile: 'Profile'
    },
    de: {
      newChat: 'Neuer Chat',
      searchChats: 'Suche Chats',
      chats: 'Chats',
      logOut: 'Abmelden',
      profile: 'Profil'
    }
  };
  
  const t = translations[language] || translations.en;
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDropdownId, setDeleteDropdownId] = useState(null);
  const dropdownRef = useRef(null);

  // Filter conversations based on search query
  const filteredConversations = conversationTitles.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };
  const deleteDropdownRef = useRef(null);

  // Load user profile to get username
  const loadUserProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      if (response.success) {
        setUserProfile(response.data);
      }
    } catch (error) {
      console.error('Failed to load user profile in sidebar:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      loadUserProfile();
    }
  }, [userId]);

  // Reload profile when window regains focus (user might have updated profile in another tab/window)
  useEffect(() => {
    const handleFocus = () => {
      if (userId) {
        loadUserProfile();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userId]);

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

  // Close delete dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (deleteDropdownRef.current && !deleteDropdownRef.current.contains(event.target)) {
        setDeleteDropdownId(null);
      }
    };

    if (deleteDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [deleteDropdownId]);

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

  const handleCreateNewConversation = () => {
    console.log("New chat clicked");
    if (onNewChat) {
      onNewChat();  // Call the parent's function
    }
  };

  const handleDeleteConversation = async (convId) => {
    try {
      console.log("Deleting conversation:", convId);
      
      // Use environment variable or default to localhost
      const API_BASE_URL = import.meta.env.VITE_CONVERSATION_URL || 'http://localhost:4004';
      
      // Call DELETE API
      const response = await fetch(`${API_BASE_URL}/api/conversations/${convId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      console.log("Conversation deleted successfully");
      
      // Only update UI after successful deletion
      setConversationTitles(conversationTitles.filter(conv => conv._id !== convId));
      
      // Close the dropdown
      setDeleteDropdownId(null);
      
      // If the deleted conversation was selected, clear the selection
      setConversationId(null);
      
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      // Optionally show an error message to the user
      alert("Failed to delete conversation. Please try again.");
    }
  };

  return ( 
    <div className={`${isDarkMode ? 'bg-[#1f1f1f]' : 'bg-tum-blue-light-4'} ${isMinimized ? 'w-12' : 'w-64'} ${isDarkMode ? 'text-gray-200' : 'text-black'} h-screen p-2 rounded-r-2xl flex flex-col transition-all duration-300`}>
      <div className={`flex ${isMinimized ? 'justify-center' : (isDarkMode ? 'justify-center' : 'justify-between')} items-start mb-1`}>
        {!isMinimized && (
          <img 
            src={isDarkMode ? tum_logo_darkmode : tum_klinikum_logo} 
            alt="TUM Klinikum Logo" 
            className={isDarkMode ? "h-12 w-auto rounded-lg" : "h-16 w-auto -ml-5 -my-2"} 
          />
        )}
        <button 
          onClick={() => setIsMinimized(!isMinimized)}
          className={`p-2 rounded w-10 h-10 flex items-center justify-center focus:outline-none border-0 ${isDarkMode ? 'bg-[#1f1f1f] hover:bg-[#2f2f2f]' : 'bg-tum-blue-light-4'}`}
        >
          {isMinimized ? <img src={maximize_logo} alt="Maximize" className="h-4" /> : <img src={minimize_logo} alt="Minimize" className="h-4" />}
        </button>
      </div>

      {!isMinimized && (
        <>
          <ul>
              <li className={`flex items-center p-0 cursor-pointer rounded ${isDarkMode ? 'hover:bg-[#2f2f2f]' : 'hover:bg-tum-blue-light-2'}`} 
                onClick={() => handleCreateNewConversation()}>
                <img src={new_chat_logo} alt="New Chat Logo" className="h-4 text-sm" />
                <span className="ml-3">{t.newChat}</span>
              </li>
              
              {!isSearching ? (
                <li 
                  className={`flex items-center p-0 cursor-pointer rounded ${isDarkMode ? 'hover:bg-[#2f2f2f]' : 'hover:bg-tum-blue-light-2'}`}
                  onClick={() => setIsSearching(true)}
                >
                  <img src={search_logo} alt="Search Logo" className="h-4" />
                  <span className="ml-3">{t.searchChats}</span>
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
                      className={`w-full px-3 py-1 pr-8 text-sm border rounded focus:outline-none focus:border-tum-blue ${isDarkMode ? 'bg-[#2f2f2f] border-gray-600 text-gray-200 placeholder-gray-500' : 'border-tum-gray'}`}
                      autoFocus
                    />
                    <button
                      onClick={handleClearSearch}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none p-0 border-0 bg-transparent ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              )}
          </ul>

          <div className={`border-t m-2 ${isDarkMode ? 'border-gray-700' : 'border-tum-gray'}`}></div>

          <button className={`text-left font-medium w-14 h-8 flex items-center justify-center font-medium focus:outline-none border-0 ${isDarkMode ? 'bg-[#1f1f1f] hover:bg-[#2f2f2f]' : 'bg-tum-blue-light-4'}`} onClick={() => setIsHistoryVisible(!isHistoryVisible)}>
            {t.chats} {isHistoryVisible ? <img src={expand_up_logo} alt="Collapse" className="w-3 h-3 ml-1 mt-1" /> : <img src={expand_down_logo} alt="Expand" className="w-3 h-3 ml-1 mt-1" />}
          </button>

          {isHistoryVisible && (
            <nav className="mt-2 mr-2 flex-1 overflow-y-auto pr-3">
              <ul>
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conv) => (
                    <li 
                      key={conv._id} 
                      className={`group flex items-center justify-between p-1 mb-1 cursor-pointer rounded ${
                        isDarkMode 
                          ? `hover:bg-[#2f2f2f] ${conversationId === conv._id ? 'border-2 border-tum-blue bg-[#2f2f2f]' : ''}`
                          : `hover:bg-tum-blue-light-2 ${conversationId === conv._id ? 'border-2 border-tum-blue' : ''}`
                      }`}
                    >
                      <span 
                        className="truncate text-sm font-montserrat flex-1"
                        onClick={() => {
                          console.log("Selected conversation ID:", conv._id);
                          setConversationId(conv._id);
                        }}
                      >
                        {conv.title}
                      </span>
                      
                      <div 
                        className={`relative flex-shrink-0 transition-opacity ${
                          deleteDropdownId === conv._id 
                            ? 'opacity-100' 
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                        ref={deleteDropdownId === conv._id ? deleteDropdownRef : null}
                      >
                        {deleteDropdownId === conv._id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv._id);
                            }}
                            className="w-16 h-5 text-xs text-tum-white bg-red-700 hover:bg-red-800 rounded transition-colors flex items-center justify-center"
                          >
                            Löschen
                          </button>
                        ) : (
                          <img 
                            src={delete_logo} 
                            alt="Delete" 
                            className="w-4 h-4 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDropdownId(conv._id);
                            }}
                          />
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className={`text-sm text-center py-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    No conversations found
                  </li>
                )}
              </ul>
            </nav>
          )}

          <div className="relative mt-auto" ref={dropdownRef}>
            <div 
              className={`flex items-center gap-3 p-1 cursor-pointer rounded ${isDarkMode ? 'hover:bg-[#2f2f2f]' : 'border-gray-700 hover:bg-tum-blue-light-2'}`}
              onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
            >
              <div className={`w-8 h-8 rounded-full bg-gray-500 overflow-hidden border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                {userProfile?.profilePicture ? (
                  <img
                    src={userProfile.profilePicture}
                    alt="User Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={profile_photo_mock}
                    alt="User Avatar"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* User info */}
              <div className="flex flex-col flex-1">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-tum-black'}`}>
                  {userProfile?.username || currentUser?.email?.split('@')[0] || 'User'}
                </span>
                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {currentUser?.role || 'TUM Klinikum Staff'}
                </span>
              </div>
            </div>

            {/* Logout dropdown */}
            {showLogoutDropdown && (
              <div className={`absolute bottom-full left-0 right-0 mb-2 border rounded-lg shadow-lg z-10 ${isDarkMode ? 'bg-[#2f2f2f] border-gray-700' : 'bg-tum-white border-tum-grey-7'}`}>
                <button
                  onClick={() => {
                    setShowLogoutDropdown(false);
                    navigate('/profile');
                  }}
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors border-b ${isDarkMode ? 'text-gray-200 bg-[#2f2f2f] hover:bg-[#3f3f3f] border-gray-700' : 'text-tum-black bg-tum-white hover:bg-tum-blue-light-2 border-tum-grey-7'}`}
                >
                  {t.profile}
                </button>
                <button
                  onClick={handleLogout}
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${isDarkMode ? 'text-gray-200 bg-[#2f2f2f] hover:bg-[#3f3f3f]' : 'text-tum-black bg-tum-white hover:bg-tum-blue-light-2'}`}
                >
                  {t.logOut}
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
                  <li className={`flex items-center p-2 cursor-pointer rounded justify-center ${isDarkMode ? 'hover:bg-[#2f2f2f]' : 'hover:bg-tum-blue-light-2'}`} 
                    onClick={() => {console.log("New chat clicked");
                                    handleCreateNewConversation();}}>
                    <img src={new_chat_logo} alt="New Chat Logo" className="h-4" />
                  </li>
                  <li className={`flex items-center p-2 cursor-pointer rounded justify-center ${isDarkMode ? 'hover:bg-[#2f2f2f]' : 'hover:bg-tum-blue-light-2'}`}>
                    <img src={search_logo} alt="Search Logo" className="h-4" />
                  </li>
              </ul>
          </nav>
          <div className="relative mt-auto" ref={dropdownRef}>
            <div 
              className={`w-8 h-8 rounded-full bg-gray-500 overflow-hidden cursor-pointer hover:ring-2 hover:ring-tum-blue border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
              onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
              title="Click to logout"
            >
              {userProfile?.profilePicture ? (
                <img
                  src={userProfile.profilePicture}
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={profile_photo_mock}
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            {/* Logout dropdown for minimized state */}
            {showLogoutDropdown && (
              <div className={`absolute bottom-full left-0 mb-2 border rounded-lg shadow-lg z-10 whitespace-nowrap ${isDarkMode ? 'bg-[#2f2f2f] border-gray-700' : 'bg-tum-white border-tum-grey-7'}`}>
                <button
                  onClick={() => {
                    setShowLogoutDropdown(false);
                    navigate('/profile');
                  }}
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors border-b ${isDarkMode ? 'text-gray-200 bg-[#2f2f2f] hover:bg-[#3f3f3f] border-gray-700' : 'text-tum-black bg-tum-white hover:bg-tum-blue-light-2 border-tum-grey-7'}`}
                >
                  {t.profile}
                </button>
                <button
                  onClick={handleLogout}
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${isDarkMode ? 'text-gray-200 bg-[#2f2f2f] hover:bg-[#3f3f3f]' : 'text-tum-black bg-tum-white hover:bg-tum-blue-light-2'}`}
                >
                  {t.logOut}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
