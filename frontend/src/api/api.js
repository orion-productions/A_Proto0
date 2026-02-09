import axios from 'axios';

const API_BASE_URL = '/api';

export const api = {
  // Chats
  getChats: async () => {
    const response = await axios.get(`${API_BASE_URL}/chats`);
    return response.data;
  },
  
  createChat: async (title) => {
    const response = await axios.post(`${API_BASE_URL}/chats`, { title });
    return response.data;
  },
  
  deleteChat: async (chatId) => {
    const response = await axios.delete(`${API_BASE_URL}/chats/${chatId}`);
    return response.data;
  },
  
  updateChat: async (chatId, title) => {
    const response = await axios.put(`${API_BASE_URL}/chats/${chatId}`, { title });
    return response.data;
  },
  
  getMessages: async (chatId) => {
    const response = await axios.get(`${API_BASE_URL}/chats/${chatId}/messages`);
    return response.data;
  },
  
  addMessage: async (chatId, role, content) => {
    const response = await axios.post(`${API_BASE_URL}/chats/${chatId}/messages`, {
      role,
      content
    });
    return response.data;
  },
  
  // LLM with tool calling support
  chatWithLLM: async (model, messages, provider = 'ollama', onChunk, onToolCall, ollamaSettings = {}) => {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout (for tool-heavy queries like Perforce)

    try {
      const response = await fetch(`${API_BASE_URL}/llm/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          model, 
          messages, 
          provider, 
          enableTools: true,
          // Pass Ollama advanced settings
          thinking: ollamaSettings.thinking ?? false,
          temperature: ollamaSettings.temperature ?? 0.1,
          caching: ollamaSettings.caching ?? true,
          tokensLimit: ollamaSettings.tokensLimit ?? 1536,
          verboseLevel: ollamaSettings.verboseLevel ?? 1
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return fullResponse;
            }
            try {
              const parsed = JSON.parse(data);

              // Handle different event types
              if (parsed.type === 'tool_call' && onToolCall) {
                onToolCall({ type: 'call', tool: parsed.tool, params: parsed.params });
              } else if (parsed.type === 'tool_result' && onToolCall) {
                onToolCall({ type: 'result', tool: parsed.tool, result: parsed.result });
              } else if (parsed.type === 'final_response' && onToolCall) {
                onToolCall({ type: 'final' });
              } else if (parsed.type === 'internal_thinking' && onToolCall) {
                onToolCall({ type: 'internal_thinking', thinking: parsed.thinking });
              } else if (parsed.content) {
                fullResponse += parsed.content;
                if (onChunk) onChunk(parsed.content);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return fullResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. The AI model is taking too long to respond. Please try again or use a simpler question.');
      }
      throw error;
    }
  },
  
  getModels: async () => {
    const response = await axios.get(`${API_BASE_URL}/llm/models`);
    return response.data;
  },

  getOllamaStatus: async () => {
    const response = await axios.get(`${API_BASE_URL}/llm/status`);
    return response.data;
  },

  warmupModel: async (model) => {
    const response = await axios.post(`${API_BASE_URL}/llm/warmup`, { model }, {
      timeout: 120000 // 2 minutes timeout
    });
    return response.data;
  },
  
  // MCP Tools
  getMCPTools: async () => {
    const response = await axios.get(`${API_BASE_URL}/mcp/tools`);
    return response.data;
  },
  
  callMCPTool: async (toolId, params) => {
    const response = await axios.post(`${API_BASE_URL}/mcp/tools/${toolId}`, params);
    return response.data;
  },
  
  // Audio transcription - Now handled entirely client-side using Web Speech API
  // This is kept for compatibility but transcription happens in browser
  transcribeAudio: async (audioBlob, onProgress) => {
    // Note: Actual transcription is now done client-side using Web Speech API
    // No backend call needed - see frontend/src/utils/speechToText.js
    // This function is kept for API compatibility
    return { message: 'Use transcribeAudioFile from speechToText.js instead' };
  },

  // Transcripts
  saveTranscript: async (title, transcriptText, audioFileName = null, duration = null) => {
    const response = await axios.post(`${API_BASE_URL}/transcripts`, {
      title,
      transcript_text: transcriptText,
      audio_file_name: audioFileName,
      duration
    });
    return response.data;
  },

  getTranscripts: async () => {
    const response = await axios.get(`${API_BASE_URL}/transcripts`);
    return response.data;
  },

  getTranscript: async (transcriptId) => {
    const response = await axios.get(`${API_BASE_URL}/transcripts/${transcriptId}`);
    return response.data;
  },

    deleteTranscript: async (transcriptId) => {
      const response = await axios.delete(`${API_BASE_URL}/transcripts/${transcriptId}`);
      return response.data;
    },

    // Whisper transcription (backend)
    transcribeWithWhisper: async (audioBlob, fileName) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName);

      const response = await axios.post(`${API_BASE_URL}/transcribe-whisper`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    },

    // Scratchpad operations
    getScratchpad: async () => {
      const response = await axios.get(`${API_BASE_URL}/scratchpad`);
      return response.data.content || '';
    },

    saveScratchpad: async (content) => {
      const response = await axios.post(`${API_BASE_URL}/scratchpad`, { content });
      return response.data;
    }
  };