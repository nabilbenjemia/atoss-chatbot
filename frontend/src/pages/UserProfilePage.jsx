import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { userAPI, getCurrentUser } from '../services/api';
import { validatePassword } from '../utils/validation';

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
        toast.error('No authentication token found. Please log in again.');
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
        toast.error('Session expired. Please log in again.');
        // Use setTimeout to delay redirect after toast
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        // Service is not running
        toast.error('User service is not available. Please check if the service is running.');
      } else {
        // Other errors
        toast.error(error.response?.data?.message || 'Failed to load profile information. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    try {
      const response = await userAPI.updateUsername(username);
      if (response.success) {
        toast.success('Username updated successfully');
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update username');
    }
  };

  const handleUpdateRole = async () => {
    try {
      const response = await userAPI.updateRole(role);
      if (response.success) {
        toast.success('Role updated successfully');
        // Update local storage
        const user = getCurrentUser();
        if (user) {
          user.role = role;
          localStorage.setItem('user', JSON.stringify(user));
        }
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role');
    }
  };

  const handleUpdateDepartment = async () => {
    try {
      const response = await userAPI.updateDepartment(department);
      if (response.success) {
        toast.success('Department updated successfully');
        // Update local storage
        const user = getCurrentUser();
        if (user) {
          user.department = department;
          localStorage.setItem('user', JSON.stringify(user));
        }
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update department');
    }
  };

  const handlePasswordChange = async () => {
    // Validate
    const errors = {};
    
    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    
    if (!passwordData.newPassword) {
      errors.newPassword = 'New password is required';
    } else {
      const passwordValidation = validatePassword(passwordData.newPassword);
      if (!passwordValidation.valid) {
        errors.newPassword = passwordValidation.message;
      }
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
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
        toast.success('Password updated successfully');
        setShowPasswordForm(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setPasswordErrors({});
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    }
  };

  const handleUpdatePreferences = async () => {
    try {
      const response = await userAPI.updatePreferences(preferences);
      if (response.success) {
        toast.success('Preferences updated successfully');
        // Update dark mode immediately
        const userTheme = preferences.theme;
        setIsDarkMode(userTheme === 'dark');
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    }
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be less than 2MB');
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
        toast.success('Profile picture updated successfully');
        setProfilePicture(profilePicturePreview);
        setOriginalProfilePicture(profilePicturePreview);
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile picture');
    }
  };

  const handleDeleteProfilePicture = async () => {
    try {
      const response = await userAPI.deleteProfilePicture();
      if (response.success) {
        toast.success('Profile picture deleted successfully');
        setProfilePicture(null);
        setProfilePicturePreview(null);
        loadProfile();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete profile picture');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await userAPI.deleteAccount();
      if (response.success) {
        toast.success('Account deleted successfully');
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete account');
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-screen ${isDarkMode ? 'bg-[#212121]' : 'bg-gray-50'}`}>
        <div className="text-lg text-gray-600">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-8 ${isDarkMode ? 'bg-[#212121]' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/chatbot')}
            className="px-4 py-2 bg-tum-blue text-white rounded-lg hover:bg-tum-dark-blue transition-colors mb-4 inline-flex items-center"
          >
            ← Back to Chat
          </button>
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>User Profile</h1>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Manage your account settings</p>
        </div>

        {/* Profile Information Section */}
        <div className={`rounded-lg shadow-md p-6 mb-6 ${isDarkMode ? 'bg-[#2f2f2f] border border-gray-700' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Profile Information</h2>
          
          {/* Profile Picture */}
          <div className={`mb-6 pb-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Profile Picture
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
                    {profilePicturePreview ? 'Change Picture' : 'Upload Picture'}
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
                        Save
                      </button>
                      <button
                        onClick={handleDeleteProfilePicture}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Recommended: Square image, max 2MB. Supported formats: JPG, PNG, GIF
                </p>
              </div>
            </div>
          </div>

          {/* Email (Read-only) */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className={`w-full px-4 py-2 border rounded-lg cursor-not-allowed ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-400' : 'border-gray-300 bg-gray-50 text-gray-600'}`}
            />
            {emailVerified ? (
              <span className="text-sm text-green-600 mt-1 inline-block">✓ Verified</span>
            ) : (
              <span className="text-sm text-orange-600 mt-1 inline-block">⚠ Not verified</span>
            )}
          </div>

          {/* Username */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Username (Display Name)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                maxLength={50}
                className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
              />
              <button
                onClick={handleUpdateUsername}
                className="px-4 py-2 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors whitespace-nowrap"
              >
                Update
              </button>
            </div>
          </div>

          {/* Role */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Role
            </label>
            <div className="flex gap-2 items-center">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
              >
                <option value="Staff">Staff</option>
                <option value="Admin">Admin</option>
              </select>
              <button
                onClick={handleUpdateRole}
                className="px-4 py-2 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors whitespace-nowrap"
              >
                Update
              </button>
            </div>
          </div>

          {/* Department */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Department
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Enter department name"
                className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tum-blue ${isDarkMode ? 'bg-[#1f1f1f] border-gray-600 text-gray-200' : 'border-gray-300'}`}
              />
              <button
                onClick={handleUpdateDepartment}
                className="px-4 py-2 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors whitespace-nowrap"
              >
                Update
              </button>
            </div>
          </div>
        </div>

        {/* Password Change Section */}
        <div className={`rounded-lg shadow-md p-6 mb-6 ${isDarkMode ? 'bg-[#2f2f2f] border border-gray-700' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Password</h2>
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="px-4 py-1.5 text-sm bg-tum-blue text-white rounded-xl hover:bg-tum-dark-blue transition-colors"
            >
              {showPasswordForm ? 'Cancel' : 'Change Password'}
            </button>
          </div>
          
          {showPasswordForm && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Current Password
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
                  New Password
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
                  Confirm New Password
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
                Update Password
              </button>
            </div>
          )}
        </div>

        {/* Preferences Section */}
        <div className={`rounded-lg shadow-md p-6 mb-6 ${isDarkMode ? 'bg-[#2f2f2f] border border-gray-700' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Preferences</h2>
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Theme
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
                Language
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
              Save Preferences
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className={`rounded-lg shadow-md p-6 border-2 ${isDarkMode ? 'bg-[#2f2f2f] border-red-800' : 'bg-white border-red-200'}`}>
          <h2 className="text-xl font-semibold text-red-600 mb-4">Danger Zone</h2>
          
          {!showDeleteConfirm ? (
            <div>
              <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                Delete Account
              </button>
            </div>
          ) : (
            <div>
              <p className="text-red-600 font-semibold mb-4">
                Are you sure you want to delete your account? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Delete My Account
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
