    # AI Unseen Workspace

A powerful AI-powered workspace with LLM integration, MCP tools, voice controls, and 3D visualization.

## Features

- 🤖 **LLM Integration**: Chat with Ollama models (default: llama3.2:3b)
- 🔧 **MCP Tools**: Weather lookup and calculator tools
- 🎤 **Voice Controls**: Speech-to-text and text-to-speech
- 📝 **Chat Management**: Create, save, and manage multiple chat sessions
- 📋 **Scratchpad**: Auto-saving note-taking area
- 🎙️ **Audio Recording**: Record meetings and transcribe audio
- 🎨 **3D Graphics**: Interactive rotating cube with Three.js
- 💾 **State Persistence**: All settings and chats are saved locally
- 🎯 **Resizable Panels**: Customizable layout with persistent panel sizes

## Prerequisites

- Node.js 18+ and npm
- [Ollama](https://ollama.ai) installed and running
- llama3.2:3b model pulled in Ollama

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
ollama pull llama3.2:3b
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
6. **Record Audio**: Use the recording section to record meetings
7. **Scratchpad**: Write notes in the bottom-left section
8. **Settings**: Click the settings icon to configure models and API keys

## Model status, device, and memory

- The header shows readiness like: `ollama model llama3.2:3b is ready. GPU - 6.77GB VRAM`
- GPU/CPU is inferred from Ollama `/api/ps`; NPU is not exposed by the API (GPU shown when VRAM/gpu layers are present).
- Memory shown is runtime VRAM if on GPU, otherwise RAM; if unavailable, falls back to the model file size.
- API endpoints:
  - `GET /api/llm/status` → version + running models with `device`, `memoryType`, `sizeGB`
  - `POST /api/llm/warmup` → warm a model: `{ "model": "llama3.2:3b" }`
  - `POST /api/llm/stop` → unload a model: `{ "model": "llama3.2:3b" }` (useful to force reload onto GPU)

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: SQLite (for chat history)
- **3D Graphics**: Three.js with @react-three/fiber
- **State Management**: Zustand
- **LLM**: Ollama (local models)

## MCP Tools

The following MCP tools are available:

- **Weather**: Get current weather for any city (uses Open-Meteo API)
- **Add Numbers**: Simple calculator to add two numbers

## License

MIT

