    # AI Unseen Workspace

A powerful AI-powered workspace with LLM integration, MCP tools, voice controls, and 3D visualization.

## Features

- 🤖 **LLM Integration**: Chat with Ollama models (default: qwen3-vl:30b running on GPU/CPU with automatic device detection)
- 🔧 **MCP Tools** (80+ tools):
  - **Development**: Perforce (changelists, depot explorer, workspace config), GitHub (issues, PRs, commits)
  - **Collaboration**: JIRA (issues, sprints), Slack (channels, messages), Confluence (pages, spaces)
  - **Google Workspace**: Gmail, Calendar, Drive (read-only access)
  - **Communication**: Discord (servers, channels, messages)
  - **Utilities**: Weather (Open-Meteo), Calculator (advanced math), Transcript management
  - All tools with intelligent filtering - LLM knows when to use each tool
- 🎤 **Voice Controls**: Speech-to-text and text-to-speech with voice gender selection
- 📝 **Chat Management**: Create, save, and manage multiple chat sessions with language-dependent names
- 📋 **Scratchpad**: File-based persistent note-taking area (auto-saves to `scratchpad.txt`, survives browser clearing and session changes)
- 🎙️ **Audio Recording & Transcription**:
  - High-quality recording (48kHz stereo, Opus codec, 128kbps) with echo cancellation
  - Record meetings with live transcription
  - Save recordings as audio files (WebM, MP4, OGG)
  - Transcribe audio files using Whisper (local Python service)
  - File-based transcript storage (`.transcript.json` files)
- 🎨 **3D Graphics**: Interactive rotating cube with Three.js
- 💾 **State Persistence**: All settings, chats, and panel layouts are saved locally
- 🎯 **Resizable Panels**: Customizable layout with persistent panel sizes (horizontal and vertical separations)
- 🔤 **Font Scale Factor**: Adjustable font size scaling (1x to 5x) with immediate effect throughout the application
- 🪟 **Customizable Settings Window**: Draggable and resizable settings modal with persistent position and size
- 🌍 **Multi-language Support**: Full internationalization (English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese)
- 📅 **Audio Calendar**: Interactive calendar view for managing audio recordings and transcripts with date-based navigation, transcript association, and one-click transcription for calendar-selected files
- 🧪 **Comprehensive Testing**: Unit tests for core functionality including transcript tool filtering

## Prerequisites

- Git (for version control)
- Node.js 22.x LTS (not 24.x - required for native module compatibility)
- [Ollama](https://ollama.ai) installed and running
- qwen3-vl:30b model pulled in Ollama (recommended for best performance) or any compatible model
- Python 3.11+ (for Whisper transcription)
- FFmpeg (for audio processing)
- Visual Studio Build Tools 2022 with C++ workload (for compiling native modules)
- openai-whisper Python package: `pip install openai-whisper`

**📖 For detailed setup instructions on a fresh Windows 11 installation, see [SETUP_GUIDE.md](SETUP_GUIDE.md)**

## Installation

1. Install dependencies:
```bash
npm install
cd frontend && npm install
cd ..
```

2. Make sure Ollama is running:
```bash
ollama serve
```

3. Pull the default model (if not already done):
```bash
ollama pull qwen3-vl:30b
```

4. Install Whisper for audio transcription:
```bash
pip install openai-whisper
```

## Running the Application

Start both the backend server and frontend:
```bash
npm run dev
```

- **Backend**: [http://localhost:3002](http://localhost:3002)
- **Frontend**: [http://localhost:5174](http://localhost:5174)

## Testing

Run the unit tests:
```bash
# Run all tests (backend + frontend)
npm run test:all

# Run backend tests only
npm run test

# Run frontend tests only
npm run test:frontend

# Run tests with coverage
npm run test:coverage
```

Current test coverage includes:
- Transcript tool filtering logic (52 test cases)
- Ensures AI doesn't use transcript tools for general knowledge questions
- Validates proper tool activation for transcript-specific queries

## Usage

1. **Create a Chat**: Click "New Chat" in the left panel (name adapts to selected language)
2. **Send Messages**: Type in the center panel and press Enter or click Send
3. **Voice Input**: Enable the microphone button in the header for speech-to-text
4. **Voice Output**: Enable the speaker button to hear responses with gender-specific voices
5. **Select Tools**: Click on MCP agents in the right panel to enable them
6. **Record Audio**:
   - Use the recording section to record meetings with high-quality settings
   - Live transcription appears automatically during recording
   - Recordings are saved as timestamped audio files (WebM/MP4/OGG) with no audio feedback
7. **Transcribe Audio Files**:
   - Load an audio file (MP3, WAV, WebM, MP4, OGG, FLAC, etc.)
   - Click the "Transcript" button to transcribe using local Whisper
   - Transcripts are saved as `.transcript.json` files matching the audio filename
8. **Audio Calendar**:
   - Click the "Calendar" button in the recording section to open the audio calendar
   - Navigate between months using the arrow buttons
   - Audio files are displayed as colored dots on their recording dates (color indicates duration: blue=short, orange=medium, red=long)
   - Click on any date to see all audio files recorded on that day
   - Select an audio file to load it into the main interface
   - Automatic transcript association: calendar shows which files have transcripts
   - Click "Transcribe Now" to generate transcripts for audio files without them
   - Selected audio files can be transcribed directly from the calendar (downloads and processes automatically)
10. **Query Transcripts**: Use natural language to search transcripts (AI automatically filters transcript tools for general questions):
    - "show the latest transcript"
    - "find sentences where 'keyword' is mentioned"
    - "summarize the transcript" (full LLM-generated summary)
11. **Use Perforce Tools**: Query your Perforce depot and changelists:
    - "List the 10 most recent changelists from [username]"
    - "Show me what's in the depot"
    - "Tell me about my P4 workspace"
    - "What files were changed in changelist 69297?"
12. **Use Collaboration Tools**: Ask about JIRA, Slack, GitHub, etc.:
    - "Show me JIRA issue PROJ-123"
    - "List recent messages in #general channel"
    - "What are the open issues in [repo]?"
13. **Scratchpad**: Write notes in the bottom-left section (auto-saves to file, persists across sessions)
14. **Settings**: Click the settings icon to configure models and API keys
15. **Font Scale Factor**:
    - Open Settings and adjust the "Font Scale Factor" slider (1.0x to 5.0x)
    - Changes apply immediately to all text in the application
    - Setting is persisted and restored on next session
16. **Settings Window Controls**:
    - **Move**: Click and drag the "Settings" header to reposition the window
    - **Resize**: Click and drag any border or corner to resize the window
    - Window position and size are automatically saved and restored
17. **Voice Gender Selection**:
    - In Settings, choose between masculine and feminine voices for text-to-speech
    - Voice selection adapts to the current language setting
18. **Language Settings**:
    - Change language in Settings to switch the entire interface (8 languages supported)
    - All text, including chat names and error messages, updates immediately

## Model Status, Device, and Memory

- The header shows readiness like: `ollama app model qwen3-vl:30b is ready. GPU - 22.45GB VRAM`
- GPU/CPU is inferred from Ollama `/api/ps`; NPU is not exposed by the API (GPU shown when VRAM/gpu layers are present).
- Memory shown is runtime VRAM if on GPU, otherwise RAM; if unavailable, falls back to the model file size.
- Loading progress is displayed: `ollama app model qwen2.5:1.5b is loading X%`
- API endpoints:
  - `GET /api/llm/status` → version + running models with `device`, `memoryType`, `sizeGB`
  - `POST /api/llm/warmup` → warm a model: `{ "model": "qwen2.5:1.5b" }`
  - `POST /api/llm/stop` → unload a model: `{ "model": "qwen2.5:1.5b" }` (useful to force reload onto GPU)

### Performance with Large Models

When using large models (e.g., qwen3:30b) with 80+ MCP tools:
- **Simple queries**: 10-30 seconds
- **Tool-using queries**: 30-90 seconds (Perforce, GitHub, etc.)
- **Complex queries**: 60-180 seconds
- **Timeout**: 5 minutes for tool requests, 3 minutes for general queries
- **Summarization**: 2 minutes timeout for long transcripts

The backend automatically adjusts timeouts based on query type to prevent errors with large models.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite (for chat history)
- **Transcript Storage**: File-based (`.transcript.json` files in `backend/transcripts/`)
- **Audio Storage**: Audio files saved to `backend/audio/`
- **Scratchpad Storage**: File-based (`scratchpad.txt` in project root, persists across sessions)
- **Credentials**: Secure storage in `backend/credentials/` (gitignored .env files)
- **Transcription**: Local Whisper service (Python) for audio file transcription
- **3D Graphics**: Three.js with @react-three/fiber
- **State Management**: Zustand (with file-based persistence for scratchpad)
- **LLM**: Ollama (local models with 5-minute timeout for complex tool queries)

## MCP Tools

The application includes 80+ MCP (Model Context Protocol) tools across multiple categories:

### Development & Version Control

#### **Perforce** (7 tools)
- `list_perforce_changelists`: List recent commits/changelists (filter by user, limit)
- `get_perforce_changelist`: Get detailed changelist info (files, diffs, description)
- `list_perforce_directories`: Explore depot structure
- `list_perforce_files`: List files in a depot directory
- `get_perforce_file_info`: Get file metadata
- `get_perforce_file_content`: Read file content from depot
- `get_perforce_file_history`: View file revision history
- `get_perforce_client`: View workspace configuration

**Example queries:**
- "List the 5 most recent changelists from Jose Vieira"
- "Show me what's in the depot"
- "Tell me about my P4 workspace configuration"
- "What files were modified in changelist 69297?"

#### **GitHub** (Read-only access)
- List repositories, issues, pull requests
- View commits and file contents
- Search code and issues

### Collaboration & Project Management

#### **JIRA** (Read-only)
- View issues, sprints, boards
- Search projects and issues
- Get issue details and comments

#### **Slack** (Read-only)
- List channels and messages
- Search conversations
- View channel history

#### **Confluence** (Read-only)
- Browse spaces and pages
- Search documentation
- View page content

### Google Workspace (Read-only)

- **Gmail**: Read emails, search inbox
- **Google Calendar**: View events and schedules
- **Google Drive**: List and read files

### Communication

#### **Discord** (Read-only)
- List servers and channels
- View messages and threads
- Search conversations

### Utilities

#### **Weather**
- Get current weather for any city (Open-Meteo API)
- Temperature, conditions, wind, humidity

#### **Calculator**
- Advanced math: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- Functions: `exp`, `log`, `ln`, `sqrt`, `abs`, `pow`, `min`, `max`
- Constants: `pi`, `e`
- Arithmetic: `+`, `-`, `*`, `/`, `^`, parentheses

**Example**: `"Calculate sin(PI/2) + log(100)"`

#### **Transcript Tools** (6 tools with intelligent filtering)
- `get_latest_transcript`: Display the most recent transcript
- `get_transcript`: Display a specific transcript by filename
- `find_sentences_in_latest_transcript`: Find all sentences containing a keyword
- `find_sentences_in_transcript`: Find sentences in a specific transcript
- `summarize_keyword_in_latest_transcript`: Summarize keyword mentions
- `summarize_keyword_in_transcript`: Summarize keyword in specific transcript

**Example queries:**
- "show the latest transcript"
- "find sentences where 'Anna' is mentioned"
- "summarize the transcript"

**Note**: The AI intelligently filters transcript tools - they are only used for transcript-specific queries, not general knowledge questions.

### Credential Management

MCP tools requiring authentication store credentials securely in `backend/credentials/`:
- `perforce.env` - Perforce server, user, client, password
- `jira.env` - JIRA base URL, email, API token
- `slack.env` - Slack bot token
- `google.env` - Google Workspace access token

See `backend/credentials/README.md` for setup instructions.

**Note**: All credential files are gitignored and must be created manually.

## License

MIT

