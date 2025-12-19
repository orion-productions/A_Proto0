import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';
import useStore from '../store/useStore';
import { useTranslation, t } from '../utils/i18n';

function Header() {
  const {
    micEnabled,
    speakerEnabled,
    selectedLanguage,
    setMicEnabled,
    setSpeakerEnabled,
    setSelectedLanguage,
    setShowSettings,
    ollamaStatus
  } = useStore();
  
  const translate = useTranslation(selectedLanguage);
  
  // Translate ollama status message dynamically based on current language
  const getOllamaMessage = () => {
    if (!ollamaStatus?.messageKey) {
      return ollamaStatus?.message || '';
    }
    return t(ollamaStatus.messageKey, selectedLanguage, ollamaStatus.messageParams || {});
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
  ];

  return (
    <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            {translate('app.title')}
          </h1>
          {getOllamaMessage() && (
            <div className="text-xs text-gray-300">
              {getOllamaMessage()}
              {ollamaStatus.state === 'loading' && ollamaStatus.progress !== undefined && (
                <span className="ml-2 text-blue-400">{ollamaStatus.progress}%</span>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Mic Toggle */}
        <button
          onClick={() => setMicEnabled(!micEnabled)}
          className={`p-2 rounded-lg transition-colors ${
            micEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={micEnabled ? translate('mic.on') : translate('mic.off')}
        >
          {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* Speaker Toggle */}
        <button
          onClick={() => setSpeakerEnabled(!speakerEnabled)}
          className={`p-2 rounded-lg transition-colors ${
            speakerEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={speakerEnabled ? translate('speaker.on') : translate('speaker.off')}
        >
          {speakerEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>

        {/* Language Selector */}
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {languages.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
          title={translate('settings')}
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}

export default Header;

