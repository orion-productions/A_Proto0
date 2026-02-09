import React, { useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import CenterPanel from './components/CenterPanel';
import RightPanel from './components/RightPanel';
import SettingsModal from './components/SettingsModal';
import useStore from './store/useStore';
import { api } from './api/api';
import { t } from './utils/i18n';

function App() {
  const { panelSizes, setPanelSizes, setChats, setMcpTools, setAvailableModels, setOllamaStatus, selectedModel, showSettings, fontScaleFactor, selectedLanguage, availableModels } = useStore();
  const progressIntervalRef = useRef(null);
  const progressRef = useRef(0);
  const pollModelReady = async (modelName, attempts = 6, delayMs = 3000) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const status = await api.getOllamaStatus();
        const modelInfo = status.modelsRunning?.find(m => m.name === modelName);
        if (modelInfo) return modelInfo;
      } catch (e) {
        console.warn('pollModelReady status check failed:', e);
      }
      await new Promise(res => setTimeout(res, delayMs));
    }
    return null;
  };

  useEffect(() => {
    // Load initial data and check Ollama
    const loadData = async () => {
      try {
        setOllamaStatus({ state: 'starting', message: '', messageKey: 'ollama.app.starting', messageParams: {}, progress: 0 });
        const [chats, tools, models] = await Promise.all([
          api.getChats(),
          api.getMCPTools(),
          api.getModels()
        ]);
        
        // Apply saved order from localStorage BEFORE setting chats
        const savedOrder = localStorage.getItem('chatOrder');
        if (savedOrder) {
          const savedOrderArray = JSON.parse(savedOrder);
          const orderedChats = [...chats].sort((a, b) => {
            const indexA = savedOrderArray.indexOf(a.id);
            const indexB = savedOrderArray.indexOf(b.id);
            if (indexA === -1) return 1; // Not in saved order, put at end
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
          console.log('🔄 App.jsx: Applying saved order', orderedChats.map(c => c.id));
          setChats(orderedChats);
        } else {
          // No saved order - save current backend order as initial
          const initialOrder = chats.map(c => c.id);
          localStorage.setItem('chatOrder', JSON.stringify(initialOrder));
          console.log('💾 App.jsx: Saved initial order', initialOrder);
          setChats(chats);
        }
        setMcpTools(tools);
        setAvailableModels(models);

        // Check Ollama availability (no warmup here - will be handled by selectedModel useEffect)
        try {
          await api.getOllamaStatus();
          // Set idle state - warmup will be triggered when selectedModel is ready
          setOllamaStatus({ state: 'idle', message: '', messageKey: null, messageParams: {}, progress: 0 });
        } catch (statusErr) {
          setOllamaStatus({ state: 'error', message: '', messageKey: 'ollama.not.found', messageParams: {}, progress: 0 });
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setOllamaStatus({ state: 'error', message: '', messageKey: 'ollama.not.found', messageParams: {}, progress: 0 });
      }
    };
    loadData();
  }, []);

  // Warm up when model changes (only if models are available to prevent race conditions)
  useEffect(() => {
    const warm = async () => {
      // Only warmup if we have models available (prevents race conditions during app initialization)
      if (!selectedModel || availableModels.length === 0) {
        return;
      }
      try {
        // Start loading with progress tracking
        progressRef.current = 0;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = setInterval(() => {
          progressRef.current = Math.min(progressRef.current + Math.random() * 15, 95); // Cap at 95% until done
          setOllamaStatus({ state: 'loading', message: '', messageKey: 'ollama.model.loading', messageParams: { model: selectedModel }, progress: Math.round(progressRef.current) });
        }, 200);
        
        setOllamaStatus({ state: 'loading', message: '', messageKey: 'ollama.model.loading', messageParams: { model: selectedModel }, progress: 0 });
        
        // Add timeout to warmup (2 minutes)
        const warmupPromise = api.warmupModel(selectedModel);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Warmup timeout - model may still be loading')), 120000)
        );
        
        try {
          const warmupResult = await Promise.race([warmupPromise, timeoutPromise]);
          console.log('Warmup result:', warmupResult);
          
          // Verify model is actually loaded and get device/memory info
          let device = 'CPU';
          let sizeGB = 0;
          try {
            const status = await api.getOllamaStatus();
            console.log('Status response:', status);
            const modelInfo = status.modelsRunning?.find(m => m.name === selectedModel);
            console.log('Model info from status:', modelInfo);
            if (modelInfo) {
              device = modelInfo.device || 'CPU';
              sizeGB = modelInfo.sizeGB || 0;
              console.log(`Model ${selectedModel} confirmed loaded on ${device}, size: ${sizeGB}GB`);
            } else if (warmupResult) {
              // Fallback to warmup result if status doesn't have the info
              device = warmupResult.device || 'CPU';
              sizeGB = warmupResult.sizeGB || 0;
              console.log(`Using warmup result - device: ${device}, sizeGB: ${sizeGB}`);
            }
          } catch (statusError) {
            console.warn('Could not verify model status:', statusError);
            // Fallback to warmup result
            if (warmupResult) {
              device = warmupResult.device || 'CPU';
              sizeGB = warmupResult.sizeGB || 0;
              console.log(`Fallback to warmup result - device: ${device}, sizeGB: ${sizeGB}`);
            }
          }
          
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          
          // Format device and memory info
          console.log(`Final values - device: ${device}, sizeGB: ${sizeGB}`);
          const deviceInfo = sizeGB > 0 ? `${device} - ${sizeGB}GB` : device;
          setOllamaStatus({ state: 'ready', message: '', messageKey: 'ollama.model.ready', messageParams: { model: selectedModel, deviceInfo }, progress: 100 });
        } catch (warmupError) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          // If timeout, model might still be loading in background - show warning but continue
          if (warmupError.message.includes('timeout')) {
            console.warn('Warmup timed out, but model may still be loading');
            setOllamaStatus({ state: 'loading', message: '', messageKey: 'ollama.model.loading.long', messageParams: { model: selectedModel }, progress: 95 });
          } else {
            throw warmupError;
          }
        }
      } catch (error) {
        console.error('Warmup error:', error);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setOllamaStatus({ state: 'error', message: '', messageKey: 'ollama.not.found', messageParams: {}, progress: 0 });
      }
    };
    if (selectedModel) {
      warm();
    }
  }, [selectedModel, availableModels]);

  const handlePanelResize = (sizes) => {
    setPanelSizes(sizes);
  };

  // Apply font scale factor to root element
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', fontScaleFactor.toString());
  }, [fontScaleFactor]);

  return (
    <div className="h-screen w-screen bg-gray-900 text-white">
      <PanelGroup direction="vertical">
        <Panel defaultSize={10} minSize={8} maxSize={15}>
          <Header />
        </Panel>
        
        <PanelResizeHandle className="h-1 bg-gray-700 hover:bg-blue-500 transition-colors" />
        
        <Panel defaultSize={90} minSize={85}>
          <div className="h-full overflow-hidden">
            <PanelGroup direction="horizontal" onLayout={handlePanelResize}>
              <Panel defaultSize={panelSizes[0]} minSize={15}>
                <LeftPanel />
              </Panel>
              
              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors" />
              
              <Panel defaultSize={panelSizes[1]} minSize={30}>
                <CenterPanel />
              </Panel>
              
              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-blue-500 transition-colors" />
              
              <Panel defaultSize={panelSizes[2]} minSize={20}>
                <RightPanel />
              </Panel>
            </PanelGroup>
          </div>
        </Panel>
      </PanelGroup>
      
      {showSettings && <SettingsModal />}
    </div>
  );
}

export default App;

