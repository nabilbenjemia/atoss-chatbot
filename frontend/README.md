# Frontend

React single-page application for ATOSS GPT — a conversational AI assistant with document ingestion, analytics, and learning materials.

## Tech Stack

- **React** 19 with Vite 7
- **React Router** 6 for client-side routing
- **Tailwind CSS** 3 with custom TUM brand colors
- **Axios** for API communication
- **Plotly.js** for analytics visualizations
- **React Markdown** for AI response rendering

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

The app runs at `http://localhost:5173`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:4003` | General API base (chat, analytics) |
| `VITE_AUTH_LOGIN_URL` | `http://localhost:4003` | Authentication service |
| `VITE_USER_SERVICE_URL` | `http://localhost:4001` | User profile service |
| `VITE_CONVERSATION_URL` | `http://localhost:4004` | Chat history and streaming |
| `VITE_INGESTION_URL` | `http://localhost:4006` | Document processing service |
| `VITE_LLM_URL` | `http://localhost:8000` | LLM inference service |
| `VITE_LEARNING_API_URL` | `http://localhost:4005` | Video/learning materials service |

## Pages & Routes

### Public

| Route | Page | Description |
|-------|------|-------------|
| `/` | LoginPage | Email/password authentication |
| `/register` | RegisterPage | User registration with role and department |
| `/forget-password` | ForgetPass | Password reset flow |
| `/verify-email` | VerifyEmailPage | Email verification |

### Protected (authenticated)

| Route | Page | Description |
|-------|------|-------------|
| `/chatbot` | ChatbotPage | Main conversational AI interface with SSE streaming |
| `/learning` | LearningMaterialPage | Video library with search and categories |
| `/profile` | UserProfilePage | Profile management and preferences |

### Admin only

| Route | Page | Description |
|-------|------|-------------|
| `/analytics` | AnalyticsDashboard | Query analytics with Plotly visualizations and CSV export |
| `/admin/ingestion` | IngestionPage | Document ingestion workflow |

## Key Features

### Chat
- Real-time streaming responses via Server-Sent Events (SSE)
- Conversation history with sidebar navigation
- Markdown rendering with GitHub-flavored markdown support
- Stream interruption capability

### Document Ingestion (Admin)
- Multi-step workflow: Upload → Preview → Configure → Ingest
- PDF upload with Docling-based content extraction
- Page-level content viewing and editing with undo/redo (50-step history)
- Local strategies (per-page embedding, fixed-size chunking) and remote strategies (semantic chunking)
- AI-powered image description generation via vision model
- Image classification filtering (decorative vs content)
- Embedding preview before ingestion
- localStorage caching with duplicate detection

### Analytics (Admin)
- Query analytics with time-series charts
- LLM-powered keyword extraction and categorization
- Date range filtering and CSV download

### Authentication
- JWT token-based auth with refresh token support
- Role-based access control (Staff, Admin)
- Email verification flow
- Auto-logout on token expiry

### User Preferences
- Theme selection (light/dark/auto)
- Language support (English, German)
- Profile picture management

## State Management

The ingestion feature uses a split context architecture for optimized re-renders:

```
IngestionProvider (single reducer, multiple contexts)
├── FileQueueContext    # Upload queue, ingested files
├── DocumentContext     # Document state, pages, items
├── PreviewContext      # Embedding preview state
├── UIContext           # Modals, sidebars, modes
└── DispatchContext     # Stable dispatch function
```

Custom hooks: `useFileQueue()`, `useDocument()`, `usePreview()`, `useUI()`, `useDispatch()`

## Project Structure

```
frontend/
├── src/
│   ├── main.jsx                    # App entry point
│   ├── App.jsx                     # Route configuration
│   ├── index.css                   # Global styles
│   ├── pages/                      # Page components
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── VerifyEmailPage.jsx
│   │   ├── ForgetPass.jsx
│   │   ├── ChatbotPage.jsx
│   │   ├── LearningMaterialPage.jsx
│   │   ├── UserProfilePage.jsx
│   │   ├── IngestionPage.jsx
│   │   └── AnalyticsDashboard.jsx
│   ├── components/
│   │   ├── Header.jsx              # Top navigation
│   │   ├── Sidebar.jsx             # Conversation history
│   │   ├── MessageInput.jsx        # Chat input
│   │   ├── Conversation.jsx        # Message display
│   │   ├── AIMessage.jsx           # AI response rendering
│   │   ├── UserMessage.jsx         # User message rendering
│   │   ├── ProtectedRoute.jsx      # Auth guard
│   │   ├── AdminRoute.jsx          # Admin guard
│   │   ├── Video*.jsx              # Learning material components
│   │   └── ingestion/              # Ingestion components
│   │       ├── connected/          # Stateful components
│   │       ├── content/            # Pure UI components
│   │       └── modals/             # Modal dialogs
│   ├── services/                   # API clients
│   │   ├── api.js                  # Auth & user API
│   │   ├── ingestionApi.js         # Document processing API
│   │   └── learningApi.js          # Video API
│   ├── context/
│   │   └── ingestion/              # Split context state management
│   ├── hooks/                      # Custom hooks
│   │   ├── useBackendConfig.js
│   │   ├── useLocalCache.js
│   │   ├── useLocalStrategy.js
│   │   ├── useLocalHelper.js
│   │   ├── useCommandHistory.js
│   │   └── useUserPreferences.js
│   ├── config/
│   │   └── ingestionConfig.js      # Ingestion feature config
│   ├── utils/                      # Utilities
│   └── assets/                     # Static assets
├── public/                         # Static files
├── index.html                      # HTML entry point
├── vite.config.js                  # Vite config
├── tailwind.config.js              # Tailwind with TUM brand colors
├── eslint.config.js                # ESLint config
├── postcss.config.js               # PostCSS config
├── Dockerfile                      # Docker image
├── nginx.conf                      # Nginx reverse proxy
├── package.json                    # Dependencies
└── .env.example                    # Environment template
```

## Docker

```bash
docker build -t atoss-frontend .
docker run -p 80:80 atoss-frontend
```

Uses nginx to serve the built static files and proxy API requests.

## License

Internal use only - ATOSS Software AG
