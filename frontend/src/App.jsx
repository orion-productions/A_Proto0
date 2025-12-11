import React, { useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import CenterPanel from './components/CenterPanel';
import RightPanel from './components/RightPanel';
import SettingsModal from './components/SettingsModal';
import useStore from './store/useStore';
import { api } from './api/api';

function App() {
  const { panelSizes, setPanelSizes, setChats, setMcpTools, setAvailableModels, setOllamaStatus, selectedModel, showSettings } = useStore();
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
        setOllamaStatus({ state: 'starting', message: 'ollama app starting', progress: 0 });
        const [chats, tools, models] = await Promise.all([
          api.getChats(),
          api.getMCPTools(),
          api.getModels()
        ]);
        setChats(chats);
        setMcpTools(tools);
        setAvailableModels(models);

        // Check Ollama availability before warmup
        try {
          await api.getOllamaStatus();
        } catch (statusErr) {
          if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setOllamaStatus({ state: 'error', message: 'Ollama not found', progress: 0 });
          return;
        }

        // Start loading with progress tracking
        progressRef.current = 0;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = setInterval(() => {
          progressRef.current = Math.min(progressRef.current + Math.random() * 15, 95); // Cap at 95% until done
          setOllamaStatus({ state: 'loading', message: `ollama app model ${selectedModel} is loading`, progress: Math.round(progressRef.current) });
        }, 200);
        
        setOllamaStatus({ state: 'loading', message: `ollama app model ${selectedModel} is loading`, progress: 0 });
        
        // Add timeout to warmup (60 seconds)
        const warmupPromise = api.warmupModel(selectedModel);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Warmup timeout - model may still be loading')), 60000)
        );
        
        try {
          const warmupResult = await Promise.race([warmupPromise, timeoutPromise]);
          console.log('Warmup result:', warmupResult);
          
          // Verify model is actually loaded and get device/memory info (poll to avoid 95% hang)
          let device = 'CPU';
          let sizeGB = 0;
          let memoryType = 'RAM';
          let modelInfo = null;
          try {
            modelInfo = await pollModelReady(selectedModel, 6, 2000);
            console.log('Polled model info:', modelInfo);
            if (modelInfo) {
              device = modelInfo.device || 'CPU';
              sizeGB = modelInfo.sizeGB || 0;
              memoryType = modelInfo.memoryType || (device === 'GPU' ? 'VRAM' : 'RAM');
              console.log(`Model ${selectedModel} confirmed loaded on ${device}, size: ${sizeGB}GB, memoryType: ${memoryType}`);
            } else if (warmupResult) {
              device = warmupResult.device || 'CPU';
              sizeGB = warmupResult.sizeGB || 0;
              memoryType = warmupResult.memoryType || (device === 'GPU' ? 'VRAM' : 'RAM');
              console.log(`Using warmup result - device: ${device}, sizeGB: ${sizeGB}, memoryType: ${memoryType}`);
            }
          } catch (statusError) {
            console.warn('Could not verify model status:', statusError);
            if (warmupResult) {
              device = warmupResult.device || 'CPU';
              sizeGB = warmupResult.sizeGB || 0;
              memoryType = warmupResult.memoryType || (device === 'GPU' ? 'VRAM' : 'RAM');
              console.log(`Fallback to warmup result - device: ${device}, sizeGB: ${sizeGB}, memoryType: ${memoryType}`);
            }
          }
          
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          
          const memLabel = sizeGB > 0 ? `${sizeGB}GB${memoryType ? ` ${memoryType}` : ''}` : '';
          const deviceInfo = sizeGB > 0 ? `${device} - ${memLabel}` : device;
          
          if (sizeGB > 0 || modelInfo) {
            setOllamaStatus({ state: 'ready', message: `ollama model ${selectedModel} is ready. ${deviceInfo}`, progress: 100 });
          } else {
            // No confirmation from status; mark as error to avoid hanging at 95%
            setOllamaStatus({ state: 'error', message: `Model ${selectedModel} did not report ready. Check Ollama logs or GPU.`, progress: 0 });
          }
        } catch (warmupError) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          const errorMsg = warmupError.response?.data?.error || warmupError.message || 'Warmup failed';
          console.warn('Warmup failed:', errorMsg);
          setOllamaStatus({ state: 'error', message: `Warmup failed: ${errorMsg}`, progress: 0 });
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setOllamaStatus({ state: 'error', message: 'Ollama not found', progress: 0 });
      }
    };
    loadData();
  }, []);

  // Warm up when model changes
  useEffect(() => {
    const warm = async () => {
      try {
        // Start loading with progress tracking
        progressRef.current = 0;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = setInterval(() => {
          progressRef.current = Math.min(progressRef.current + Math.random() * 15, 95); // Cap at 95% until done
          setOllamaStatus({ state: 'loading', message: `ollama app model ${selectedModel} is loading`, progress: Math.round(progressRef.current) });
        }, 200);
        
        setOllamaStatus({ state: 'loading', message: `ollama app model ${selectedModel} is loading`, progress: 0 });
        
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
          setOllamaStatus({ state: 'ready', message: `ollama model ${selectedModel} is ready. ${deviceInfo}`, progress: 100 });
        } catch (warmupError) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          // If timeout, model might still be loading in background - show warning but continue
          if (warmupError.message.includes('timeout')) {
            console.warn('Warmup timed out, but model may still be loading');
            setOllamaStatus({ state: 'loading', message: `ollama app model ${selectedModel} is loading (this may take a while...)`, progress: 95 });
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
        setOllamaStatus({ state: 'error', message: 'Ollama not found', progress: 0 });
      }
    };
    if (selectedModel) {
      warm();
    }
  }, [selectedModel]);

  const handlePanelResize = (sizes) => {
    setPanelSizes(sizes);
  };

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

