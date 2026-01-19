import React from 'react';
import { Bot, Check } from 'lucide-react';
import useStore from '../store/useStore';
import { useTranslation, translateToolDescription } from '../utils/i18n';

// Memoize to prevent unnecessary re-renders
const AgentSection = React.memo(() => {
  const { mcpTools, selectedTools, activeTools, toggleTool, selectedLanguage } = useStore();
  const t = useTranslation(selectedLanguage);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-gray-750 font-semibold border-b border-gray-700 flex items-center gap-2">
        <Bot size={18} style={{ width: '1.125rem', height: '1.125rem' }} />
        {t('mcp.agents')}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {mcpTools.length === 0 ? (
          <div className="text-gray-500 text-center p-4 text-sm">
            {t('no.agents.available')}
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
                  <div className="flex items-center justify-between gap-2" title={`${tool.name} — ${translateToolDescription(tool.description, selectedLanguage)}`}>
                    <div className="flex-1 min-w-0 text-xs text-gray-100 flex items-center gap-2">
                      <span className="font-semibold">{tool.name}</span>
                      <span className="text-gray-300 truncate" style={{ fontSize: '0.6875rem' }}>{translateToolDescription(tool.description, selectedLanguage)}</span>
                      {isActive && <span style={{ fontSize: '0.6875rem' }}>🔧 {t('active')}</span>}
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
});

AgentSection.displayName = 'AgentSection';

export default AgentSection;

