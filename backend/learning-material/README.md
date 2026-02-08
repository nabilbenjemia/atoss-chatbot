# ATOSS.GPT - Learning Material Microservice

This document describes the Learning Material Microservice implementation for the ATOSS.GPT project.

## Overview

The Learning Material Microservice handles:
- **Video Tutorial Management**: Upload, storage, and organization of educational videos
- **File Processing**: Automatic thumbnail generation and video metadata extraction
- **Content Categorization**: Organize videos by ATOSS system categories
- **Search & Discovery**: Filter and search videos by category, tags, and metadata
- **View Analytics**: Track video engagement and popularity

## Architecture

The service operates as a standalone microservice that:
- Handles video file uploads with multer middleware
- Processes video files using ffmpeg for thumbnails and metadata
- Stores video metadata and file references in MongoDB
- Serves static video and thumbnail files
- Provides RESTful API for video management

## Project Structure

```
backend/learning-material/
├── config/
│   └── database.js          # MongoDB connection configuration
├── controllers/
│   └── videoController.js   # HTTP handlers for video operations
├── models/
│   └── Video.js            # Video data schema
├── routes/
│   └── videoRoutes.js      # Video API routes
├── services/
│   └── videoService.js     # Video business logic
├── uploads/
│   ├── videos/             # Uploaded video files storage
│   └── thumbnails/         # Generated thumbnail storage
└── index.js               # Main application entry point
```

## Features

### Video Management
- Upload videos in multiple formats (mp4, avi, mov, wmv, flv, mkv)
- Automatic video duration extraction using ffmpeg
- Custom thumbnail upload or automatic generation
- Video metadata management (title, description, category, tags)
- Video deletion with file cleanup

### File Processing
- **Automatic Thumbnails**: Generate thumbnails at 2-second mark
- **Duration Detection**: Extract video length automatically
- **File Validation**: Support for multiple video formats and MIME types
- **Static File Serving**: Direct access to video and thumbnail files

### Content Organization
- **Categories**: Organize videos by ATOSS system areas:
  - **Technisch**: Technical tutorials and troubleshooting
  - **Anwendung**: Application usage and workflows
  - **Zeitwirtschaft/Abrechnung**: Time tracking and payroll guides
  - **Dienstplanung**: Scheduling and planning tutorials
  - **Benutzer & Rollen**: User management and permissions
  - **Prozessfragen**: Process and workflow guidance
  - **Schulung/Doku**: Training materials and documentation
- **Tags**: Flexible tagging system for detailed organization
- **Search & Filter**: Find videos by category, tags, or text search

### Analytics
- **View Tracking**: Monitor video popularity and engagement
- **Usage Statistics**: Track which content is most valuable

## Environment Configuration

Create a `.env` file in the `backend/learning-material` directory with the following variables:

```env
# Server Configuration
PORT=4005
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/atoss_gpt_learning

# CORS Configuration
FRONTEND_URL=http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=500MB
UPLOAD_PATH=./uploads
```

## Installation & Setup

### Prerequisites
- **Node.js** (v14 or higher)
- **MongoDB** (running instance)
- **FFmpeg** (required for video processing)

### FFmpeg Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH.

### Service Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   - Copy `.env.example` to `.env`
   - Update configuration values

3. **Create Upload Directories**:
   ```bash
   mkdir -p uploads/videos uploads/thumbnails
   ```

4. **Start the Service**:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## API Endpoints

### Video Management

#### GET `/api/videos`
Get all videos with optional filtering.

**Query Parameters:**
- `category`: Filter by video category
- `search`: Search in title and description

**Response:**
```json
[
  {
    "_id": "video123",
    "title": "ATOSS Time Tracking Setup",
    "description": "Learn how to configure time tracking",
    "url": "/uploads/videos/video-file.mp4",
    "thumbnail": "/uploads/thumbnails/thumb.jpg",
    "duration": 300,
    "category": "Anwendung",
    "tags": ["time tracking", "setup"],
    "views": 42,
    "createdAt": "2024-01-01T10:00:00Z"
  }
]
```

#### POST `/api/videos`
Upload a new video.

**Request:** Multipart form data
- `video`: Video file (required)
- `title`: Video title (required)
- `description`: Video description
- `category`: Video category
- `tags`: Comma-separated tags
- `uploadedBy`: User ID who uploaded

#### GET `/api/videos/:id`
Get a specific video by ID.

#### PUT `/api/videos/:id`
Update video metadata.

**Request:** Multipart form data (optional thumbnail file)
- `title`: Updated title
- `description`: Updated description
- `category`: Updated category
- `tags`: Updated tags
- `thumbnail`: Custom thumbnail file (optional)

#### DELETE `/api/videos/:id`
Delete a video and associated files.

#### POST `/api/videos/:id/view`
Increment video view count.

### Static File Access

#### GET `/uploads/videos/:filename`
Access video files directly.

#### GET `/uploads/thumbnails/:filename`
Access thumbnail images directly.

## Data Models

### Video
```javascript
{
  title: String,           // Video title (required)
  description: String,     // Video description
  url: String,            // Path to video file (required)
  duration: Number,       // Video duration in seconds
  thumbnail: String,      // Path to thumbnail image
  category: String,       // Video category (enum)
  tags: [String],        // Array of tags
  views: Number,         // View count (default: 0)
  uploadedBy: ObjectId,  // User who uploaded (optional)
  createdAt: Date,       // Upload timestamp
  updatedAt: Date        // Last update timestamp
}
```

### Supported Categories
- `Technisch`: Technical tutorials and troubleshooting
- `Anwendung`: Application usage and workflows  
- `Zeitwirtschaft/Abrechnung`: Time tracking and payroll
- `Dienstplanung`: Scheduling and planning
- `Benutzer & Rollen`: User management and permissions
- `Prozessfragen`: Process and workflow guidance
- `Schulung/Doku`: Training materials and documentation

## File Processing

### Video Upload Process
1. **File Validation**: Check format, size, and MIME type
2. **File Storage**: Save to `uploads/videos/` with unique filename
3. **Duration Extraction**: Use ffmpeg to get video length
4. **Thumbnail Generation**: Create thumbnail at 2-second mark
5. **Database Storage**: Save metadata and file references
6. **Cleanup**: Remove files if database operation fails

### Supported Formats
- **Video**: mp4, avi, mov, wmv, flv, mkv
- **Thumbnails**: jpg, jpeg, png
- **Size Limit**: 500MB per video file

### Thumbnail Generation
- **Automatic**: Generated at 2-second mark using ffmpeg
- **Size**: 320x240 pixels
- **Format**: JPEG
- **Custom**: Users can upload custom thumbnails

## Development

### Running in Development Mode
```bash
npm run dev
```

This enables:
- Automatic server restart on file changes
- Detailed request and file processing logging
- Error stack traces

### Docker Support
```bash
# Build image (includes FFmpeg)
docker build -t atoss-gpt-learning .

# Run container
docker run -p 4005:4005 -v $(pwd)/uploads:/app/uploads atoss-gpt-learning
```

### Health Check
```bash
curl http://localhost:4005/health
```

## Troubleshooting

### Common Issues

1. **FFmpeg Not Found**:
   - Install FFmpeg on your system
   - Ensure FFmpeg is in system PATH
   - Verify installation: `ffmpeg -version`

2. **Video Upload Failures**:
   - Check file size limits (500MB default)
   - Verify supported video formats
   - Ensure upload directories exist and are writable

3. **Thumbnail Generation Issues**:
   - Verify FFmpeg installation and permissions
   - Check video file integrity
   - Ensure sufficient disk space

4. **File Access Problems**:
   - Verify static file middleware configuration
   - Check file permissions in uploads directory
   - Ensure files exist at specified paths

5. **Database Connection Issues**:
   - Verify MongoDB is running
   - Check MONGODB_URI in `.env`
   - Ensure database permissions are correct

### Storage Considerations

- **Disk Space**: Monitor upload directory size
- **Backup**: Regular backup of uploads directory
- **Cleanup**: Remove orphaned files when videos are deleted
- **Performance**: Consider CDN for large-scale deployments

### Dependencies

This service requires:
- **MongoDB**: For video metadata storage
- **FFmpeg**: For video processing and thumbnail generation
- **File System**: Writable access to uploads directory
- **Authentication Service**: For user validation (via API Gateway)

## License

This project is part of the ATOSS.GPT system for TUM Universitäts Klinikum.