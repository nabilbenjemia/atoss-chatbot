import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';

/**
 * Hook to load user preferences (theme, language) from profile.
 * @param {string|null} userId - Current user ID. If null, returns defaults.
 * @returns {{ theme: string, language: string, isDarkMode: boolean, loading: boolean }}
 */
export default function useUserPreferences(userId) {
    const [theme, setTheme] = useState('auto');
    const [language, setLanguage] = useState('en');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        const load = async () => {
            try {
                const response = await userAPI.getProfile();
                if (response.success && response.data.preferences) {
                    const prefs = response.data.preferences;
                    const userTheme = prefs.theme || 'auto';
                    if (userTheme === 'auto') {
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        setTheme(prefersDark ? 'dark' : 'light');
                    } else {
                        setTheme(userTheme);
                    }
                    setLanguage(prefs.language || 'en');
                }
            } catch (err) {
                console.error('Failed to load preferences:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [userId]);

    const isDarkMode = theme === 'dark';
    return { theme, language, isDarkMode, loading };
}
