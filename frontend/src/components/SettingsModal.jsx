import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import useStore from '../store/useStore';
import { useTranslation } from '../utils/i18n';

function SettingsModal() {
  const {
    selectedModel,
    availableModels,
    setSelectedModel,
    setShowSettings,
    fontScaleFactor,
    setFontScaleFactor,
    voiceGender,
    setVoiceGender,
    settingsWindowPosition,
    settingsWindowSize,
    setSettingsWindowPosition,
    setSettingsWindowSize,
    selectedLanguage
  } = useStore();
  
  const t = useTranslation(selectedLanguage);

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
          className="border-b border-gray-700 flex items-center justify-between"
          style={{ padding: '16px', cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
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

        {/* Content - scrollable */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', flex: 1 }}>
          {/* LLM Model Selection */}
          <div>
            <label className="block text-sm font-semibold" style={{ marginBottom: '8px' }}>{t('llm.model')}</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '8px 12px' }}
            >
              <option value="qwen2.5:1.5b">qwen2.5:1.5b (Default)</option>
              {availableModels.map(model => (
                <option key={model.name} value={model.name}>
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400" style={{ marginTop: '8px' }}>
              {t('current.model')}: {selectedModel}
            </p>
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

          {/* About */}
          <div className="border-t border-gray-700" style={{ paddingTop: '16px' }}>
            <h3 className="font-semibold" style={{ marginBottom: '8px' }}>{t('about')}</h3>
            <p className="text-sm text-gray-400">
              {t('about.text')}
            </p>
          </div>
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
