import React from 'react';
import { X } from 'lucide-react';
import useStore from '../store/useStore';

function SettingsModal() {
  const {
    selectedModel,
    availableModels,
    setSelectedModel,
    setShowSettings
  } = useStore();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* LLM Model Selection */}
          <div>
            <label className="block text-sm font-semibold mb-2">LLM Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="qwen2.5:1.5b">qwen2.5:1.5b (Default)</option>
              {availableModels.map(model => (
                <option key={model.name} value={model.name}>
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">
              Current model: {selectedModel}
            </p>
          </div>

          {/* Ollama Connection */}
          <div>
            <label className="block text-sm font-semibold mb-2">Ollama Connection</label>
            <input
              type="text"
              defaultValue="http://localhost:11434"
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="http://localhost:11434"
            />
            <p className="text-xs text-gray-400 mt-2">
              Make sure Ollama is running on your system
            </p>
          </div>

          {/* API Keys (Future) */}
          <div>
            <label className="block text-sm font-semibold mb-2">API Keys</label>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="OpenAI API Key (optional)"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="Anthropic API Key (optional)"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* About */}
          <div className="pt-4 border-t border-gray-700">
            <h3 className="font-semibold mb-2">About</h3>
            <p className="text-sm text-gray-400">
              AI Unseen Workspace v1.0.0 - A powerful AI assistant with multimodal capabilities,
              MCP tool integration, and 3D visualization.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={() => setShowSettings(false)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;

