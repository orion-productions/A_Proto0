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
        <Bot size={18} style={{ width: '1.125rem', height: '1.125rem' }} />
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
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-600 hover:bg-blue-700 animate-pulse'
                      : isSelected
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2" title={`${tool.name} — ${tool.description}`}>
                    <div className="flex-1 min-w-0 text-xs text-gray-100 flex items-center gap-2">
                      <span className="font-semibold">{tool.name}</span>
                      <span className="text-gray-300 truncate" style={{ fontSize: '0.6875rem' }}>{tool.description}</span>
                      {isActive && <span style={{ fontSize: '0.6875rem' }}>🔧 Active</span>}
                    </div>
                    {isSelected && (
                      <Check size={14} className="ml-1 flex-shrink-0" style={{ width: '0.875rem', height: '0.875rem' }} />
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

