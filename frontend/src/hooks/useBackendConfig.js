/**
 * useBackendConfig Hook
 * 
 * Fetches and caches dynamic configuration from the backend.
 * Returns available vector DBs, image classes, embedding models, etc.
 * 
 * @example
 * const { config, loading, error, refetch } = useBackendConfig();
 * 
 * // Access config data
 * config.availableTargetDbs
 * config.availableImageClasses
 * config.embeddingModels
 */

import { useState, useEffect, useCallback } from 'react';
import { getBackendConfig } from '../services/ingestionApi';

/**
 * Custom hook for fetching backend configuration
 * 
 * @returns {Object} - { config, loading, error, refetch }
 */
const useBackendConfig = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Fetch configuration from backend
     */
    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await getBackendConfig();
            setConfig(data);
        } catch (err) {
            console.error('Failed to fetch backend config:', err);
            setError(err.message || 'Failed to load configuration');
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch on mount
    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    /**
     * Manually refetch configuration
     */
    const refetch = useCallback(() => {
        return fetchConfig();
    }, [fetchConfig]);

    return {
        config,
        loading,
        error,
        refetch,
    };
};

export default useBackendConfig;
