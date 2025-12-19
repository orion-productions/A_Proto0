    # AI Unseen Workspace

A powerful AI-powered workspace with LLM integration, MCP tools, voice controls, and 3D visualization.

## Features

- 🤖 **LLM Integration**: Chat with Ollama models (default: qwen3-vl:30b running on GPU/CPU with automatic device detection)
- 🔧 **MCP Tools**:
  - Weather lookup (Open-Meteo API)
  - Calculator (complex math: sin/cos/tan/exp/log/ln/sqrt/abs/min/max, etc.)
  - Transcript tools (display, summarize, find sentences by keyword with intelligent filtering)
- 🎤 **Voice Controls**: Speech-to-text and text-to-speech with voice gender selection
- 📝 **Chat Management**: Create, save, and manage multiple chat sessions with language-dependent names
- 📋 **Scratchpad**: Auto-saving note-taking area
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
8. **Query Transcripts**: Use natural language to search transcripts (AI automatically filters transcript tools for general questions):
   - "show the latest transcript"
   - "find sentences where 'keyword' is mentioned"
   - "summarize the transcript" (full LLM-generated summary)
9. **Scratchpad**: Write notes in the bottom-left section
10. **Settings**: Click the settings icon to configure models and API keys
11. **Font Scale Factor**:
    - Open Settings and adjust the "Font Scale Factor" slider (1.0x to 5.0x)
    - Changes apply immediately to all text in the application
    - Setting is persisted and restored on next session
12. **Settings Window Controls**:
    - **Move**: Click and drag the "Settings" header to reposition the window
    - **Resize**: Click and drag any border or corner to resize the window
    - Window position and size are automatically saved and restored
13. **Voice Gender Selection**:
    - In Settings, choose between masculine and feminine voices for text-to-speech
    - Voice selection adapts to the current language setting
14. **Language Settings**:
    - Change language in Settings to switch the entire interface (8 languages supported)
    - All text, including chat names and error messages, updates immediately

## Model status, device, and memory

- The header shows readiness like: `ollama app model qwen3-vl:30b is ready. GPU - 22.45GB VRAM`
- GPU/CPU is inferred from Ollama `/api/ps`; NPU is not exposed by the API (GPU shown when VRAM/gpu layers are present).
- Memory shown is runtime VRAM if on GPU, otherwise RAM; if unavailable, falls back to the model file size.
- Loading progress is displayed: `ollama app model qwen2.5:1.5b is loading X%`
- API endpoints:
  - `GET /api/llm/status` → version + running models with `device`, `memoryType`, `sizeGB`
  - `POST /api/llm/warmup` → warm a model: `{ "model": "qwen2.5:1.5b" }`
  - `POST /api/llm/stop` → unload a model: `{ "model": "qwen2.5:1.5b" }` (useful to force reload onto GPU)

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite (for chat history)
- **Transcript Storage**: File-based (`.transcript.json` files in `backend/transcripts/`)
- **Audio Storage**: Audio files saved to `backend/audio/`
- **Transcription**: Local Whisper service (Python) for audio file transcription
- **3D Graphics**: Three.js with @react-three/fiber
- **State Management**: Zustand
- **LLM**: Ollama (local models)

## MCP Tools

The following MCP tools are available:

- **Weather**: Get current weather for any city (uses Open-Meteo API)
- **Calculator**: Evaluate complex math expressions (sin/cos/tan/exp/log/ln/sqrt/abs/min/max, arithmetic operations, pi, e)
- **Transcript Tools**:
  - `get_latest_transcript`: Display the most recent transcript
  - `get_transcript`: Display a specific transcript by filename
  - `find_sentences_in_latest_transcript`: Find all sentences containing a keyword in the latest transcript
  - `find_sentences_in_transcript`: Find all sentences containing a keyword in a specific transcript
  - `summarize_keyword_in_latest_transcript`: Summarize mentions of a keyword in the latest transcript
  - `summarize_keyword_in_transcript`: Summarize mentions of a keyword in a specific transcript

### Transcript Query Examples

- "can you give me the sentences where 'Anna' is mentioned in the transcript 'file.json'?"
- "is there a place where Anna is mentioned?"
- "summarize the transcript" (full LLM-generated summary with proper timeout handling)
- "show the latest transcript"

**Note**: The AI intelligently filters transcript tools - they are only used for transcript-specific queries, not general knowledge questions.

## License

MIT

