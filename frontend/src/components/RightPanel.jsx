import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import AgentSection from './AgentSection';
import RecordingSection from './RecordingSection';
import ThreeDWindow from './ThreeDWindow';
import useStore from '../store/useStore';

function RightPanel() {
  const { rightPanelSizes, setRightPanelSizes } = useStore();

  return (
    <div className="h-full bg-gray-800">
      <PanelGroup direction="vertical" onLayout={setRightPanelSizes}>
        <Panel defaultSize={rightPanelSizes[0]} minSize={20}>
          <div className="h-full overflow-hidden">
            <AgentSection />
          </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

        <Panel defaultSize={rightPanelSizes[1]} minSize={20}>
          <div className="h-full overflow-hidden">
            <RecordingSection />
          </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

        <Panel defaultSize={rightPanelSizes[2]} minSize={20}>
          <div className="h-full overflow-hidden">
            <ThreeDWindow />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default RightPanel;

