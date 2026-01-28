/**
 * Ingestion Components Index
 * 
 * Central export for all ingestion-related components.
 * 
 * Components are organized into two categories:
 * 1. Connected Components (prefixed with Connected*) - Use context hooks directly
 * 2. Pure UI Components - Receive props, no context dependency
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

// Constants (deprecated - use from context/ingestion instead)
export { DOC_STATUS, CONTENT_TYPE } from './constants';

// ===== Connected Components =====
// These components use context hooks directly and own their business logic
export { default as ConnectedFileQueue } from './ConnectedFileQueue';
export { default as ConnectedUploadZone } from './ConnectedUploadZone';
export { default as ConnectedContentViewer } from './ConnectedContentViewer';
export { default as ConnectedHelperPanel } from './ConnectedHelperPanel';

// ===== Pure UI Components =====
// These components receive props and have no context dependency

// File Management
export { default as UploadZone } from './UploadZone';
export { default as FileQueue } from './FileQueue';
export { default as FileQueueItem } from './FileQueueItem';

// Content Display
export { default as PageNavigation } from './PageNavigation';
export { default as PageContent } from './PageContent';
export { default as ContentViewer } from './ContentViewer';
export { default as TextItem } from './TextItem';
export { default as ImageItem } from './ImageItem';
export { default as TableItem } from './TableItem';

// Helper Panel
export { default as HelperPanel } from './HelperPanel';

// Modals
export { default as IngestionModal } from './IngestionModal';
export { default as RegexInputModal } from './RegexInputModal';
export { default as HelperFileSelectModal } from './HelperFileSelectModal';

// Utility Components
export { default as SaveBar } from './SaveBar';
export { default as EmbeddingPreview } from './EmbeddingPreview';
export { default as EmbeddingPreviewViewer } from './EmbeddingPreviewViewer';
export { default as CacheManagement } from './CacheManagement';
