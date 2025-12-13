    # AI Unseen Workspace

A powerful AI-powered workspace with LLM integration, MCP tools, voice controls, and 3D visualization.

## Features

- 🤖 **LLM Integration**: Chat with Ollama models (default: qwen2.5:1.5b running on GPU/CPU with automatic device detection)
- 🔧 **MCP Tools**: 
  - Weather lookup (Open-Meteo API)
  - Calculator (complex math: sin/cos/tan/exp/log/ln/sqrt/abs/min/max, etc.)
  - Transcript tools (display, summarize, find sentences by keyword)
- 🎤 **Voice Controls**: Speech-to-text and text-to-speech
- 📝 **Chat Management**: Create, save, and manage multiple chat sessions
- 📋 **Scratchpad**: Auto-saving note-taking area
- 🎙️ **Audio Recording & Transcription**: 
  - Record meetings with live transcription
  - Save recordings as audio files
  - Transcribe audio files using Whisper (local Python service)
  - File-based transcript storage (`.transcript.json` files)
- 🎨 **3D Graphics**: Interactive rotating cube with Three.js
- 💾 **State Persistence**: All settings, chats, and panel layouts are saved locally
- 🎯 **Resizable Panels**: Customizable layout with persistent panel sizes (horizontal and vertical separations)

## Prerequisites

- Node.js 18+ and npm
- [Ollama](https://ollama.ai) installed and running
- qwen2.5:1.5b model pulled in Ollama (or any compatible model)
- Python 3.8+ (for Whisper transcription)
- ffmpeg (for audio processing)
- openai-whisper Python package: `pip install openai-whisper`

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
ollama pull qwen2.5:1.5b
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

## Usage

1. **Create a Chat**: Click "New Chat" in the left panel
2. **Send Messages**: Type in the center panel and press Enter or click Send
3. **Voice Input**: Enable the microphone button in the header
4. **Voice Output**: Enable the speaker button to hear responses
5. **Select Tools**: Click on MCP agents in the right panel to enable them
6. **Record Audio**: 
   - Use the recording section to record meetings
   - Live transcription appears automatically during recording
   - Recordings are saved as timestamped `.webm` files
7. **Transcribe Audio Files**:
   - Load an audio file (MP3, WAV, etc.)
   - Click the "Transcript" button to transcribe
   - Transcripts are saved as `.transcript.json` files matching the audio filename
8. **Query Transcripts**: Use natural language to search transcripts:
   - "show the latest transcript"
   - "find sentences where 'keyword' is mentioned"
   - "summarize the transcript file 'filename.json'"
9. **Scratchpad**: Write notes in the bottom-left section
10. **Settings**: Click the settings icon to configure models and API keys

## Model status, device, and memory

- The header shows readiness like: `ollama app model qwen2.5:1.5b is ready. GPU - 2.61GB VRAM`
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
- "summarize the content of the transcript file 'file.json'"
- "show the latest transcript"

## License

MIT

