
import React, { useState, useEffect } from 'react';
import { ModelOption, ChatSettings } from '../types';
import { Loader2, X, Info } from 'lucide-react'; // Added Info icon
import { DEFAULT_TEMPERATURE, DEFAULT_TOP_P, DEFAULT_SHOW_THOUGHTS, DEFAULT_MODEL_ID, DEFAULT_SYSTEM_INSTRUCTION } from '../constants';


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: ChatSettings; // Includes systemInstruction
  availableModels: ModelOption[];
  onSave: (newSettings: ChatSettings) => void;
  isModelsLoading: boolean;
  modelsLoadingError: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  availableModels,
  onSave,
  isModelsLoading,
  modelsLoadingError
}) => {
  const [modelId, setModelId] = useState(currentSettings.modelId);
  const [temperature, setTemperature] = useState(currentSettings.temperature);
  const [topP, setTopP] = useState(currentSettings.topP);
  const [showThoughts, setShowThoughts] = useState(currentSettings.showThoughts);
  const [systemInstruction, setSystemInstructionLocal] = useState(currentSettings.systemInstruction); // Local state for system instruction

  useEffect(() => {
    if (isOpen) {
      setModelId(currentSettings.modelId || DEFAULT_MODEL_ID);
      setTemperature(currentSettings.temperature ?? DEFAULT_TEMPERATURE);
      setTopP(currentSettings.topP ?? DEFAULT_TOP_P);
      setShowThoughts(currentSettings.showThoughts ?? DEFAULT_SHOW_THOUGHTS);
      setSystemInstructionLocal(currentSettings.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION);
    }
  }, [currentSettings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ modelId, temperature, topP, showThoughts, systemInstruction });
  };
  
  const handleResetToDefaults = () => {
    setModelId(DEFAULT_MODEL_ID);
    setTemperature(DEFAULT_TEMPERATURE);
    setTopP(DEFAULT_TOP_P);
    setShowThoughts(DEFAULT_SHOW_THOUGHTS);
    setSystemInstructionLocal(DEFAULT_SYSTEM_INSTRUCTION);
  };
  
  const isSystemPromptSet = systemInstruction && systemInstruction.trim() !== "";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg transform transition-all scale-100 opacity-100">
        <div className="flex justify-between items-center mb-6">
          <h2 id="settings-title" className="text-xl font-semibold text-sky-400">Chat Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close settings"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 -mr-2"> {/* Added max-height and overflow for scrolling */}
          {/* Model Selection */}
          <div>
            <label htmlFor="model-select" className="block text-sm font-medium text-gray-300 mb-1">AI Model</label>
            {isModelsLoading ? (
              <div className="flex items-center justify-start bg-gray-700 border border-gray-600 text-gray-300 text-sm rounded-lg p-2.5 w-full">
                <Loader2 size={16} className="animate-spin mr-2 text-sky-400" />
                <span>Loading models...</span>
              </div>
            ) : modelsLoadingError ? (
                 <div className="text-sm text-red-400 p-2.5 bg-red-900/50 border border-red-700 rounded-md">{modelsLoadingError}</div>
            ) : (
              <div className="relative">
                <select
                  id="model-select"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-gray-100 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5 appearance-none pr-8"
                  disabled={availableModels.length === 0}
                  aria-label="Select AI Model"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                  {availableModels.length === 0 && <option value="" disabled>No models available</option>}
                </select>
                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.516 7.548c.436-.446 1.043-.48 1.576 0L10 10.405l2.908-2.857c.533-.48 1.14-.446 1.576 0 .436.445.408 1.197 0 1.615l-3.695 3.63c-.533.48-1.14.446-1.576 0L5.516 9.163c-.408-.418-.436-1.17 0-1.615z"/></svg>
                </div>
              </div>
            )}
          </div>

          {/* System Prompt */}
          <div>
            <label htmlFor="system-prompt-input" className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
                System Prompt
                {isSystemPromptSet && (
                    <span 
                        className="ml-2 w-2.5 h-2.5 bg-teal-400 rounded-full" 
                        title="System prompt is active"
                        aria-label="System prompt is active"
                    ></span>
                )}
            </label>
            <textarea
              id="system-prompt-input"
              value={systemInstruction}
              onChange={(e) => setSystemInstructionLocal(e.target.value)}
              rows={4}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-400 resize-y text-sm"
              placeholder="e.g., You are a helpful AI assistant that speaks like a pirate."
              aria-label="System prompt text area"
            />
             <p className="mt-1 text-xs text-gray-400 flex items-start">
                <Info size={12} className="mr-1 mt-0.5 flex-shrink-0 text-sky-400" />
                Guides the AI's personality and responses. Changes will start a new chat context.
            </p>
          </div>


          {/* Temperature */}
          <div>
            <label htmlFor="temperature-slider" className="block text-sm font-medium text-gray-300 mb-1">
              Temperature: <span className="font-mono text-sky-400">{temperature.toFixed(2)}</span>
            </label>
            <input
              id="temperature-slider"
              type="range"
              min="0"
              max="1" 
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
              aria-label={`Temperature: ${temperature.toFixed(2)}`}
            />
          </div>

          {/* Top P */}
          <div>
            <label htmlFor="top-p-slider" className="block text-sm font-medium text-gray-300 mb-1">
              Top P: <span className="font-mono text-sky-400">{topP.toFixed(2)}</span>
            </label>
            <input
              id="top-p-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={topP}
              onChange={(e) => setTopP(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sky-500"
              aria-label={`Top P: ${topP.toFixed(2)}`}
            />
          </div>

          {/* Show Thoughts */}
          <div className="flex items-center">
            <input
              id="show-thoughts"
              type="checkbox"
              checked={showThoughts}
              onChange={(e) => setShowThoughts(e.target.checked)}
              className="h-4 w-4 text-sky-600 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800"
            />
            <label htmlFor="show-thoughts" className="ml-2 text-sm text-gray-300">
              Show Assistant's Thoughts
            </label>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-700">
          <button
            onClick={handleResetToDefaults}
            type="button"
            className="px-4 py-2 text-xs sm:text-sm border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 w-full sm:w-auto"
            aria-label="Reset settings to default"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              type="button"
              className="flex-1 sm:flex-initial px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75"
              aria-label="Cancel settings changes"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              type="button"
              className="flex-1 sm:flex-initial px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75"
              aria-label="Save chat settings"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};