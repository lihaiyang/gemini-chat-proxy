import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, ModelOption, ChatHistoryItem, ChatSettings, WebSocketProxyStatus } from './types';
import { DEFAULT_MODEL_ID, DEFAULT_SYSTEM_INSTRUCTION, DEFAULT_TEMPERATURE, DEFAULT_TOP_P, DEFAULT_SHOW_THOUGHTS } from './constants';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { SettingsModal } from './components/SettingsModal';
import { geminiServiceInstance } from './services/geminiService';
import { webSocketProxyManager } from './services/webSocketService'; // Updated import if filename changed, or keep if same
import { Chat } from '@google/genai';

const App: React.FC = () => {
  const [systemInstruction, setSystemInstruction] = useState<string>(DEFAULT_SYSTEM_INSTRUCTION);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  const [apiModels, setApiModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [temperature, setTemperature] = useState<number>(DEFAULT_TEMPERATURE);
  const [topP, setTopP] = useState<number>(DEFAULT_TOP_P);
  const [showThoughts, setShowThoughts] = useState<boolean>(DEFAULT_SHOW_THOUGHTS);

  const [modelsLoadingError, setModelsLoadingError] = useState<string | null>(null);
  const [isModelsLoading, setIsModelsLoading] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false); // General loading for user actions (Gemini API calls)
  
  const [chatSession, setChatSession] = useState<Chat | null>(null);

  const [sessionModelId, setSessionModelId] = useState<string>('');
  const [sessionSystemInstruction, setSessionSystemInstruction] = useState<string>('');
  const [sessionTemperature, setSessionTemperature] = useState<number>(DEFAULT_TEMPERATURE);
  const [sessionTopP, setSessionTopP] = useState<number>(DEFAULT_TOP_P);
  const [sessionShowThoughts, setSessionShowThoughts] = useState<boolean>(DEFAULT_SHOW_THOUGHTS);

  const [inputText, setInputText] = useState<string>('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [webSocketStatus, setWebSocketStatus] = useState<WebSocketProxyStatus>(WebSocketProxyStatus.IDLE);
  const [webSocketStatusDetails, setWebSocketStatusDetails] = useState<string | undefined>(undefined);
  const [jwtToken, setJwtToken] = useState<string | null>(process.env.JWT_TOKEN || null);


  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Effect to handle JWT token and inform user if missing
  useEffect(() => {
    // const token = process.env.JWT_TOKEN;
    const token = process.env.JWT_TOKEN || "valid-token-user-1";
    if (!token) {
      console.warn("JWT_TOKEN environment variable is not set. WebSocket Proxy connection will not be possible.");
      // Optionally, display a persistent message to the user in the UI.
      // For now, relying on console warning and connection attempt failure.
      setMessages(prev => [...prev, {
          id: `jwt-warning-${Date.now()}`,
          role: 'system',
          content: 'Warning: JWT_TOKEN is not configured. WebSocket Proxy functionality will be unavailable.',
          timestamp: new Date()
      }]);
    }
    setJwtToken(token || null);
  }, []);


  const createChatHistoryForApi = useCallback((msgs: ChatMessage[]): ChatHistoryItem[] => {
    return msgs
      .filter(msg => msg.role === 'user' || msg.role === 'model')
      .map(msg => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }],
      }));
  }, []);

  const initializeCurrentChatSession = useCallback(async (history?: ChatHistoryItem[]) => {
    if (!selectedModelId) {
      console.warn("Cannot initialize chat: No model selected.");
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'error', content: 'No model selected. Cannot initialize chat.', timestamp: new Date() }]);
      return null;
    }
    
    setIsLoading(true);

    try {
      const newSession = await geminiServiceInstance.initializeChat(
        selectedModelId,
        systemInstruction,
        { temperature, topP },
        showThoughts,
        history
      );
      setChatSession(newSession);
      setSessionModelId(selectedModelId);
      setSessionSystemInstruction(systemInstruction);
      setSessionTemperature(temperature);
      setSessionTopP(topP);
      setSessionShowThoughts(showThoughts);
      if (!newSession) {
         setMessages(prev => [...prev, { id: Date.now().toString(), role: 'error', content: 'Failed to initialize chat session. Check API Key, network, and selected model.', timestamp: new Date() }]);
         return null;
      }
      return newSession;
    } catch (error) {
      console.error("Error initializing chat session:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'error', content: `Error initializing chat: ${errorMsg}`, timestamp: new Date() }]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedModelId, systemInstruction, temperature, topP, showThoughts]);

  useEffect(() => {
    const fetchAndSetModels = async () => {
      setIsModelsLoading(true);
      setModelsLoadingError(null);
      try {
        const fetchedModels = await geminiServiceInstance.getAvailableModels();
        if (fetchedModels.length > 0) {
          setApiModels(fetchedModels);
          // Try to select default model if available, else first in list
          const defaultModelInList = fetchedModels.find(m => m.id === DEFAULT_MODEL_ID);
          setSelectedModelId(defaultModelInList ? DEFAULT_MODEL_ID : fetchedModels[0].id);
        } else {
          setModelsLoadingError("No compatible models found. Using hardcoded default.");
          const fallbackModel = { id: DEFAULT_MODEL_ID, name: `Default: ${DEFAULT_MODEL_ID.split('/').pop() || 'Unknown Model'}` };
          setApiModels([fallbackModel]);
          setSelectedModelId(fallbackModel.id);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
        setModelsLoadingError(`Failed to load models: ${error instanceof Error ? error.message : String(error)}. Using default model.`);
        const fallbackModel = { id: DEFAULT_MODEL_ID, name: `Default: ${DEFAULT_MODEL_ID.split('/').pop()} (Error Loading)` };
        setApiModels([fallbackModel]);
        setSelectedModelId(fallbackModel.id);
      } finally {
        setIsModelsLoading(false);
      }
    };
    fetchAndSetModels();
  }, []);

   useEffect(() => {
    // Only re-initialize if settings have actually changed OR chatSession is null and we have a modelId
    if (selectedModelId && !isModelsLoading) { 
        if (!chatSession ||
            sessionModelId !== selectedModelId ||
            sessionSystemInstruction !== systemInstruction ||
            sessionTemperature !== temperature ||
            sessionTopP !== topP ||
            sessionShowThoughts !== showThoughts
        ) {
            console.log("Attempting to initialize/re-initialize chat session due to settings change or no session.");
            initializeCurrentChatSession();
        }
    }
  }, [selectedModelId, systemInstruction, temperature, topP, showThoughts, initializeCurrentChatSession, isModelsLoading, chatSession, sessionModelId, sessionSystemInstruction, sessionTemperature, sessionTopP, sessionShowThoughts]);


  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const currentInputText = inputText;
    setInputText('');
    setIsLoading(true);

    let currentChat = chatSession;
    let messagesForNewTurn = [...messages];

    if (!currentChat ||
        selectedModelId !== sessionModelId ||
        systemInstruction !== sessionSystemInstruction ||
        temperature !== sessionTemperature ||
        topP !== sessionTopP ||
        showThoughts !== sessionShowThoughts
    ) {
        console.log("Settings changed, re-initializing chat before sending message...");
        const historyForNewSession = editingMessageId
            ? createChatHistoryForApi(messages.slice(0, messages.findIndex(m => m.id === editingMessageId)))
            : createChatHistoryForApi(messages);
        
        const newSession = await initializeCurrentChatSession(historyForNewSession);
        if (!newSession) {
            setMessages(prev => [...prev, { id: Date.now().toString() + 'initerr-send', role: 'error', content: 'Failed to re-initialize chat session with new settings before sending.', timestamp: new Date() }]);
            setIsLoading(false);
            if(editingMessageId) setEditingMessageId(null);
            return;
        }
        currentChat = newSession;
        if (editingMessageId) {
             messagesForNewTurn = messages.slice(0, messages.findIndex(m => m.id === editingMessageId));
             setMessages(messagesForNewTurn);
        }
    } else if (editingMessageId) {
        const editMsgIndex = messages.findIndex(m => m.id === editingMessageId);
        if (editMsgIndex !== -1) {
            messagesForNewTurn = messages.slice(0, editMsgIndex);
            const historyForApi = createChatHistoryForApi(messagesForNewTurn);
            const newSession = await initializeCurrentChatSession(historyForApi);
            if (!newSession) {
                 setMessages([...messagesForNewTurn, { id: Date.now().toString() + 'initerr-edit', role: 'error', content: 'Failed to re-initialize chat session for edit.', timestamp: new Date() }]);
                 setIsLoading(false);
                 setEditingMessageId(null);
                 return;
            }
            currentChat = newSession;
            setMessages(messagesForNewTurn);
        }
    }
    setEditingMessageId(null);

    if (!currentChat || !sessionModelId) {
      setMessages(prev => [...prev, { id: Date.now().toString() + 'nosess', role: 'error', content: 'Chat session is not available or model not set. Please try clearing chat or refresh.', timestamp: new Date() }]);
      setIsLoading(false);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInputText,
      timestamp: new Date(),
    };
    setMessages(prevMessages => [...messagesForNewTurn, userMessage]);

    const modelMessageId = (Date.now() + 1).toString();
    setMessages(prevMessages => [
      ...prevMessages,
      { id: modelMessageId, role: 'model', content: '', thoughts: '', timestamp: new Date(), isLoading: true },
    ]);

    await geminiServiceInstance.sendMessageStream(
      currentChat,
      sessionModelId, // Use sessionModelId which is confirmed to be part of the current session
      currentInputText,
      (chunk) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === modelMessageId ? { ...msg, content: msg.content + chunk, isLoading: true } : msg
          )
        );
      },
      (thoughtChunk) => { // This callback might be less used if thoughts are part of main stream
        setMessages(prev =>
          prev.map(msg =>
            msg.id === modelMessageId ? { ...msg, thoughts: (msg.thoughts || '') + thoughtChunk, isLoading: true } : msg
          )
        );
      },
      (error) => {
        console.error("Error streaming message:", error);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === modelMessageId ? { ...msg, role: 'error', content: `Error: ${error.message}`, isLoading: false } : msg
          )
        );
        setIsLoading(false);
      },
      () => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === modelMessageId ? { ...msg, isLoading: false } : msg
          )
        );
        setIsLoading(false);
      }
    );
  };
  
  // WebSocket Proxy Setup
  useEffect(() => {
    webSocketProxyManager.setOnStatusChange((status, details) => {
      setWebSocketStatus(status);
      setWebSocketStatusDetails(details);
      
      const statusMessageContent = `WebSocket Proxy: ${status}${details ? ` - ${details}` : ''}`;
      // Optionally add these as system messages in the chat, or display in a dedicated UI area
      console.log(statusMessageContent); // For now, log to console
       if (status === WebSocketProxyStatus.ERROR || (status === WebSocketProxyStatus.DISCONNECTED && details)) {
           setMessages(prev => [...prev, {
                id: `ws-proxy-status-${Date.now()}`,
                role: 'system', // or 'error' for ERROR status
                content: statusMessageContent,
                timestamp: new Date()
            }]);
       }
    });

    // Cleanup on component unmount
    return () => {
      webSocketProxyManager.setOnStatusChange(null);
      webSocketProxyManager.disconnect(); // Ensure disconnection on unmount
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const handleWebSocketConnect = () => {
    if (!jwtToken) {
       setMessages(prev => [...prev, {
          id: `jwt-err-connect-${Date.now()}`,
          role: 'error',
          content: 'Cannot connect WebSocket Proxy: JWT_TOKEN is not available. Please configure it.',
          timestamp: new Date()
      }]);
      console.error("WebSocket Proxy: Cannot connect, JWT_TOKEN is not available.");
      setWebSocketStatus(WebSocketProxyStatus.ERROR);
      setWebSocketStatusDetails("JWT_TOKEN is not available.");
      return;
    }
    if (webSocketStatus !== WebSocketProxyStatus.CONNECTED && webSocketStatus !== WebSocketProxyStatus.CONNECTING) {
      webSocketProxyManager.connect(jwtToken);
    }
  };

  const handleWebSocketDisconnect = () => {
    if (webSocketStatus === WebSocketProxyStatus.CONNECTED || webSocketStatus === WebSocketProxyStatus.CONNECTING || webSocketStatus === WebSocketProxyStatus.RECONNECTING) {
      webSocketProxyManager.disconnect();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setInputText('');
    setEditingMessageId(null);
    setChatSession(null); 
    // Do not reset systemInstruction here, allow it to persist unless changed in settings.
    // setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION); // This would clear it, which might not be desired.
    console.log("Chat cleared. Session will re-initialize with current settings if a message is sent or settings change.");
    // Force re-initialization on next send or settings change by clearing session values
    setSessionModelId(''); 
    setSessionSystemInstruction(''); 
  };

  const handleSaveSettings = (newSettings: ChatSettings) => {
    setSelectedModelId(newSettings.modelId);
    setTemperature(newSettings.temperature);
    setTopP(newSettings.topP);
    setShowThoughts(newSettings.showThoughts);
    setSystemInstruction(newSettings.systemInstruction);
    setIsSettingsModalOpen(false);
    // Chat session will re-initialize due to useEffect dependency changes
  };

  const handleEditMessage = (messageId: string) => {
    const messageToEdit = messages.find(msg => msg.id === messageId);
    if (messageToEdit && messageToEdit.role === 'user') {
      setInputText(messageToEdit.content);
      setEditingMessageId(messageId);
      const chatInputElement = document.querySelector('textarea[placeholder="Type your message..."]') as HTMLTextAreaElement | null;
      chatInputElement?.focus();
    }
  };

  const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user');

  const getCurrentModelDisplayName = () => {
    if (isModelsLoading && apiModels.length === 0) return "Loading models...";
    if (isModelsLoading && selectedModelId) return "Verifying model...";

    const model = apiModels.find(m => m.id === selectedModelId);

    if (model) return model.name;
    if (selectedModelId) { // Fallback if model not in current apiModels list (e.g. after error)
        const parts = selectedModelId.split('/');
        return parts.length > 1 ? parts[parts.length -1] : selectedModelId;
    }
    return "No model selected";
  };
  
  const isUIBusy = isLoading || isModelsLoading || webSocketStatus === WebSocketProxyStatus.CONNECTING;

  return (
    <div className="flex flex-col h-screen bg-gray-800 text-gray-100">
      <Header
        onClearChat={handleClearChat}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        isLoading={isUIBusy}
        currentModelName={getCurrentModelDisplayName()}
        webSocketStatus={webSocketStatus}
        webSocketStatusDetails={webSocketStatusDetails}
        onConnectWebSocket={handleWebSocketConnect}
        onDisconnectWebSocket={handleWebSocketDisconnect}
      />
      {modelsLoadingError && (
         <div className="p-2 bg-red-800 text-center text-xs text-white">{modelsLoadingError}</div>
      )}
      {/* Example of displaying detailed WS status, can be refined */}
      {/* {webSocketStatusDetails && (webSocketStatus === WebSocketProxyStatus.ERROR || webSocketStatus === WebSocketProxyStatus.DISCONNECTED) && (
         <div className="p-2 bg-yellow-700 text-center text-xs text-white">WS Info: {webSocketStatusDetails}</div>
      )} */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentSettings={{
            modelId: selectedModelId,
            temperature,
            topP,
            showThoughts,
            systemInstruction
        }}
        availableModels={apiModels}
        onSave={handleSaveSettings}
        isModelsLoading={isModelsLoading}
        modelsLoadingError={modelsLoadingError}
      />
      <MessageList
        messages={messages}
        messagesEndRef={messagesEndRef}
        onEditMessage={handleEditMessage}
        lastUserMessageId={lastUserMessage?.id}
        showThoughts={sessionShowThoughts} // Use sessionShowThoughts for consistency with active session
      />
      <ChatInput
        inputText={inputText}
        setInputText={setInputText}
        onSendMessage={handleSendMessage}
        isLoading={isUIBusy}
        isEditing={!!editingMessageId}
      />
    </div>
  );
};

export default App;