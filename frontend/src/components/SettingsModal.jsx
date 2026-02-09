import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import useStore from '../store/useStore';
import { useTranslation } from '../utils/i18n';

function SettingsModal() {
  const {
    selectedModel,
    availableModels,
    modelUsage,
    setSelectedModel,
    setShowSettings,
    fontScaleFactor,
    setFontScaleFactor,
    voiceGender,
    setVoiceGender,
    ollamaThinking,
    setOllamaThinking,
    ollamaTemperature,
    setOllamaTemperature,
    ollamaCaching,
    setOllamaCaching,
    showInternalReasoning,
    setShowInternalReasoning,
    tokensLimit,
    setTokensLimit,
    verboseLevel,
    setVerboseLevel,
    settingsWindowPosition,
    settingsWindowSize,
    setSettingsWindowPosition,
    setSettingsWindowSize,
    selectedLanguage
  } = useStore();
  
  const t = useTranslation(selectedLanguage);

  const DEFAULT_MODEL = 'qwen2.5:1.5b';
  
  // Tab state
  const [activeTab, setActiveTab] = useState('ui'); // 'ui' or 'llm'

  // Sort models: default first, then by usage, then alphabetically
  const sortedModels = React.useMemo(() => {
    // Get all unique models (from availableModels + default)
    const allModels = new Set([DEFAULT_MODEL, ...availableModels.map(m => m.name)]);
    
    // Convert to array and sort
    const sorted = Array.from(allModels).sort((a, b) => {
      // Default model always first
      if (a === DEFAULT_MODEL) return -1;
      if (b === DEFAULT_MODEL) return 1;
      
      // Sort by usage count (descending)
      const usageA = modelUsage[a] || 0;
      const usageB = modelUsage[b] || 0;
      if (usageA !== usageB) return usageB - usageA;
      
      // If usage is equal, sort alphabetically
      return a.localeCompare(b);
    });
    
    return sorted;
  }, [availableModels, modelUsage]);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(null); // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const modalRef = useRef(null);
  const headerRef = useRef(null);

  // Initialize position on mount (center if not set)
  useEffect(() => {
    if (settingsWindowPosition.x === 0 && settingsWindowPosition.y === 0) {
      const centerX = (window.innerWidth - settingsWindowSize.width) / 2;
      const centerY = (window.innerHeight - settingsWindowSize.height) / 2;
      setSettingsWindowPosition({ x: centerX, y: centerY });
    }
  }, []);

  // Handle dragging
  const handleMouseDown = (e) => {
    if (e.target === headerRef.current || headerRef.current?.contains(e.target)) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - settingsWindowPosition.x,
        y: e.clientY - settingsWindowPosition.y
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        // Constrain to viewport
        const maxX = window.innerWidth - settingsWindowSize.width;
        const maxY = window.innerHeight - settingsWindowSize.height;
        setSettingsWindowPosition({
          x: Math.max(0, Math.min(maxX, newX)),
          y: Math.max(0, Math.min(maxY, newY))
        });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = settingsWindowPosition.x;
        let newY = settingsWindowPosition.y;

        // Minimum size
        const minWidth = 400;
        const minHeight = 300;

        if (isResizing.includes('e')) {
          newWidth = Math.max(minWidth, resizeStart.width + deltaX);
        }
        if (isResizing.includes('w')) {
          newWidth = Math.max(minWidth, resizeStart.width - deltaX);
          newX = settingsWindowPosition.x + (resizeStart.width - newWidth);
        }
        if (isResizing.includes('s')) {
          newHeight = Math.max(minHeight, resizeStart.height + deltaY);
        }
        if (isResizing.includes('n')) {
          newHeight = Math.max(minHeight, resizeStart.height - deltaY);
          newY = settingsWindowPosition.y + (resizeStart.height - newHeight);
        }

        // Constrain to viewport
        if (newX < 0) {
          newWidth += newX;
          newX = 0;
        }
        if (newY < 0) {
          newHeight += newY;
          newY = 0;
        }
        if (newX + newWidth > window.innerWidth) {
          newWidth = window.innerWidth - newX;
        }
        if (newY + newHeight > window.innerHeight) {
          newHeight = window.innerHeight - newY;
        }

        setSettingsWindowSize({ width: newWidth, height: newHeight });
        setSettingsWindowPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, settingsWindowPosition, settingsWindowSize, setSettingsWindowPosition, setSettingsWindowSize]);

  const handleResizeStart = (direction) => (e) => {
    e.stopPropagation();
    setIsResizing(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: settingsWindowSize.width,
      height: settingsWindowSize.height
    });
  };

  const resizeHandleStyle = {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 10
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
      <div
        ref={modalRef}
        className="bg-gray-800 rounded-lg overflow-hidden flex flex-col"
        style={{
          position: 'absolute',
          left: `${settingsWindowPosition.x}px`,
          top: `${settingsWindowPosition.y}px`,
          width: `${settingsWindowSize.width}px`,
          height: `${settingsWindowSize.height}px`,
          maxWidth: '90vw',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Resize handles */}
        <div
          style={{ ...resizeHandleStyle, top: 0, left: 0, right: 0, height: '4px', cursor: 'ns-resize' }}
          onMouseDown={handleResizeStart('n')}
        />
        <div
          style={{ ...resizeHandleStyle, bottom: 0, left: 0, right: 0, height: '4px', cursor: 'ns-resize' }}
          onMouseDown={handleResizeStart('s')}
        />
        <div
          style={{ ...resizeHandleStyle, top: 0, bottom: 0, left: 0, width: '4px', cursor: 'ew-resize' }}
          onMouseDown={handleResizeStart('w')}
        />
        <div
          style={{ ...resizeHandleStyle, top: 0, bottom: 0, right: 0, width: '4px', cursor: 'ew-resize' }}
          onMouseDown={handleResizeStart('e')}
        />
        <div
          style={{ ...resizeHandleStyle, top: 0, left: 0, width: '8px', height: '8px', cursor: 'nwse-resize' }}
          onMouseDown={handleResizeStart('nw')}
        />
        <div
          style={{ ...resizeHandleStyle, top: 0, right: 0, width: '8px', height: '8px', cursor: 'nesw-resize' }}
          onMouseDown={handleResizeStart('ne')}
        />
        <div
          style={{ ...resizeHandleStyle, bottom: 0, left: 0, width: '8px', height: '8px', cursor: 'nesw-resize' }}
          onMouseDown={handleResizeStart('sw')}
        />
        <div
          style={{ ...resizeHandleStyle, bottom: 0, right: 0, width: '8px', height: '8px', cursor: 'nwse-resize' }}
          onMouseDown={handleResizeStart('se')}
        />

        {/* Header - draggable */}
        <div
          ref={headerRef}
          className="border-b border-gray-700"
          onMouseDown={handleMouseDown}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: '16px', cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <h2 className="text-xl font-bold">{t('settings.title')}</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="hover:bg-gray-700 rounded-lg transition-colors"
              style={{ padding: '8px', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex border-t border-gray-700">
            <button
              onClick={() => setActiveTab('ui')}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
                activeTab === 'ui'
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
            >
              User Interface
            </button>
            <button
              onClick={() => setActiveTab('llm')}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
                activeTab === 'llm'
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
            >
              LLM Settings
            </button>
          </div>
        </div>

        {/* Content - scrollable */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', flex: 1 }}>
          
          {/* USER INTERFACE TAB */}
          {activeTab === 'ui' && (
            <>
              {/* Show Internal Reasoning */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInternalReasoning}
                    onChange={(e) => setShowInternalReasoning(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold">Show Internal Reasoning</span>
                    <p className="text-xs text-gray-400" style={{ marginTop: '4px' }}>
                      Display model's internal thought process in light grey (for debugging)
                    </p>
                  </div>
                </label>
              </div>

              {/* Font Scale Factor */}
              <div>
                <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>
                  {t('font.scale.factor')}: {fontScaleFactor.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  value={fontScaleFactor}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setFontScaleFactor(value);
                  }}
                  className="w-full bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  style={{ height: '8px' }}
                />
                <div className="flex justify-between text-xs text-gray-400" style={{ marginTop: '4px' }}>
                  <span>1.0x</span>
                  <span>5.0x</span>
                </div>
                <p className="text-xs text-gray-400" style={{ marginTop: '8px' }}>
                  {t('font.scale.description')}
                </p>
              </div>

              {/* Voice Gender Selection */}
              <div>
                <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>{t('voice.gender')}</label>
                <select
                  value={voiceGender}
                  onChange={(e) => setVoiceGender(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '8px 12px' }}
                >
                  <option value="feminine">{t('voice.feminine')}</option>
                  <option value="masculine">{t('voice.masculine')}</option>
                </select>
                <p className="text-xs text-gray-400" style={{ marginTop: '8px' }}>
                  {t('voice.gender.description')}
                </p>
              </div>

              {/* About */}
              <div className="border-t border-gray-700" style={{ paddingTop: '16px' }}>
                <h3 className="font-semibold" style={{ marginBottom: '8px' }}>{t('about')}</h3>
                <p className="text-sm text-gray-400">
                  {t('about.text')}
                </p>
              </div>
            </>
          )}

          {/* LLM SETTINGS TAB */}
          {activeTab === 'llm' && (
            <>
              {/* LLM Model Selection */}
              <div>
                <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>{t('llm.model')}</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '8px 12px' }}
                >
                  {sortedModels.map(modelName => {
                    const isDefault = modelName === DEFAULT_MODEL;
                    const usage = modelUsage[modelName] || 0;
                    const displayText = isDefault 
                      ? `${modelName} (Default${usage > 0 ? `, ${usage} uses` : ''})` 
                      : usage > 0 
                        ? `${modelName} (${usage} uses)` 
                        : modelName;
                    
                    return (
                      <option key={modelName} value={modelName}>
                        {displayText}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-400" style={{ marginTop: '8px' }}>
                  {t('current.model')}: {selectedModel}
                </p>
              </div>

              {/* Ollama Temperature */}
              <div>
                <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>
                  Temperature: <span className="text-blue-400">{ollamaTemperature.toFixed(2)}</span>
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">0.0</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={ollamaTemperature}
                    onChange={(e) => setOllamaTemperature(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(ollamaTemperature / 2) * 100}%, #374151 ${(ollamaTemperature / 2) * 100}%, #374151 100%)`
                    }}
                  />
                  <span className="text-xs text-gray-400">2.0</span>
                </div>
                <p className="text-xs text-gray-400" style={{ marginTop: '8px' }}>
                  Controls creativity: 0.0 = deterministic, 1.0 = balanced, 2.0 = maximum randomness
                </p>
              </div>

              {/* Ollama Caching */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ollamaCaching}
                    onChange={(e) => setOllamaCaching(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold">Enable Caching</span>
                    <p className="text-xs text-gray-400" style={{ marginTop: '4px' }}>
                      Keep model loaded in memory for faster responses (uses more RAM/VRAM)
                    </p>
                  </div>
                </label>
              </div>

              {/* Ollama Thinking Mode */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ollamaThinking}
                    onChange={(e) => setOllamaThinking(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold">Enable Thinking Mode</span>
                    <p className="text-xs text-gray-400" style={{ marginTop: '4px' }}>
                      Show reasoning process before final answer (increases response time)
                    </p>
                  </div>
                </label>
              </div>

              {/* Tokens Limit */}
              <div>
                <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>
                  Tokens Limit: <span className="text-blue-400">{tokensLimit}</span>
                </label>
                <select
                  value={tokensLimit}
                  onChange={(e) => setTokensLimit(parseInt(e.target.value, 10))}
                  className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '8px 12px' }}
                >
                  <option value={512}>512 tokens (Fast, may cut off complex responses)</option>
                  <option value={1024}>1024 tokens (Balanced)</option>
                  <option value={1536}>1536 tokens (Recommended)</option>
                  <option value={2048}>2048 tokens (Maximum, slower)</option>
                </select>
                <p className="text-xs text-gray-400" style={{ marginTop: '8px' }}>
                  Maximum tokens for LLM responses after tool execution. Higher = more complete but slower.
                </p>
              </div>

              {/* Verbose Level */}
              <div>
                <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>
                  Verbose Level: <span className="text-blue-400">{['Fast', 'Balanced', 'Quality', 'Precise'][verboseLevel]}</span>
                </label>
                <select
                  value={verboseLevel}
                  onChange={(e) => setVerboseLevel(parseInt(e.target.value, 10))}
                  className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '8px 12px' }}
                >
                  <option value={0}>⚡ Fast - Quick responses, less careful (top_p=0.95, top_k=40)</option>
                  <option value={1}>⚡⚡ Balanced - Good speed + quality (top_p=0.92, top_k=60)</option>
                  <option value={2}>⭐ Quality - Slower, more careful (top_p=0.90, top_k=80)</option>
                  <option value={3}>⭐⭐ Precise - Maximum quality (top_p=0.85, no top_k)</option>
                </select>
                <p className="text-xs text-gray-400" style={{ marginTop: '8px' }}>
                  Controls response generation quality vs speed. Higher = more careful but slower.
                </p>
              </div>

              {/* Ollama Connection */}
              <div>
                <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>{t('ollama.connection')}</label>
                <input
                  type="text"
                  defaultValue="http://localhost:11434"
                  className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '8px 12px' }}
                  placeholder="http://localhost:11434"
                />
                <p className="text-xs text-gray-400" style={{ marginTop: '8px' }}>
                  {t('ollama.connection.hint')}
                </p>
              </div>

              {/* API Keys (Future) */}
              <div>
                <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>{t('api.keys')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder={t('openai.api.key')}
                    className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '8px 12px' }}
                  />
                  <input
                    type="password"
                    placeholder={t('anthropic.api.key')}
                    className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>
            </>
          )}

        </div>

        <div className="border-t border-gray-700 flex justify-end" style={{ padding: '16px' }}>
          <button
            onClick={() => setShowSettings(false)}
            className="bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            style={{ padding: '8px 24px' }}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
