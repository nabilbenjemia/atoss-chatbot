import React, { useState } from 'react';
import { tum_klinikum_logo, new_chat_logo, search_logo, minimize_logo, maximize_logo, profile_photo_mock, expand_down_logo,  expand_up_logo } from '../assets'

export default function Sidebar() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);

  const conversations = [
    { id: 1, title: '🤖  This is the title of Conversation 1' },
    { id: 2, title: '💬 This is the title of Conv 2' },
    { id: 3, title: '🎉 This is the title of Conversation 3' },
    { id: 4, title: '🎉 This is the title of Conversation 4' },
    { id: 5, title: '💬 Conversation 5' },
    { id: 4, title: '💬 Conversation 6' },
    { id: 7, title: '💬 This is the title of Conver. 7' },
    { id: 8, title: '📱 Mobile app development discussion' },
    { id: 9, title: '🎨 Design feedback and suggestions' },
    { id: 10, title: '🔧 Troubleshooting backend issues' },
    { id: 11, title: '📊 Q3 Performance metrics review' },
    { id: 12, title: '🌟 Feature request: Dark mode' },
    { id: 13, title: '🐛 Bug report: Login validation error' },
    { id: 14, title: '💡 Brainstorming new product ideas' },
    { id: 15, title: '📚 Documentation update needed' },
    { id: 16, title: '🚀 Planning the next sprint goals' },
    { id: 17, title: '🔐 Security audit findings' },
    { id: 18, title: '⚡ API performance optimization' },
    { id: 19, title: '🎯 Marketing campaign strategy' },
    { id: 20, title: '👥 Team onboarding process' },
    { id: 21, title: '📈 Analytics dashboard improvements' },
    { id: 22, title: '🛠️ DevOps pipeline configuration' },
  ];

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
              <li className="flex items-center p-0 cursor-pointer rounded hover:bg-tum-blue-light-2">
                <img src={new_chat_logo} alt="New Chat Logo" className="h-4 text-sm" />
                <span className="ml-3">New chat</span>
              </li>
              <li className="flex items-center p-0 cursor-pointer rounded hover:bg-tum-blue-light-2">
                <img src={search_logo} alt="Search Logo" className="h-4" />
                <span className="ml-3">Search chats</span>
              </li>
          </ul>

          <div className="border-t border-tum-gray m-2"></div>

          <button className="bg-tum-blue-light-4 text-left font-medium w-14 h-8 flex items-center justify-center font-medium focus:outline-none border-0" onClick={() => setIsHistoryVisible(!isHistoryVisible)}>
            Chats {isHistoryVisible ? <img src={expand_up_logo} alt="Collapse" className="w-3 h-3 ml-1 mt-1" /> : <img src={expand_down_logo} alt="Expand" className="w-3 h-3 ml-1 mt-1" />}
          </button>

          {isHistoryVisible && (<nav className="mt-2 mr-2 flex-1 overflow-y-auto">
              <ul>
                  {conversations.map((conv) => (
                      <li key={conv.id} className="flex items-center p-1 mb-1 cursor-pointer rounded hover:bg-tum-blue-light-2">
                          <span className="truncate text-sm font-montserrat">{conv.title}</span>
                      </li>
                  ))}
              </ul>
          </nav>
        )}

          <div className="flex items-center gap-3 p-1 border-gray-700 mt-auto">
            <div className="w-8 h-8 rounded-full bg-gray-500 overflow-hidden">
              <img
                src={profile_photo_mock} 
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </div>

            {/* User info */}
            <div className="flex flex-col">
              <span className="text-sm font-medium text-tum-black">Max Mustermann</span>
              <span className="text-xs text-gray-400">TUM Klinikum Staff</span>
            </div>
          </div>
        </>
      )}

      {isMinimized && (
        <>
            <nav className="mt-1">
              <ul>
                  <li className="flex items-center p-2 cursor-pointer rounded hover:bg-tum-blue-light-2 justify-center">
                    <img src={new_chat_logo} alt="New Chat Logo" className="h-4" />
                  </li>
                  <li className="flex items-center p-2 cursor-pointer rounded hover:bg-tum-blue-light-2 justify-center">
                    <img src={search_logo} alt="Search Logo" className="h-4" />
                  </li>
              </ul>
          </nav>
          <div className="w-8 h-8 mt-auto rounded-full bg-gray-500 overflow-hidden">
              <img
                src={profile_photo_mock} 
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </div>
        </>
      )}
    </div>
  )
}
