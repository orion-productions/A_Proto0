import React, { useState } from 'react';
import { Bot, ChevronDown, ChevronRight } from 'lucide-react';
import useStore from '../store/useStore';
import { useTranslation, translateToolDescription } from '../utils/i18n';

// Memoize to prevent unnecessary re-renders
const AgentSection = React.memo(() => {
  const { mcpTools, activeTools, selectedLanguage } = useStore();
  const t = useTranslation(selectedLanguage);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 bg-gray-750 font-semibold border-b border-gray-700 flex items-center gap-2">
        <Bot size={18} style={{ width: '1.125rem', height: '1.125rem' }} />
        <span>{t('mcp.agents')}</span>
        {activeTools.length > 0 && (
          <span className="text-xs text-blue-400 font-mono animate-blink ml-1">
            🔧 {activeTools.join(', ')}
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {mcpTools.length === 0 ? (
          <div className="text-gray-500 text-center p-4 text-sm">
            {t('no.agents.available')}
          </div>
        ) : (
          <div className="space-y-1">
            {mcpTools.map(category => {
              const isExpanded = expandedCategories.has(category.id);
              const toolCount = category.tools?.length || 0;
              const hasActiveTools = category.tools?.some(tool => 
                activeTools.includes(tool.name)
              );
              
              return (
                <div key={category.id} className="space-y-1">
                  {/* Category Header */}
                  <div
                    onClick={() => toggleCategory(category.id)}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      hasActiveTools
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Chevron Icon */}
                      {isExpanded ? (
                        <ChevronDown size={14} className="flex-shrink-0" style={{ width: '0.875rem', height: '0.875rem' }} />
                      ) : (
                        <ChevronRight size={14} className="flex-shrink-0" style={{ width: '0.875rem', height: '0.875rem' }} />
                      )}
                      
                      {/* Category Name and Count */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-gray-100">
                            {category.name}
                            <span className="text-gray-400 ml-1">({toolCount})</span>
                          </span>
                          {hasActiveTools && (
                            <span className="text-xs animate-pulse">🔧</span>
                          )}
                        </div>
                        <div className="text-gray-300 text-xs truncate" style={{ fontSize: '0.6875rem' }}>
                          {translateToolDescription(category.description, selectedLanguage)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Tool List */}
                  {isExpanded && category.tools && category.tools.length > 0 && (
                    <div className="ml-6 space-y-1">
                      {category.tools.map((tool, index) => {
                        const isActive = activeTools.includes(tool.name);
                        
                        return (
                          <div
                            key={`${category.id}-${tool.name}-${index}`}
                            className={`p-2 rounded-md transition-colors ${
                              isActive
                                ? 'bg-blue-500 animate-pulse'
                                : 'bg-gray-800'
                            }`}
                            title={translateToolDescription(tool.description, selectedLanguage)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-200 font-mono">
                                {tool.name}
                              </span>
                              {isActive && (
                                <span className="text-xs">🔧</span>
                              )}
                            </div>
                            <div className="text-gray-400 text-xs mt-1 truncate" style={{ fontSize: '0.625rem' }}>
                              {translateToolDescription(tool.description, selectedLanguage)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
