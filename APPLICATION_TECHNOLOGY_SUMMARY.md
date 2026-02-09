# Application Technology Summary

## Technology Stack

### **Frontend**
- **Framework**: React 18.3.1
- **Build Tool**: Vite 6.0.11
- **State Management**: Zustand 5.0.3
- **Styling**: Tailwind CSS 3.4.17
- **UI Components**: Custom components with Lucide React icons
- **HTTP Client**: Axios 1.7.9
- **3D Rendering**: Three.js (react-three-fiber, react-three-drei)

### **Backend**
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js 4.21.2
- **CORS**: cors 2.8.5
- **File Upload**: multer 1.4.5-lts.1
- **Process Management**: child_process (native)
- **Environment**: dotenv 16.4.7

### **AI/ML**
- **LLM Provider**: Ollama (local)
- **Default Model**: qwen2.5:1.5b
- **Supported Models**: qwen2.5 series (1.5b, 7b, 14b), qwen3:30b
- **Speech-to-Text**: 
  - Frontend: Web Speech API (browser-native)
  - Backend: Whisper (OpenAI)
- **Text-to-Speech**: Web Speech API (browser-native)

### **External Integrations**
- **Version Control**: Perforce (P4)
- **Collaboration**: 
  - Slack API
  - Jira (Atlassian)
  - Confluence (Atlassian)
  - GitHub API
- **Productivity**:
  - Google Drive
  - Gmail
  - Google Calendar
- **Communication**:
  - Discord

---

## Architecture

### **Frontend Architecture**
```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── Header.jsx              # Top navigation
│   │   ├── LeftPanel.jsx           # Chat history, scratchpad
│   │   ├── CenterPanel.jsx         # Main chat interface
│   │   ├── RightPanel.jsx          # Agent section, recording
│   │   ├── SettingsModal.jsx       # Settings with tabs
│   │   └── RecordingSection.jsx    # Audio recording
│   ├── store/
│   │   └── useStore.js             # Zustand state management
│   ├── api/
│   │   └── api.js                  # Backend API client
│   ├── hooks/
│   │   ├── useSpeechRecognition.js # Voice input
│   │   └── useTextToSpeech.js      # Voice output
│   ├── utils/
│   │   └── i18n.js                 # Internationalization
│   └── index.css                    # Global styles
```

### **Backend Architecture**
```
backend/
├── server.js             # Main Express server
├── mcp-tools/            # MCP tool implementations
│   ├── perforce.js       # Perforce integration
│   ├── github.js         # GitHub integration
│   ├── jira.js           # Jira integration
│   ├── confluence.js     # Confluence integration
│   ├── slack.js          # Slack integration
│   ├── drive.js          # Google Drive integration
│   ├── gmail.js          # Gmail integration
│   ├── calendar.js       # Google Calendar integration
│   └── discord.js        # Discord integration
├── audio/                # Audio file storage
├── env/                  # Environment configurations
│   ├── perforce.env
│   ├── slack.env
│   ├── jira.env
│   └── confluence.env
└── whisper_models/       # Whisper model cache
```

---

## Key Features & Technologies

### **1. Voice Control**
- **Speech-to-Text**:
  - Web Speech API (real-time)
  - Auto-detection of 5 languages (EN, FR, ES, DE, JA)
  - 2-second silence detection for auto-send
  - Manual language selection via flag buttons
- **Text-to-Speech**:
  - Web Speech API
  - Gender selection (feminine/masculine)
  - Automatic language matching

### **2. LLM Integration**
- **Ollama Server**: http://localhost:11434
- **Configurable Parameters**:
  - **Thinking Mode**: Enable/disable reasoning visibility
  - **Temperature**: 0.0 - 2.0 (creativity control)
  - **Caching**: Keep model in memory (true/false)
  - **Tokens Limit**: 512/1024/1536/2048 (response length)
- **Tool Calling**: Native tool calling + manual `[TOOL_CALL: ...]` format
- **Streaming Responses**: Server-Sent Events (SSE)

### **3. MCP Tools (Model Context Protocol)**
76 total tools across 12 categories:
- **Perforce** (8 tools): Changelists, files, directories, client info
- **GitHub** (8 tools): Issues, PRs, commits, repos
- **Jira** (8 tools): Projects, issues, search, comments
- **Confluence** (8 tools): Spaces, pages, search
- **Slack** (8 tools): Channels, messages, threads, search
- **Google Drive** (8 tools): Files, folders, search
- **Gmail** (8 tools): Messages, threads, search
- **Calendar** (8 tools): Events, search
- **Discord** (8 tools): Channels, messages, guilds
- **Weather** (1 tool): Current weather by location
- **Transcript** (8 tools): Audio transcription
- **Math** (3 tools): Basic calculations

### **4. Authentication & Credentials**
- **Perforce**: Ticket-based authentication
- **GitHub**: Personal Access Token (PAT)
- **Jira/Confluence**: Atlassian API Token + email
- **Slack**: OAuth 2.0 (access + refresh tokens)
- **Google Services**: OAuth 2.0 (access + refresh tokens)
- **Discord**: Bot token

### **5. State Management**
**Zustand Store** manages:
- Chat messages and history
- Chat order (persisted in localStorage, restored on page load)
- Scratchpad content
- Settings (persisted in localStorage):
  - LLM model selection
  - Voice gender
  - Font scale factor
  - Ollama settings (thinking, temperature, caching, tokens limit)
  - Show internal reasoning
  - Language preference
- UI state:
  - Panel sizes (resizable)
  - Settings window position
  - Active tools display
  - Loading states

**Chat Order Persistence**:
- **Implementation**: Order is applied in `App.jsx` before `setChats()` is called
- **Why at source**: Prevents race conditions with React effects that could overwrite the order
- **Drag-and-drop**: Saves order immediately to localStorage when user reorders chats
- **Page refresh**: Order is restored at the source (App.jsx) before chats enter the store, ensuring correct order from the start
- **Reliability**: This approach is more reliable than effect-based restoration, which could be overwritten by other components

### **6. Internationalization**
**Supported Languages**:
- English (en-US)
- French (fr-FR)
- Spanish (es-ES)
- German (de-DE)
- Japanese (ja-JP)
- Chinese (zh-CN)

**Translation System**:
- `useTranslation` hook
- Language selector in header
- Dynamic UI translation
- MCP tool descriptions translated

### **7. Audio Processing**
- **Recording**: WebM format, MediaRecorder API
- **Storage**: Backend `audio/` directory
- **Transcription**: 
  - Whisper model (base.en)
  - Runs on CPU (no GPU required)
  - Supports multiple formats (webm, mp3, wav, m4a)

---

## Data Flow

### **Chat Message Flow**
```
1. User Input (text or voice)
   ↓
2. CenterPanel.jsx → handleSendMessage()
   ↓
3. api.js → chatWithLLM(model, messages, ollamaSettings)
   ↓
4. Backend → POST /api/llm/chat
   ↓
5. Tool Detection (regex + keywords)
   ↓
6. Tool Filtering (8-76 tools → 8-15 relevant)
   ↓
7. Ollama Request (with filtered tools)
   ↓
8. LLM Response (with tool calls)
   ↓
9. Tool Execution (if tool calls detected)
   ↓
10. Final Response Generation
    ↓
11. SSE Stream → Frontend
    ↓
12. CenterPanel displays chunks
    ↓
13. Save to chat history
```

### **Voice Input Flow**
```
1. User clicks mic icon
   ↓
2. useSpeechRecognition.js → startListening()
   ↓
3. Web Speech API → onresult events
   ↓
4. Language detection (word matching)
   ↓
5. Update input field (real-time)
   ↓
6. Silence detection (2 seconds)
   ↓
7. Auto-send message
```

### **Tool Execution Flow**
```
1. LLM returns tool call: [TOOL_CALL: tool_name {params}]
   ↓
2. Backend parses tool call
   ↓
3. Validate tool exists
   ↓
4. Execute tool function (e.g., listPerforceChangelists)
   ↓
5. Tool queries external service (e.g., `p4 changes`)
   ↓
6. Parse and format result
   ↓
7. Return to LLM for final formatting
   ↓
8. LLM generates user-friendly response
   ↓
9. Stream to frontend
```

---

## Performance Optimizations

### **1. Tool Filtering**
- **Problem**: Sending 76 tools to LLM is slow (10+ minutes)
- **Solution**: Aggressive filtering based on query intent
  - Weather query → 1 tool
  - Perforce query → 8 tools
  - General query → 15-20 most common tools
- **Result**: 95% faster tool selection

### **2. Token Limiting**
- **Problem**: Models generate verbose "thinking" that wastes time
- **Solution**: Different token limits for different phases
  - Initial phase: 2048 tokens (deciding which tool)
  - Post-tool phase: User-configurable (512/1024/1536/2048)
- **Result**: 2-3x faster post-tool responses

### **3. Model Caching**
- **Problem**: Loading model from disk takes 3-5 seconds
- **Solution**: `keep_alive: '30m'` option
- **Result**: Instant responses after first query

### **4. Small Model Strategy**
- **Problem**: Small models (1.5b, 7b) don't reliably use native tool calling
- **Solution**: Force manual `[TOOL_CALL: ...]` format for models < 14b
- **Result**: More reliable tool execution

---

## Security Considerations

### **Credentials Management**
- All API keys/tokens stored in `backend/env/*.env` files
- Environment files in `.gitignore`
- Perforce uses ticket-based auth (password not exposed)
- OAuth tokens auto-refresh (Slack, Google)

### **CORS Configuration**
- Frontend: `http://localhost:5174`
- Backend: `http://localhost:3002`
- CORS enabled for development

### **File Upload**
- Audio files limited to 25MB
- Only specific formats accepted (webm, mp3, wav, m4a)
- Files stored temporarily, can be deleted

---

## Development Setup

### **Environment Variables**
```bash
# Backend
PORT=3002
OLLAMA_URL=http://localhost:11434
DEFAULT_MODEL=qwen2.5:1.5b

# Perforce (backend/env/perforce.env)
P4_USER=username
P4_PORT=perforce-server:1666
P4_CLIENT=workspace_name

# Slack (backend/env/slack.env)
SLACK_ACCESS_TOKEN=xoxe.xoxp-...
SLACK_REFRESH_TOKEN=xoxe-1-...

# Jira (backend/env/jira.env)
JIRA_BASE_URL=https://org.atlassian.net
JIRA_EMAIL=user@example.com
JIRA_API_TOKEN=...

# Confluence (backend/env/confluence.env)
CONFLUENCE_BASE_URL=https://org.atlassian.net
CONFLUENCE_EMAIL=user@example.com
CONFLUENCE_API_TOKEN=...
```

### **Server Ports**
- **Backend**: http://localhost:3002
- **Frontend**: http://localhost:5174
- **Ollama**: http://localhost:11434

### **Start Commands**
```bash
# Backend
cd backend && node server.js

# Frontend
cd frontend && npm run dev
```

---

## Browser Requirements

- **Modern Browser**: Chrome, Edge, Safari (latest)
- **Speech Recognition**: Chrome/Edge only (Web Speech API)
- **Text-to-Speech**: All modern browsers
- **MediaRecorder API**: All modern browsers
- **localStorage**: Required for settings persistence

---

## Known Limitations

1. **Speech Recognition**: Chrome/Edge only (Web Speech API not available in Firefox)
2. **Small Models**: Tool calling less reliable with models < 14b
3. **Token Limits**: Can still cut off very long responses even at 2048
4. **Perforce**: Requires P4 CLI installed and configured
5. **Whisper**: CPU-only, can be slow for long audio files (>5 minutes)
6. **Language Detection**: Not perfect, may need manual selection
7. **CORS**: Development-only configuration, needs update for production

---

## Future Technology Considerations

### **Potential Upgrades**
- **Frontend**: 
  - Migration to Next.js for SSR
  - React Query for data fetching
  - Zustand → Redux Toolkit (if state becomes complex)
- **Backend**:
  - PostgreSQL for chat history persistence
  - Redis for caching/session management
  - WebSocket for real-time updates
- **AI/ML**:
  - OpenAI API fallback
  - Anthropic Claude integration
  - Fine-tuned models for specific domains
- **Infrastructure**:
  - Docker containerization
  - Kubernetes orchestration
  - Cloud deployment (AWS/Azure/GCP)

---

## Version Information

**Current Stack Versions**:
- Node.js: v22.21.1
- React: 18.3.1
- Express: 4.21.2
- Ollama: 0.15.1
- Whisper: base.en model
- Vite: 6.0.11
