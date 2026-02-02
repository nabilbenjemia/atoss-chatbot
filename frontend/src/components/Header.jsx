import { Link, useLocation } from "react-router-dom";

export default function Header({ role, isDarkMode }) {
  const location = useLocation();
  const path = location.pathname;

  const headerLink =
    `px-4 py-1.5 text-sm font-medium rounded-full border transition
     bg-tum-blue text-white border-tum-blue hover:bg-tum-dark-blue hover:text-white`;

  // Determine which buttons to show based on the current path
  let leftButtons = [];
  let rightButtons = [];

  if (path === "/chatbot") {
    leftButtons = [
      <Link key="profile" to="/profile" className={headerLink}>Profile</Link>,
      <Link key="tutorials" to="/learning" className={headerLink}>Tutorials</Link>
    ];
  } else if (path === "/profile") {
    leftButtons = [
      <Link key="chatbot" to="/chatbot" className={headerLink}>← Back to Chatbot</Link>,
      <Link key="tutorials" to="/learning" className={headerLink}>Tutorials</Link>
    ];
  } else if (path === "/learning") {
    leftButtons = [
      <Link key="chatbot" to="/chatbot" className={headerLink}>← Back to Chatbot</Link>,
      <Link key="profile" to="/profile" className={headerLink}>Profile</Link>
    ];
  } else {
    leftButtons = [
      <Link key="chatbot" to="/chatbot" className={headerLink}>← Back to Chatbot</Link>,
    ];
  }

  // Optionally, add admin links on the right for /chatbot
  if (path === "/chatbot" && role === "Admin") {
    leftButtons = leftButtons.concat([
      <Link
        key="analytics"
        to="/analytics"
        className="px-4 py-1.5 text-sm font-medium rounded-full border transition bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white"
      >
        Analytics
      </Link>,
      <Link
        key="ingest"
        to="/ingest"
        className="px-4 py-1.5 text-sm font-medium rounded-full border transition bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white"
      >
        Manage Knowledge
      </Link>
    ]);
  }

  return (
    <header className={`fixed top-0 left-0 w-full h-14 shadow z-50 ${isDarkMode ? 'bg-[#212121]' : 'bg-white'}`}>
      <div className="relative h-full flex items-center">
        {/* Left links */}
        <div className="absolute left-6 top-0 h-full flex items-center gap-2">
          {leftButtons}
        </div>

        {/* Center logo */}
        <div className="absolute left-1/2 top-0 h-full flex items-center gap-2 -translate-x-1/2">
          <img src={isDarkMode ? "/TUM_Klinikum_white.png" : "/TUM_Klinikum.png"} alt="Logo" className="h-10" />
          <span className={`mx-1 text-xl font-bold mr-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>x</span>
          <img src={isDarkMode ? "/ATOSS_icon_white.png" : "/ATOSS_icon.png"} alt="ATOSS Logo" className="h-7" />
        </div>

        {/* Right links (admin only) */}
        <div className="absolute right-6 top-0 h-full flex items-center gap-2">
          {rightButtons}
        </div>
      </div>
    </header>
  );
}
