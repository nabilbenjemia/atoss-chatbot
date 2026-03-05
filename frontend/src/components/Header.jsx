import { Link, useLocation } from "react-router-dom";

const headerTranslations = {
  en: {
    profile: 'Profile',
    tutorials: 'Tutorials',
    backToChatbot: '← Back to Chatbot',
    analytics: 'Analytics',
    manageKnowledge: 'Manage Knowledge',
  },
  de: {
    profile: 'Profil',
    tutorials: 'Tutorials',
    backToChatbot: '← Zurück zum Chatbot',
    analytics: 'Analytics',
    manageKnowledge: 'Wissensdatenbank verwalten',
  },
};

export default function Header({ role, isDarkMode, language = 'en' }) {
  const location = useLocation();
  const path = location.pathname;
  const t = headerTranslations[language] || headerTranslations.en;

  const headerLink =
    `px-4 py-1.5 text-sm font-medium rounded-full border transition
     bg-tum-blue text-white border-tum-blue hover:bg-tum-dark-blue hover:text-white`;

  // Determine which buttons to show based on the current path
  let leftButtons = [];
  let rightButtons = [];

  if (path === "/chatbot") {
    leftButtons = [
      <Link key="profile" to="/profile" className={headerLink}>{t.profile}</Link>,
      <Link key="tutorials" to="/learning" className={headerLink}>{t.tutorials}</Link>
    ];
  } else if (path === "/profile") {
    leftButtons = [
      <Link key="chatbot" to="/chatbot" className={headerLink}>{t.backToChatbot}</Link>,
      <Link key="tutorials" to="/learning" className={headerLink}>{t.tutorials}</Link>
    ];
  } else if (path === "/learning") {
    leftButtons = [
      <Link key="chatbot" to="/chatbot" className={headerLink}>{t.backToChatbot}</Link>,
      <Link key="profile" to="/profile" className={headerLink}>{t.profile}</Link>
    ];
  } else if (path === "/analytics" || path === "/admin/ingestion") {
    leftButtons = [
      <Link key="chatbot" to="/chatbot" className={headerLink}>{t.backToChatbot}</Link>,
      <Link key="profile" to="/profile" className={headerLink}>{t.profile}</Link>,
      <Link key="tutorials" to="/learning" className={headerLink}>{t.tutorials}</Link>
    ];
    if (role === "Admin") {
      leftButtons = leftButtons.concat(
        path === "/analytics"
          ? [<Link key="ingest" to="/admin/ingestion" className="px-4 py-1.5 text-sm font-medium rounded-full border transition bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white">{t.manageKnowledge}</Link>]
          : [<Link key="analytics" to="/analytics" className="px-4 py-1.5 text-sm font-medium rounded-full border transition bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white">{t.analytics}</Link>]
      );
    }
  } else {
    leftButtons = [
      <Link key="chatbot" to="/chatbot" className={headerLink}>{t.backToChatbot}</Link>,
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
        {t.analytics}
      </Link>,
      <Link
        key="ingest"
        to="/admin/ingestion"
        className="px-4 py-1.5 text-sm font-medium rounded-full border transition bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white"
      >
        {t.manageKnowledge}
      </Link>
    ]);
  }

  return (
    <header className={`fixed top-0 left-0 w-full h-14 shadow z-50 ${isDarkMode ? 'bg-[#212121]' : 'bg-white'}`}>
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        {/* Left links */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {leftButtons.map((btn, idx) => (
            <span key={idx} className="hidden sm:inline-flex">
              {btn}
            </span>
          ))}
          {/* Mobile: show only first button */}
          <span className="sm:hidden">
            {leftButtons[0]}
          </span>
        </div>

        {/* Center logo - hidden on small screens, visible on medium+ */}
        <div className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <img src={isDarkMode ? "/TUM_Klinikum_white.png" : "/TUM_Klinikum.png"} alt="Logo" className="h-10" />
          <span className={`mx-1 text-xl font-bold mr-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>x</span>
          <img src={isDarkMode ? "/ATOSS_icon_white.png" : "/ATOSS_icon.png"} alt="ATOSS Logo" className="h-7" />
        </div>

        {/* Right links (admin only) */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {rightButtons}
        </div>
      </div>
    </header>
  );
}
