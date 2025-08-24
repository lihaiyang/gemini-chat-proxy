import React from 'react';
import { Settings, Loader2, Zap, ZapOff, Wifi, WifiOff, AlertTriangle } from 'lucide-react'; 
import { WebSocketProxyStatus } from '../types';

interface HeaderProps {
  onClearChat: () => void;
  onOpenSettingsModal: () => void;
  isLoading: boolean; // General UI busy state
  currentModelName?: string;
  webSocketStatus: WebSocketProxyStatus;
  webSocketStatusDetails?: string;
  onConnectWebSocket: () => void;
  onDisconnectWebSocket: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onClearChat,
  onOpenSettingsModal,
  isLoading,
  currentModelName,
  webSocketStatus,
  webSocketStatusDetails,
  onConnectWebSocket,
  onDisconnectWebSocket,
}) => {
  const getWebSocketStatusIndicator = () => {
    let text = `WS: ${webSocketStatus}`;
    let className = 'bg-gray-500 text-white'; // Default
    let icon = <WifiOff size={16} className="mr-1.5" />;

    switch (webSocketStatus) {
      case WebSocketProxyStatus.CONNECTED:
        text = 'WS Proxy: Connected';
        className = 'bg-green-600 hover:bg-green-700 text-white';
        icon = <Wifi size={16} className="mr-1.5" />;
        break;
      case WebSocketProxyStatus.CONNECTING:
        text = 'WS Proxy: Connecting...';
        className = 'bg-yellow-500 hover:bg-yellow-600 text-black animate-pulse';
        icon = <Loader2 size={16} className="animate-spin mr-1.5" />;
        break;
      case WebSocketProxyStatus.RECONNECTING:
        text = 'WS Proxy: Reconnecting...';
        className = 'bg-yellow-500 hover:bg-yellow-600 text-black animate-pulse';
        icon = <Loader2 size={16} className="animate-spin mr-1.5" />;
        break;
      case WebSocketProxyStatus.DISCONNECTED:
        text = 'WS Proxy: Disconnected';
        className = 'bg-orange-500 hover:bg-orange-600 text-white';
        icon = <WifiOff size={16} className="mr-1.5" />;
        break;
      case WebSocketProxyStatus.ERROR:
        text = 'WS Proxy: Error';
        className = 'bg-red-600 hover:bg-red-700 text-white';
        icon = <AlertTriangle size={16} className="mr-1.5" />;
        break;
      case WebSocketProxyStatus.IDLE:
        text = 'WS Proxy: Idle';
        className = 'bg-gray-600 hover:bg-gray-700 text-white';
        icon = <WifiOff size={16} className="mr-1.5" />;
        break;
      default:
        text = `WS Proxy: ${webSocketStatus}`;
        className = 'bg-gray-500 text-white';
    }
    return { text, className, icon, fullDetails: webSocketStatusDetails ? `${text} - ${webSocketStatusDetails}` : text };
  };

  const wsStatusIndicator = getWebSocketStatusIndicator();
  const isWsBusy = webSocketStatus === WebSocketProxyStatus.CONNECTING || webSocketStatus === WebSocketProxyStatus.RECONNECTING;
  const isWsConnected = webSocketStatus === WebSocketProxyStatus.CONNECTED;

  return (
    <header className="bg-gray-900 p-3 sm:p-4 shadow-lg flex items-center justify-between flex-wrap gap-3">
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-sky-400 whitespace-nowrap">Gemini Advanced Chat</h1>
        {currentModelName && (
          <span
            className="text-xs sm:text-sm text-gray-300 bg-gray-700/80 px-2 py-0.5 rounded-md self-start sm:self-center whitespace-nowrap"
            title={`Current Model: ${currentModelName}`}
            aria-label={`Current AI Model: ${currentModelName}`}
          >
            {currentModelName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
        <span
            className={`flex items-center text-xs sm:text-sm px-2.5 py-1 rounded-md whitespace-nowrap ${wsStatusIndicator.className}`}
            title={wsStatusIndicator.fullDetails}
            aria-live="polite"
          >
            {wsStatusIndicator.icon}
            {wsStatusIndicator.text}
        </span>

        {(!isWsConnected && !isWsBusy) && (
          <button
            onClick={onConnectWebSocket}
            disabled={isLoading || isWsBusy} 
            className="p-2 sm:p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-50 flex items-center gap-1.5 px-3 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Connect WebSocket Proxy"
            aria-label="Connect WebSocket Proxy"
          >
            <Zap size={18} />
            <span className="text-xs sm:text-sm">Connect WS</span>
          </button>
        )}
        
        {(isWsConnected || isWsBusy) && (
          <button
            onClick={onDisconnectWebSocket}
            disabled={isLoading || webSocketStatus === WebSocketProxyStatus.CONNECTING} // Allow disconnect if reconnecting
            className="p-2 sm:p-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-50 flex items-center gap-1.5 px-3 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Disconnect WebSocket Proxy"
            aria-label="Disconnect WebSocket Proxy"
          >
            <ZapOff size={18} />
            <span className="text-xs sm:text-sm">Disconnect WS</span>
          </button>
        )}


        <button
          onClick={onOpenSettingsModal}
          className="p-2 sm:p-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 flex items-center gap-1.5 px-3"
          disabled={isLoading || isWsBusy}
          aria-label="Open Chat Settings"
          title="Chat Settings"
        >
          <Settings size={18} />
          <span className="text-xs sm:text-sm">Settings</span>
        </button>

        <button
          onClick={onClearChat}
          className="px-3 py-2 sm:px-4 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow transition-colors text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          disabled={isLoading || isWsBusy}
          aria-label="Clear Chat History"
          title="Clear Chat"
        >
          Clear Chat
        </button>
      </div>
    </header>
  );
};