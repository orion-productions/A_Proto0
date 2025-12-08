import React from 'react';
import { Bot, Check } from 'lucide-react';
import useStore from '../store/useStore';

function AgentSection() {
  const { mcpTools, selectedTools, activeTools, toggleTool } = useStore();
  
  // Debug logging
  console.log('AgentSection render - activeTools:', activeTools);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-gray-750 font-semibold border-b border-gray-700 flex items-center gap-2">
        <Bot size={18} />
        MCP Agents
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {mcpTools.length === 0 ? (
          <div className="text-gray-500 text-center p-4 text-sm">
            No agents available
          </div>
        ) : (
          <div className="space-y-2">
            {mcpTools.map(tool => {
              const isActive = activeTools.includes(tool.id);
              const isSelected = selectedTools.includes(tool.id);
              
              return (
                <div
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-600 hover:bg-blue-700 animate-pulse'
                      : isSelected
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {tool.name}
                        {isActive && <span className="text-xs">🔧 Active</span>}
                      </div>
                      <div className="text-xs text-gray-300 mt-1">{tool.description}</div>
                    </div>
                    {isSelected && (
                      <Check size={18} className="ml-2 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentSection;

