import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { userAPI, getCurrentUser } from '../services/api';
import { validatePassword } from '../utils/validation';
import Header from '../components/Header'; // or the correct path to your header component

export default function UserProfilePage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // Profile data
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [originalProfilePicture, setOriginalProfilePicture] = useState(null);
  
  // Password change form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  
  // Preferences
  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'en',
    notifications: {
      email: true,
      chat: true,
    },
  });
  
  // Delete account confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Add admin functionality
  const [adminEmail, setAdminEmail] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load user profile on mount
  useEffect(() => {
    // Check authentication
    const user = getCurrentUser();
    const token = localStorage.getItem('auth_token');
    
    if (!user || !token) {
      navigate('/');
      return;
    }

    // Only load profile if we have valid auth
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Make API call with explicit error handling to prevent auto-redirect
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error(t.noAuthToken);
        navigate('/');
        return;
      }

      const response = await userAPI.getProfile();
      if (response.success) {
        const data = response.data;
        setProfile(data);
        setUsername(data.username || '');
        setRole(data.role || '');
        setDepartment(data.department || '');
        setEmail(data.email || '');
        setEmailVerified(data.emailVerified || false);
        const profilePic = data.profilePicture || null;
        setProfilePicture(profilePic);
        setProfilePicturePreview(profilePic);
        setOriginalProfilePicture(profilePic);
        if (data.preferences) {
          setPreferences(data.preferences);
          // Handle theme for dark mode
          const userTheme = data.preferences.theme || 'light';
          setIsDarkMode(userTheme === 'dark');
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      console.error('Error details:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        data: error.response?.data
      });
      
      // Check if it's a 401 and prevent the automatic redirect from interceptor
      // by handling it ourselves
      if (error.response?.status === 401) {
        // Clear storage and show error
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        toast.error(t.sessionExpired);
        // Use setTimeout to delay redirect after toast
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        // Service is not running
        toast.error(t.serviceUnavailable);
      } else {
        // Other errors
        toast.error(error.response?.data?.message || t.failedToLoadProfile);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    try {
      const response = await userAPI.updateUsername(username);
      if (response.success) {
        toast.success(t.usernameUpdated);
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.failedToUpdateUsername);
    }
  };

  const handleUpdateDepartment = async () => {
    try {
      const response = await userAPI.updateDepartment(department);
      if (response.success) {
        toast.success(t.departmentUpdated);
        // Update local storage
        const user = getCurrentUser();
        if (user) {
          user.department = department;
          localStorage.setItem('user', JSON.stringify(user));
        }
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.failedToUpdateDepartment);
    }
  };

  const handlePasswordChange = async () => {
    // Validate
    const errors = {};
    
    if (!passwordData.currentPassword) {
      errors.currentPassword = t.currentPasswordRequired;
    }
    
    if (!passwordData.newPassword) {
      errors.newPassword = t.newPasswordRequired;
    } else {
      const passwordValidation = validatePassword(passwordData.newPassword);
      if (!passwordValidation.valid) {
        errors.newPassword = passwordValidation.message;
      }
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = t.passwordsDoNotMatch;
    }
    
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    
    try {
      const response = await userAPI.updatePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      if (response.success) {
        toast.success(t.passwordUpdated);
        setShowPasswordForm(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setPasswordErrors({});
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.failedToUpdatePassword);
    }
  };

  const handleUpdatePreferences = async () => {
    try {
      const response = await userAPI.updatePreferences(preferences);
      if (response.success) {
        toast.success(t.preferencesUpdated);
        // Update dark mode immediately
        const userTheme = preferences.theme;
        setIsDarkMode(userTheme === 'dark');
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.failedToUpdatePreferences);
    }
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(t.pleaseSelectImageFile);
        return;
      }

      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error(t.imageSizeTooLarge);
        return;
      }

      // Read file as base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setProfilePicturePreview(base64String);
        // Don't set profilePicture until Save is clicked
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfilePicture = async () => {
    try {
      // Use the preview value for saving
      const response = await userAPI.updateProfilePicture(profilePicturePreview);
      if (response.success) {
        toast.success(t.profilePictureUpdated);
        setProfilePicture(profilePicturePreview);
        setOriginalProfilePicture(profilePicturePreview);
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.failedToUpdateProfilePicture);
    }
  };

  const handleDeleteProfilePicture = async () => {
    try {
      const response = await userAPI.deleteProfilePicture();
      if (response.success) {
        toast.success(t.profilePictureDeleted);
        setProfilePicture(null);
        setProfilePicturePreview(null);
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.failedToDeleteProfilePicture);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await userAPI.deleteAccount();
      if (response.success) {
        toast.success(t.accountDeleted);
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.failedToDeleteAccount);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminEmail || !adminEmail.trim()) {
      toast.error(t.pleaseEnterEmail);
      return;
    }

    try {
      setIsAddingAdmin(true);
      const response = await userAPI.addAdmin(adminEmail.trim());
      if (response.success) {
        const successMessage = response.message || t.userPromoted.replace('{email}', adminEmail);
        toast.success(successMessage);
        setAdminEmail('');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.failedToPromoteUser);
    } finally {
      setIsAddingAdmin(false);
    }
  };

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'Admin';

  // Get language from preferences or default to English
  const language = preferences.language || 'en';

  // Translations
  const translations = {
    en: {
      loadingProfile: 'Loading profile...',
      backToChat: '← Back to Chat',
      userProfile: 'User Profile',
      manageAccountSettings: 'Manage your account settings',
      profileInformation: 'Profile Information',
      profilePicture: 'Profile Picture',
      changePicture: 'Change Picture',
      uploadPicture: 'Upload Picture',
      save: 'Save',
      delete: 'Delete',
      profilePictureHint: 'Recommended: Square image, max 2MB. Supported formats: JPG, PNG, GIF',
      email: 'Email',
      verified: 'Verified',
      notVerified: 'Not verified',
      username: 'Username (Display Name)',
      enterUsername: 'Enter username',
      role: 'Role',
      department: 'Department',
      enterDepartmentName: 'Enter department name',
      update: 'Update',
      password: 'Password',
      changePassword: 'Change Password',
      cancel: 'Cancel',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmNewPassword: 'Confirm New Password',
      updatePassword: 'Update Password',
      currentPasswordRequired: 'Current password is required',
      newPasswordRequired: 'New password is required',
      passwordsDoNotMatch: 'Passwords do not match',
      preferences: 'Preferences',
      theme: 'Theme',
      language: 'Language',
      savePreferences: 'Save Preferences',
      addAdmins: 'Add Admins',
      addAdminsDescription: 'Promote Staff users to Admin by entering their email address. Only users with the \'Staff\' role can be promoted.',
      userEmail: 'User Email',
      enterUserEmail: 'Enter user email address',
      promoteToAdmin: 'Promote to Admin',
      promoting: 'Promoting...',
      adminOnly: 'Admin Only',
      dangerZone: 'Danger Zone',
      deleteAccountWarning: 'Once you delete your account, there is no going back. Please be certain.',
      deleteAccount: 'Delete Account',
      deleteAccountConfirm: 'Are you sure you want to delete your account? This action cannot be undone.',
      yesDeleteAccount: 'Yes, Delete My Account',
      usernameUpdated: 'Username updated successfully',
      departmentUpdated: 'Department updated successfully',
      passwordUpdated: 'Password updated successfully',
      preferencesUpdated: 'Preferences updated successfully',
      profilePictureUpdated: 'Profile picture updated successfully',
      profilePictureDeleted: 'Profile picture deleted successfully',
      accountDeleted: 'Account deleted successfully',
      pleaseEnterEmail: 'Please enter an email address',
      userPromoted: 'User with email {email} has been promoted to Admin successfully',
      failedToUpdateUsername: 'Failed to update username',
      failedToUpdateDepartment: 'Failed to update department',
      failedToUpdatePassword: 'Failed to update password',
      failedToUpdatePreferences: 'Failed to update preferences',
      failedToUpdateProfilePicture: 'Failed to update profile picture',
      failedToDeleteProfilePicture: 'Failed to delete profile picture',
      failedToDeleteAccount: 'Failed to delete account',
      failedToPromoteUser: 'Failed to promote user to admin',
      pleaseSelectImageFile: 'Please select an image file',
      imageSizeTooLarge: 'Image size must be less than 2MB',
      noAuthToken: 'No authentication token found. Please log in again.',
      sessionExpired: 'Session expired. Please log in again.',
      serviceUnavailable: 'User service is not available. Please check if the service is running.',
      failedToLoadProfile: 'Failed to load profile information. Please try again.'
    },
    de: {
      loadingProfile: 'Profil wird geladen...',
      backToChat: '← Zurück zum Chat',
      userProfile: 'Benutzerprofil',
      manageAccountSettings: 'Verwalten Sie Ihre Kontoeinstellungen',
      profileInformation: 'Profilinformationen',
      profilePicture: 'Profilbild',
      changePicture: 'Bild ändern',
      uploadPicture: 'Bild hochladen',
      save: 'Speichern',
      delete: 'Löschen',
      profilePictureHint: 'Empfohlen: Quadratisches Bild, max. 2MB. Unterstützte Formate: JPG, PNG, GIF',
      email: 'E-Mail',
      verified: 'Verifiziert',
      notVerified: 'Nicht verifiziert',
      username: 'Benutzername (Anzeigename)',
      enterUsername: 'Benutzernamen eingeben',
      role: 'Rolle',
      department: 'Abteilung',
      enterDepartmentName: 'Abteilungsname eingeben',
      update: 'Aktualisieren',
      password: 'Passwort',
      changePassword: 'Passwort ändern',
      cancel: 'Abbrechen',
      currentPassword: 'Aktuelles Passwort',
      newPassword: 'Neues Passwort',
      confirmNewPassword: 'Neues Passwort bestätigen',
      updatePassword: 'Passwort aktualisieren',
      currentPasswordRequired: 'Aktuelles Passwort ist erforderlich',
      newPasswordRequired: 'Neues Passwort ist erforderlich',
      passwordsDoNotMatch: 'Passwörter stimmen nicht überein',
      preferences: 'Einstellungen',
      theme: 'Design',
      language: 'Sprache',
      savePreferences: 'Einstellungen speichern',
      addAdmins: 'Administratoren hinzufügen',
      addAdminsDescription: 'Befördern Sie Mitarbeiter zu Administratoren, indem Sie deren E-Mail-Adresse eingeben. Nur Benutzer mit der Rolle \'Mitarbeiter\' können befördert werden.',
      userEmail: 'Benutzer-E-Mail',
      enterUserEmail: 'E-Mail-Adresse des Benutzers eingeben',
      promoteToAdmin: 'Zu Administrator befördern',
      promoting: 'Befördere...',
      adminOnly: 'Nur für Administratoren',
      dangerZone: 'Gefahrenzone',
      deleteAccountWarning: 'Sobald Sie Ihr Konto löschen, gibt es kein Zurück mehr. Bitte seien Sie sich sicher.',
      deleteAccount: 'Konto löschen',
      deleteAccountConfirm: 'Sind Sie sicher, dass Sie Ihr Konto löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.',
      yesDeleteAccount: 'Ja, mein Konto löschen',
      usernameUpdated: 'Benutzername erfolgreich aktualisiert',
      departmentUpdated: 'Abteilung erfolgreich aktualisiert',
      passwordUpdated: 'Passwort erfolgreich aktualisiert',
      preferencesUpdated: 'Einstellungen erfolgreich aktualisiert',
      profilePictureUpdated: 'Profilbild erfolgreich aktualisiert',
      profilePictureDeleted: 'Profilbild erfolgreich gelöscht',
      accountDeleted: 'Konto erfolgreich gelöscht',
      pleaseEnterEmail: 'Bitte geben Sie eine E-Mail-Adresse ein',
      userPromoted: 'Benutzer mit E-Mail {email} wurde erfolgreich zu Administrator befördert',
      failedToUpdateUsername: 'Benutzername konnte nicht aktualisiert werden',
      failedToUpdateDepartment: 'Abteilung konnte nicht aktualisiert werden',
      failedToUpdatePassword: 'Passwort konnte nicht aktualisiert werden',
      failedToUpdatePreferences: 'Einstellungen konnten nicht aktualisiert werden',
      failedToUpdateProfilePicture: 'Profilbild konnte nicht aktualisiert werden',
      failedToDeleteProfilePicture: 'Profilbild konnte nicht gelöscht werden',
      failedToDeleteAccount: 'Konto konnte nicht gelöscht werden',
      failedToPromoteUser: 'Benutzer konnte nicht zu Administrator befördert werden',
      pleaseSelectImageFile: 'Bitte wählen Sie eine Bilddatei aus',
      imageSizeTooLarge: 'Bildgröße muss weniger als 2MB betragen',
      noAuthToken: 'Kein Authentifizierungstoken gefunden. Bitte melden Sie sich erneut an.',
      sessionExpired: 'Sitzung abgelaufen. Bitte melden Sie sich erneut an.',
      serviceUnavailable: 'Benutzerservice ist nicht verfügbar. Bitte überprüfen Sie, ob der Service läuft.',
      failedToLoadProfile: 'Profilinformationen konnten nicht geladen werden. Bitte versuchen Sie es erneut.'
    }
  };

  const t = translations[language] || translations.en;

  return (
    <div className={`min-h-screen py-8 ${isDarkMode ? 'bg-[#212121]' : 'bg-gray-50'}`}>
      {/* Add the header at the top */}
      <Header role={role} isDarkMode={isDarkMode} language={language} />

      <div className="max-w-4xl mx-auto px-4 pt-10">
        {/* Header section: remove the back to chat button */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t.userProfile}</h1>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.manageAccountSettings}</p>
        </div>

        {/* Profile Information Section */}
        <div className={`rounded-lg shadow-md p-6 mb-6 ${isDarkMode ? 'bg-[#2f2f2f] border border-gray-700' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t.profileInformation}</h2>
          
          {/* Profile Picture */}
          <div className={`mb-6 pb-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.profilePicture}
            </label>
            <div className="flex items-center gap-6">
              {/* Profile Picture Preview */}
              <div className="flex-shrink-0">
                <div className={`w-24 h-24 rounded-full overflow-hidden border-2 flex items-center justify-center ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600' : 'bg-gray-200 border-gray-300'}`}>
                  {profilePicturePreview ? (
                    <img 
                      src={profilePicturePreview} 
                      alt="Profile preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400 text-2xl">👤</span>
                  )}
                </div>
              </div>

              {/* Upload Controls */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex gap-2">
                  <label className="px-3 py-1.5 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors cursor-pointer inline-block">
                    {profilePicturePreview ? t.changePicture : t.uploadPicture}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                    />
                  </label>
                  {profilePicturePreview && (
                    <>
                      <button
                        onClick={handleUpdateProfilePicture}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                      >
                        {t.save}
                      </button>
                      <button
                        onClick={handleDeleteProfilePicture}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                      >
                        {t.delete}
                      </button>
                    </>
                  )}
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t.profilePictureHint}
                </p>
              </div>
            </div>
          </div>

          {/* Email (Read-only) */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.email}
            </label>
            <input
              type="email"
              value={email}
              disabled
              className={`w-full px-4 py-2 border rounded-lg cursor-not-allowed ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-400' : 'border-gray-300 bg-gray-50 text-gray-600'}`}
            />
            {emailVerified ? (
              <span className="text-sm text-green-600 mt-1 inline-block">✓ {t.verified}</span>
            ) : (
              <span className="text-sm text-orange-600 mt-1 inline-block">⚠ {t.notVerified}</span>
            )}
          </div>

          {/* Username */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.username}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.enterUsername}
                maxLength={50}
                className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
              />
              <button
                onClick={handleUpdateUsername}
                className="px-4 py-2 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors whitespace-nowrap"
              >
                {t.update}
              </button>
            </div>
          </div>

          {/* Role (Read-only) */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.role}
            </label>
            <input
              type="text"
              value={role}
              disabled
              className={`w-full px-4 py-2 border rounded-lg cursor-not-allowed ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-400' : 'border-gray-300 bg-gray-50 text-gray-600'}`}
            />
          </div>

          {/* Department */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t.department}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder={t.enterDepartmentName}
                className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
              />
              <button
                onClick={handleUpdateDepartment}
                className="px-4 py-2 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors whitespace-nowrap"
              >
                {t.update}
              </button>
            </div>
          </div>
        </div>

        {/* Password Change Section */}
        <div className={`rounded-lg shadow-md p-6 mb-6 ${isDarkMode ? 'bg-[#2f2f2f] border border-gray-700' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t.password}</h2>
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="px-4 py-1.5 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors"
            >
              {showPasswordForm ? t.cancel : t.changePassword}
            </button>
          </div>
          
          {showPasswordForm && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.currentPassword}
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
                />
                {passwordErrors.currentPassword && (
                  <span className="text-sm text-red-600 mt-1">{passwordErrors.currentPassword}</span>
                )}
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.newPassword}
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
                />
                {passwordErrors.newPassword && (
                  <span className="text-sm text-red-600 mt-1">{passwordErrors.newPassword}</span>
                )}
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.confirmNewPassword}
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
                />
                {passwordErrors.confirmPassword && (
                  <span className="text-sm text-red-600 mt-1">{passwordErrors.confirmPassword}</span>
                )}
              </div>
              
              <button
                onClick={handlePasswordChange}
                className="px-4 py-1.5 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors"
              >
                {t.updatePassword}
              </button>
            </div>
          )}
        </div>

        {/* Preferences Section */}
        <div className={`rounded-lg shadow-md p-6 mb-6 ${isDarkMode ? 'bg-[#2f2f2f] border border-gray-700' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t.preferences}</h2>
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t.theme}
              </label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t.language}
              </label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
              >
                <option value="en">English</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
            
            <button
              onClick={handleUpdatePreferences}
              className="px-4 py-1.5 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors"
            >
              {t.savePreferences}
            </button>
          </div>
        </div>

        {/* Add Admins Section */}
        <div className={`rounded-lg shadow-md p-6 mb-6 relative ${isDarkMode ? 'bg-[#2f2f2f] border border-gray-700' : 'bg-white'} ${!isAdmin ? 'opacity-50' : ''}`}>
          <div className={!isAdmin ? 'pointer-events-none' : ''}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {t.addAdmins}
            </h2>
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {t.addAdminsDescription}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.userEmail}
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder={t.enterUserEmail}
                  disabled={!isAdmin || isAddingAdmin}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${
                    isDarkMode 
                      ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' 
                      : 'border-gray-300'
                  } ${!isAdmin || isAddingAdmin ? 'cursor-not-allowed opacity-60' : ''}`}
                />
              </div>
              
              <button
                onClick={handleAddAdmin}
                disabled={!isAdmin || isAddingAdmin || !adminEmail.trim()}
                className={`px-4 py-2 text-sm rounded-xl transition-colors ${
                  isAdmin && !isAddingAdmin && adminEmail.trim()
                    ? 'bg-tum-blue text-white hover:bg-tum-dark-blue'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                {isAddingAdmin ? t.promoting : t.promoteToAdmin}
              </button>
            </div>
          </div>
          
          {!isAdmin && (
            <div className={`absolute inset-0 flex items-center justify-center ${isDarkMode ? 'bg-[#2f2f2f]/80' : 'bg-white/80'} rounded-lg`}>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {t.adminOnly}
              </p>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className={`rounded-lg shadow-md p-6 border-2 ${isDarkMode ? 'bg-[#2f2f2f] border-red-800' : 'bg-white border-red-200'}`}>
          <h2 className="text-xl font-semibold text-red-600 mb-4">{t.dangerZone}</h2>
          
          {!showDeleteConfirm ? (
            <div>
              <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {t.deleteAccountWarning}
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                {t.deleteAccount}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-red-600 font-semibold mb-4">
                {t.deleteAccountConfirm}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  {t.yesDeleteAccount}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
