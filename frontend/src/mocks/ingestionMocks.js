/**
 * Ingestion Mock Data
 * 
 * Mock data for development and testing.
 * TODO: Replace with real backend responses when available.
 */

// Mock backend configuration (fetched from /api/ingestion/config)
export const mockBackendConfig = {
    availableTargetDbs: [
        { id: 'chroma_default', label: 'ChromaDB (Default)' },
        { id: 'chroma_snowflake', label: 'ChromaDB (Snowflake Collection)' },
    ],
    availableImageClasses: [
        'logo',
        'figure',
        'chart',
        'diagram',
        'photo',
        'screenshot',
        'table_image',
        'other',
    ],
    embeddingModels: [
        { id: 'default', label: 'Snowflake Arctic Embed', disabled: false },
        { id: 'openai', label: 'OpenAI Ada-002', disabled: true }, // Future
    ],
};

// Mock extracted content (returned from /api/ingestion/{documentId}/content)
export const mockExtractedContent = {
    documentId: 'doc_123',
    filename: 'employee_handbook.pdf',
    totalPages: 3,
    pages: [
        {
            pageNumber: 1,
            items: [
                {
                    id: 't1',
                    type: 'text',
                    content: '# Chapter 1: Introduction\n\nThis document provides comprehensive guidance for employees at TUM Klinikum regarding the ATOSS Workforce Management System.',
                    deleted: false,
                },
                {
                    id: 'i1',
                    type: 'image',
                    imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjUwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiIGZpbGw9IiMwMDY1YmQiLz48dGV4dCB4PSI1MCIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkxPR088L3RleHQ+PC9zdmc+',
                    imageWidth: 100,
                    imageHeight: 50,
                    classification: 'logo',
                    deleted: false,
                },
                {
                    id: 't2',
                    type: 'text',
                    content: '## Overview\n\nThe **workforce management** system helps with:\n- Time tracking\n- Shift scheduling\n- Leave management\n- Compliance reporting',
                    deleted: false,
                },
            ],
        },
        {
            pageNumber: 2,
            items: [
                {
                    id: 't3',
                    type: 'text',
                    content: '### Section 1.1: Getting Started\n\nKey points to remember:\n- Always log in with your employee ID\n- Check your schedule daily\n- Report absences in advance',
                    deleted: false,
                },
                {
                    id: 'i2',
                    type: 'image',
                    imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2YwZjBmMCIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMwMDY1YmQiIHJ4PSI1Ii8+PHJlY3QgeD0iMzAwIiB5PSI1MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiM2NGEwZDAiIHJ4PSI1Ii8+PGxpbmUgeDE9IjE1MCIgeTE9IjE1MCIgeDI9IjQwMCIgeTI9IjEwMCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSIzMDAiIHk9IjI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Xb3JrZmxvdyBEaWFncmFtPC90ZXh0Pjwvc3ZnPg==',
                    imageWidth: 600,
                    imageHeight: 400,
                    classification: 'diagram',
                    deleted: false,
                },
                {
                    id: 'tb1',
                    type: 'table',
                    tableData: {
                        headers: ['Role', 'Access Level', 'Permissions'],
                        rows: [
                            ['Admin', 'Full', 'All features'],
                            ['Manager', 'Department', 'Team schedules, approvals'],
                            ['Employee', 'Personal', 'View schedule, request leave'],
                        ],
                    },
                    deleted: false,
                },
            ],
        },
        {
            pageNumber: 3,
            items: [
                {
                    id: 't4',
                    type: 'text',
                    content: '## Conclusion\n\nFor more information, contact the IT support team or visit the internal help portal.',
                    deleted: false,
                },
                {
                    id: 'i3',
                    type: 'image',
                    imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2ZmZiIvPjxsaW5lIHgxPSI1MCIgeTE9IjI1MCIgeDI9IjQ1MCIgeTI9IjI1MCIgc3Ryb2tlPSIjY2NjIi8+PGxpbmUgeDE9IjUwIiB5MT0iNTAiIHgyPSI1MCIgeTI9IjI1MCIgc3Ryb2tlPSIjY2NjIi8+PHBvbHlsaW5lIHBvaW50cz0iNTAsMjAwIDEyNSwxNTAgMjAwLDE4MCAyNzUsMTAwIDM1MCwxMjAgNDI1LDYwIiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDY1YmQiIHN0cm9rZS13aWR0aD0iMyIvPjx0ZXh0IHg9IjI1MCIgeT0iMjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMzMzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlBlcmZvcm1hbmNlIENoYXJ0PC90ZXh0Pjwvc3ZnPg==',
                    imageWidth: 500,
                    imageHeight: 300,
                    classification: 'chart',
                    deleted: false,
                },
                {
                    id: 't5',
                    type: 'text',
                    content: ' ',
                    deleted: false,
                }, // Empty text - for "Remove Empty" helper test
                {
                    id: 't6',
                    type: 'text',
                    content: '5',
                    deleted: false,
                }, // Single digit - for "Remove Empty" helper test
            ],
        },
    ],
};

// Generate a unique ID for new items
export const generateId = () => {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Mock delay helper
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock processing progress simulation
export const simulateProcessingProgress = async (onProgress) => {
    const steps = [10, 25, 45, 60, 75, 90, 100];
    for (const progress of steps) {
        await delay(500);
        onProgress(progress);
    }
};

// Mock user for development (bypassing auth)
export const mockCurrentUser = {
    id: 'dev_user_1',
    email: 'admin@tum.de',
    firstName: 'Dev',
    lastName: 'Admin',
    role: 'admin', // TODO: Remove mock when auth provides role
};

// Check if we should use mock user (development mode)
export const shouldUseMockAuth = () => {
    // In development, bypass auth for ingestion page
    return import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === 'true';
};
