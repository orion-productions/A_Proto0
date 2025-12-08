import React, { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import CenterPanel from './components/CenterPanel';
import RightPanel from './components/RightPanel';
import SettingsModal from './components/SettingsModal';
import useStore from './store/useStore';
import { api } from './api/api';

function App() {
  const { panelSizes, setPanelSizes, setChats, setMcpTools, setAvailableModels, showSettings } = useStore();

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      try {
        const [chats, tools, models] = await Promise.all([
          api.getChats(),
          api.getMCPTools(),
          api.getModels()
        ]);
        setChats(chats);
        setMcpTools(tools);
        setAvailableModels(models);
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
    loadData();
  }, []);

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

