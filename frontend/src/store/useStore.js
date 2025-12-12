import { create } from 'zustand';

const useStore = create((set, get) => ({
  // UI State
  micEnabled: false,
  speakerEnabled: false,
  selectedLanguage: 'en',
  showSettings: false,
  
  // Panel sizes (persisted)
  panelSizes: JSON.parse(localStorage.getItem('panelSizes') || '[20, 50, 30]'),
  leftPanelSizes: JSON.parse(localStorage.getItem('leftPanelSizes') || '[70, 30]'),
  rightPanelSizes: JSON.parse(localStorage.getItem('rightPanelSizes') || '[40, 30, 30]'),
  
  // Chat state
  chats: [],
  currentChatId: null,
  messages: [],
  isLoading: false,
  
  // Scratchpad
  scratchpadContent: localStorage.getItem('scratchpad') || '',
  
  // LLM state
  selectedModel: localStorage.getItem('selectedModel') || 'qwen2.5:1.5b',
  availableModels: [],
  ollamaStatus: { state: 'idle', message: '', progress: 0 },
  
  // MCP Tools
  mcpTools: [],
  selectedTools: JSON.parse(localStorage.getItem('selectedTools') || '[]'),
  
  // Audio recording
  isRecording: false,
  recordedAudio: null,
  
  // Actions
  setMicEnabled: (enabled) => set({ micEnabled: enabled }),
  setSpeakerEnabled: (enabled) => set({ speakerEnabled: enabled }),
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
  setShowSettings: (show) => set({ showSettings: show }),
  
  setPanelSizes: (sizes) => {
    localStorage.setItem('panelSizes', JSON.stringify(sizes));
    set({ panelSizes: sizes });
  },
  setLeftPanelSizes: (sizes) => {
    localStorage.setItem('leftPanelSizes', JSON.stringify(sizes));
    set({ leftPanelSizes: sizes });
  },
  setRightPanelSizes: (sizes) => {
    localStorage.setItem('rightPanelSizes', JSON.stringify(sizes));
    set({ rightPanelSizes: sizes });
  },
  
  setChats: (chats) => set({ chats }),
  setCurrentChatId: (id) => set({ currentChatId: id }),
  setMessages: (messages) => set({ messages }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  setScratchpadContent: (content) => {
    localStorage.setItem('scratchpad', content);
    set({ scratchpadContent: content });
  },
  
  setSelectedModel: (model) => {
    localStorage.setItem('selectedModel', model);
    set({ selectedModel: model });
  },
  
  setAvailableModels: (models) => set({ availableModels: models }),
  setMcpTools: (tools) => set({ mcpTools: tools }),
  setOllamaStatus: (status) => set({ ollamaStatus: status }),
  
  setSelectedTools: (tools) => {
    localStorage.setItem('selectedTools', JSON.stringify(tools));
    set({ selectedTools: tools });
  },
  
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordedAudio: (audio) => set({ recordedAudio: audio }),
  
  // Active tools (currently being used)
  activeTools: [],
  setActiveTool: (toolId) => set((state) => ({
    activeTools: [...new Set([...state.activeTools, toolId])]
  })),
  clearActiveTool: (toolId) => set((state) => ({
    activeTools: state.activeTools.filter(id => id !== toolId)
  })),
  clearAllActiveTools: () => set({ activeTools: [] }),
  
  // Helper actions
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  toggleTool: (toolId) => set((state) => {
    const newTools = state.selectedTools.includes(toolId)
      ? state.selectedTools.filter(id => id !== toolId)
      : [...state.selectedTools, toolId];
    localStorage.setItem('selectedTools', JSON.stringify(newTools));
    return { selectedTools: newTools };
  })
}));

export default useStore;

