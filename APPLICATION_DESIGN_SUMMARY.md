# Application Design Summary

## Overview

**A_Proto0** is an AI-powered chat assistant with integrated voice control and MCP (Model Context Protocol) tools for interacting with various external services. The application combines local LLM inference (Ollama) with a modern web interface to create a flexible, extensible assistant platform.

---

## Design Philosophy

### **Core Principles**

1. **Local-First AI**: Use Ollama for privacy and control
2. **Multi-Modal Interaction**: Text, voice input/output
3. **Tool-Augmented Intelligence**: LLM + 76 external tools
4. **User Control**: Extensive settings for customization
5. **Extensibility**: Easy to add new MCP tools
6. **Performance**: Aggressive optimization for speed

---

## System Architecture

### **High-Level Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌───────────┐  ┌────────────┐  ┌──────────────┐          │
│  │  Header   │  │   Center   │  │    Right     │          │
│  │  (Nav)    │  │   (Chat)   │  │  (Agents)    │          │
│  └───────────┘  └────────────┘  └──────────────┘          │
│  ┌──────────────────────────────────────────────┐          │
│  │         Left Panel (Chat History)             │          │
│  └──────────────────────────────────────────────┘          │
│                                                              │
│  React + Zustand + Vite + Tailwind CSS                     │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/SSE
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐      │
│  │   Express    │  │  MCP Tools   │  │   Whisper   │      │
│  │   Server     │  │  (76 tools)  │  │   (STT)     │      │
│  └──────────────┘  └──────────────┘  └─────────────┘      │
│                                                              │
│  Node.js + Express                                          │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP
┌─────────────────────────────────────────────────────────────┐
│                      OLLAMA SERVER                           │
│  ┌────────────────────────────────────────┐                │
│  │  LLM Models (qwen2.5, qwen3)           │                │
│  │  - 1.5b, 7b, 14b, 30b                  │                │
│  └────────────────────────────────────────┘                │
│                                                              │
│  http://localhost:11434                                     │
└─────────────────────────────────────────────────────────────┘
                            ↕ API
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
│  Perforce | GitHub | Jira | Confluence | Slack              │
│  Gmail | Drive | Calendar | Discord                         │
└─────────────────────────────────────────────────────────────┘
```

---

## User Interface Design

### **Layout Structure**

```
┌─────────────────────────────────────────────────────────────┐
│  Header: [Mic] [Speaker] [Language] [Settings] [Model Info] │
├───────────┬──────────────────────────────────┬──────────────┤
│           │                                  │              │
│   LEFT    │           CENTER                 │    RIGHT     │
│   PANEL   │           PANEL                  │    PANEL     │
│           │                                  │              │
│  • Chats  │  • Chat Messages                 │  • Agents    │
│  • New    │  • Input Field                   │    - List    │
│  • Delete │  • Send Button                   │    - Active  │
│  • Drag   │  • Image Upload                  │              │
│           │  • Voice Input                   │  • Record    │
│  • Scratch│  • Auto-send                     │    - Audio   │
│    pad    │                                  │    - Files   │
│           │                                  │              │
│ (Resizable)                                  │ (Resizable)  │
│           │                                  │              │
└───────────┴──────────────────────────────────┴──────────────┘
```

### **Panel Responsibilities**

#### **Header**
- **Purpose**: Global controls and status
- **Components**:
  - Mic toggle (speech input)
  - Speaker toggle (speech output)
  - Language selector (6 languages)
  - Settings button
  - Model info display

#### **Left Panel** (Resizable)
- **Purpose**: Chat management and scratchpad
- **Features**:
  - List of saved chats (drag-to-reorder)
  - New chat button
  - Delete chat button
  - Scratchpad (persistent notes)
  - Auto-save functionality

#### **Center Panel** (Main)
- **Purpose**: Primary chat interface
- **Features**:
  - Message display (user/assistant)
  - Real-time typing indicator
  - Internal reasoning display (optional)
  - Input field (multiline support)
  - Image attachment
  - Voice input integration
  - Auto-send after 2s silence

#### **Right Panel** (Resizable)
- **Purpose**: Tool monitoring and audio recording
- **Sections**:
  - **Agent Section**:
    - 12 tool categories (expandable)
    - Tool count per category
    - Active tool display (blinking)
  - **Recording Section**:
    - Record audio
    - Upload audio files
    - Transcribe recordings

---

## Settings Design

### **Two-Tab Structure**

#### **Tab 1: User Interface**
**Focus**: Visual and UX settings

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| Show Internal Reasoning | Checkbox | false | Display LLM's thought process |
| Font Scale Factor | Slider (1.0-5.0) | 1.0 | Adjust text size |
| Voice Gender | Dropdown | Feminine | TTS voice selection |
| About | Info | - | App information |

#### **Tab 2: LLM Settings**
**Focus**: Model configuration

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| LLM Model | Dropdown | qwen2.5:1.5b | Model selection |
| Temperature | Slider (0.0-2.0) | 0.3 | Creativity control |
| Tokens Limit | Dropdown | 1536 | Response length |
| Enable Caching | Checkbox | true | Keep model in memory |
| Enable Thinking | Checkbox | false | Show reasoning process |
| Ollama Connection | Text | localhost:11434 | Ollama server URL |
| API Keys | Password | - | Future: OpenAI/Anthropic |

**Settings Persistence**:
- All settings stored in `localStorage`
- Survive browser restarts
- Per-user (browser-based)

---

## Voice Control Design

### **Speech-to-Text (STT)**

**Flow**:
```
1. User clicks mic icon → Mic turns on
2. Web Speech API starts listening
3. Real-time transcription → Input field
4. Language detection (EN, FR, ES, DE, JA)
5. Auto-switch language if detected
6. 2 seconds of silence → Auto-send message
```

**Language Detection Algorithm**:
- Word-based matching (common words per language)
- Scoring system (need 8-10 points)
- Auto-restart recognition with detected language
- Manual override via flag buttons

**Edge Cases**:
- User can type while mic is on (both work)
- Mic stays on after message sent (continues listening)
- Mic reactivates after LLM response (for follow-up)

### **Text-to-Speech (TTS)**

**Flow**:
```
1. User clicks speaker icon → Speaker turns on
2. LLM generates response
3. Detect language of response
4. Select appropriate voice (gender + language)
5. Speak response chunks as they arrive
6. Stop if user interrupts
```

**Voice Selection**:
- Masculine/Feminine preference (settings)
- Auto-match language (EN, FR, ES, DE, JA, ZH)
- Fallback to English if language not found

---

## Tool Calling Design

### **MCP Tools Architecture**

**Tool Categories** (13):
1. Perforce (8 tools)
2. GitHub (8 tools)
3. Jira (8 tools) - includes JIRA-Perforce verification tool
4. Confluence (8 tools)
5. Slack (6 tools)
6. Google Drive (9 tools)
7. Gmail (8 tools)
8. Calendar (7 tools)
9. Discord (5 tools)
10. Notion (3 tools)
11. Weather (1 tool)
12. Transcript (10 tools)
13. Math (2 tools)

### **Tool Definition Structure**

```javascript
{
  name: "tool_name",
  description: "Clear description for LLM",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "..." },
      param2: { type: "number", description: "..." }
    },
    required: ["param1"]
  }
}
```

### **Tool Execution Flow**

```
1. USER QUERY
   "List the 10 most recent changelists from Sean Fisher"
   ↓
2. TOOL DETECTION (Regex + Keywords)
   "perforce", "changelists", "sean fisher" → Perforce tool needed
   ↓
3. TOOL FILTERING
   76 tools → 8 Perforce tools (95% faster)
   ↓
4. LLM DECISION (Ollama)
   Model receives: Query + 8 tool definitions
   Model returns: [TOOL_CALL: list_perforce_changelists {"user": "sean_fisher", "limit": 10}]
   ↓
5. TOOL EXECUTION (Backend)
   Parse: tool_name = "list_perforce_changelists"
   Parse: params = { user: "sean_fisher", limit: 10 }
   Execute: p4 changes -u sean_fisher -m 10 //...
   ↓
6. TOOL RESULT
   {
     changelists: [
       { changelist: "72040", date: "2026/02/09", ... },
       ...
     ]
   }
   ↓
7. FINAL FORMATTING (Ollama)
   Model receives: Tool result + user query
   Model generates: "Here are the 10 most recent changelists from Sean Fisher: ..."
   ↓
8. STREAM TO USER
   SSE → Frontend displays chunks
```

### **Tool Calling Optimization**

**Problem**: Sending all 76 tools is slow (10+ minutes)

**Solution**: Aggressive filtering
- Detect intent from query (regex + keywords)
- Only send relevant tools (8-15 max)
- Result: 95% faster, 10 seconds vs 10 minutes

**Fallback Strategy**:
- Small models (< 14b): Force manual `[TOOL_CALL: ...]` format
- Large models (>= 14b): Use native tool calling
- Reason: Small models unreliable with native tool calling

---

## State Management Design

### **Zustand Store Structure**

```javascript
{
  // Chat State
  chats: [],              // All chat sessions
  currentChatId: null,    // Active chat
  messages: [],           // Current chat messages
  
  // UI State
  isLoading: false,       // Loading indicator
  showSettings: false,    // Settings modal
  activeTools: [],        // Currently active tools
  
  // Settings (Persisted)
  selectedModel: "qwen2.5:1.5b",
  selectedLanguage: "en-US",
  voiceGender: "feminine",
  fontScaleFactor: 1.0,
  micEnabled: false,
  speakerEnabled: false,
  
  // LLM Settings (Persisted)
  ollamaThinking: false,
  ollamaTemperature: 0.3,
  ollamaCaching: true,
  tokensLimit: 1536,
  showInternalReasoning: false,
  
  // Panel Sizes (Persisted)
  leftPanelSize: 20,
  rightPanelSize: 20,
  
  // Scratchpad (Persisted)
  scratchpadContent: "",
  
  // Model Tracking
  availableModels: [],
  modelUsage: {},         // Track usage count per model
  
  // Actions
  setMessages, addMessage, updateMessage,
  setSelectedModel, setOllamaTemperature,
  setActiveTool, clearActiveTool, ...
}
```

### **Persistence Strategy**

**localStorage Keys**:
- `chats` → All chat history
- `chatOrder` → Drag-and-drop order (persisted and restored on page load)
- `scratchpadContent` → Notes
- `selectedModel` → Current model
- `ollamaThinking`, `ollamaTemperature`, etc. → LLM settings
- `leftPanelSize`, `rightPanelSize` → Panel widths
- `modelUsage` → Usage tracking

**Chat Order Persistence**:
- **Implementation**: Order is applied in `App.jsx` before `setChats()` is called
- **Why at source**: Prevents race conditions with React effects that could overwrite the order
- **Drag-and-drop**: Saves order immediately to localStorage when user reorders chats
- **Page refresh**: Order is restored at the source (App.jsx) before chats enter the store, ensuring correct order from the start
- **Reliability**: This approach is more reliable than effect-based restoration, which could be overwritten by other components

**Why localStorage?**:
- No database setup required
- Instant persistence
- Per-browser/per-user
- Survives page reloads

**Limitations**:
- ~5-10MB limit
- Not synced across devices
- No server backup

---

## Performance Design

### **Token Management**

**Two-Phase Strategy**:

| Phase | Tokens | Purpose |
|-------|--------|---------|
| Tool Selection | 2048 | LLM decides which tool to call |
| Post-Tool Formatting | User-configurable (512/1024/1536/2048) | LLM formats tool result |

**Why Two Phases?**:
- Tool selection needs more thinking space
- Post-tool is just formatting → less tokens needed
- Result: 2-3x faster responses

### **Model Caching**

**Design**:
- `keep_alive: '30m'` → Keep model in memory
- First query: 3-5 seconds (load model)
- Subsequent queries: <1 second (instant)
- Trade-off: Uses 2-22GB RAM/VRAM

**User Control**:
- "Enable Caching" checkbox in settings
- `false` → Unload immediately after response
- `true` → Keep for 30 minutes (default)

### **Streaming Responses**

**Design**:
- Server-Sent Events (SSE) from backend
- Frontend displays chunks as they arrive
- 5-character chunks with 20ms delay
- Result: User sees response immediately

---

## Error Handling Design

### **Frontend Error Handling**

1. **Network Errors**: Timeout after 10 minutes (tool-heavy queries)
2. **Empty Responses**: Show "Tools were executed, but no response was generated"
3. **Speech Recognition Errors**: Silently restart, log to console
4. **Loading Stuck**: 15-minute safety timeout to reset UI

### **Backend Error Handling**

1. **Tool Execution Failures**: Return error message to LLM for graceful handling
2. **Ollama Connection Errors**: Log and return 500 error
3. **Perforce Auth Errors**: Auto-login with ticket if expired
4. **File Upload Errors**: Validate size (25MB) and format

---

## Security Design

### **Credentials Management**

**Storage**:
- All API keys/tokens in `backend/env/*.env`
- Files in `.gitignore`
- Never committed to Git

**Authentication Types**:
- **Perforce**: Ticket-based (auto-refresh)
- **OAuth 2.0**: Slack, Google (token rotation)
- **API Tokens**: GitHub, Jira, Confluence
- **Bot Tokens**: Discord

**Network Security**:
- CORS restricted to localhost (development)
- No external access (local-only)
- HTTPS not required (localhost)

---

## Extensibility Design

### **Adding New MCP Tools**

**Process**:
1. Create tool file in `backend/mcp-tools/`
2. Define tool schema (name, description, parameters)
3. Implement tool function (query external service)
4. Export tool definition and function
5. Import in `server.js`
6. Add to `allToolsDefinition` array
7. Add to `executeTool` switch statement

**Example Structure**:
```javascript
// backend/mcp-tools/new-service.js

export const newServiceToolsDefinition = [
  {
    type: 'function',
    function: {
      name: 'get_data',
      description: 'Get data from new service',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Data ID' }
        },
        required: ['id']
      }
    }
  }
];

export async function getData(params) {
  // Implement tool logic
  return { data: '...' };
}
```

---

## UI/UX Design Patterns

### **Loading States**

- **Typing Indicator**: "⏳ Processing..." or "💭 Thinking..." (based on mode)
- **Tool Execution**: Active tool name blinks in Agent Section
- **Model Loading**: "Loading..." message in header

### **Feedback Mechanisms**

- **Voice Input**: Mic icon turns blue when active
- **Voice Output**: Speaker icon turns blue when active
- **Tool Activity**: Tool name + count displayed in real-time
- **Auto-save**: "Saved" indicator in scratchpad

### **User Controls**

- **Resizable Panels**: Drag dividers to resize
- **Draggable Chats**: Reorder by drag-and-drop
- **Expandable Categories**: Click to expand/collapse tool lists
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for newline

---

## Internationalization Design

### **Translation System**

**Structure**:
```javascript
const translations = {
  'en-US': {
    'send': 'Send',
    'new.chat': 'New Chat',
    ...
  },
  'fr-FR': {
    'send': 'Envoyer',
    'new.chat': 'Nouvelle Discussion',
    ...
  },
  ...
};
```

**Usage**:
```javascript
const t = useTranslation(selectedLanguage);
<button>{t('send')}</button>
```

**Supported Elements**:
- UI labels and buttons
- Setting descriptions
- Error messages
- MCP tool descriptions (translated per language)

---

## Future Design Considerations

### **Scalability**
- Move chat history to database (PostgreSQL)
- Add user authentication
- Multi-device sync

### **Enhanced AI**
- Multiple LLM providers (OpenAI, Anthropic)
- Fine-tuned models per domain
- Retrieval-Augmented Generation (RAG)

### **Collaboration**
- Multi-user chats
- Shared scratchpads
- Real-time collaboration (WebSocket)

### **Mobile**
- Responsive design
- React Native app
- Offline support

---

## Design Decisions & Rationale

### **Why Ollama?**
- ✅ Local inference (privacy)
- ✅ No API costs
- ✅ Full control over models
- ❌ Requires good hardware

### **Why Zustand over Redux?**
- ✅ Simpler API
- ✅ Less boilerplate
- ✅ Better TypeScript support (if migrating)
- ✅ Sufficient for current complexity

### **Why localStorage over Database?**
- ✅ Faster development
- ✅ No backend complexity
- ✅ Instant persistence
- ❌ Limited to 5-10MB
- ❌ No multi-device sync

### **Why Web Speech API over Backend STT?**
- ✅ Real-time transcription
- ✅ No server processing cost
- ✅ Instant feedback
- ❌ Chrome/Edge only
- ❌ Internet required

### **Why SSE over WebSocket?**
- ✅ Simpler implementation
- ✅ One-way communication sufficient
- ✅ Auto-reconnect built-in
- ❌ No bidirectional support (not needed)

---

## Conclusion

**A_Proto0** is designed as a:
- **Flexible**: Easy to add new tools and models
- **Performant**: Aggressive optimizations for speed
- **User-Friendly**: Intuitive UI with voice control
- **Local-First**: Privacy and control
- **Extensible**: Clean architecture for future growth

The design emphasizes **developer experience** (easy to extend) and **user experience** (intuitive, responsive, powerful).
