import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import AgentSection from './AgentSection';
import RecordingSection from './RecordingSection';
import ThreeDWindow from './ThreeDWindow';

function RightPanel() {
  return (
    <div className="h-full bg-gray-800">
      <PanelGroup direction="vertical">
        <Panel defaultSize={40} minSize={20}>
          <div className="h-full overflow-hidden">
            <AgentSection />
          </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

        <Panel defaultSize={30} minSize={20}>
          <div className="h-full overflow-hidden">
            <RecordingSection />
          </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

        <Panel defaultSize={30} minSize={20}>
          <div className="h-full overflow-hidden">
            <ThreeDWindow />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default RightPanel;

