
import React, { useState } from 'react';
import { ChatMessage } from '../types';
import { User, Bot, AlertTriangle, Edit3, Copy, Check, Info } from 'lucide-react'; // Added Info icon
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MessageListProps {
  messages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onEditMessage: (messageId: string) => void;
  lastUserMessageId?: string;
  showThoughts: boolean;
}

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderMarkdown = (content: string) => {
  const rawMarkup = marked.parse(content);
  // Ensure DOMPurify is used correctly, it should return a string.
  const cleanMarkup = DOMPurify.sanitize(rawMarkup as string); // Cast to string if marked.parse returns union type
  return { __html: cleanMarkup };
};


export const MessageList: React.FC<MessageListProps> = ({ messages, messagesEndRef, onEditMessage, lastUserMessageId, showThoughts }) => {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = async (content: string, messageId: string) => {
    if (!navigator.clipboard) {
      console.error('Clipboard API not available');
      // Fallback or user notification could be added here
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 1500); // Reset after 1.5 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // User notification of copy failure
    }
  };

  const getMessageBubbleStyle = (role: ChatMessage['role']) => {
    switch (role) {
      case 'user':
        return 'bg-sky-600 text-white rounded-br-none';
      case 'model':
        return 'bg-gray-700 text-gray-100 rounded-bl-none';
      case 'error':
        return 'bg-red-700 text-gray-100 rounded-bl-none';
      case 'system':
        return 'bg-indigo-700 text-gray-100 rounded-bl-none'; // Style for system messages
      default:
        return 'bg-gray-600 text-gray-200'; // Fallback
    }
  };

  return (
    <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-800">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-end gap-2 group ${
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {msg.role === 'model' && <BotMsgIcon />}
          {msg.role === 'error' && <ErrorMsgIcon />}
          {msg.role === 'system' && <SystemMsgIcon />}

          <div
            className={`relative max-w-xl lg:max-w-2xl xl:max-w-3xl p-3 sm:p-4 rounded-xl shadow-md ${getMessageBubbleStyle(msg.role)}`}
            aria-live={msg.isLoading ? "polite" : "off"}
            role="log"
          >
            {showThoughts && msg.role === 'model' && msg.thoughts && (
              <div className="mb-2 p-2 bg-black bg-opacity-20 rounded-md border border-gray-600">
                <p className="text-xs font-semibold text-sky-300 mb-1">Assistant's Thoughts:</p>
                <div
                  className="text-xs text-gray-300 markdown-body"
                  dangerouslySetInnerHTML={renderMarkdown(msg.thoughts)}
                />
              </div>
            )}

            {(msg.content || (msg.role === 'model' && msg.thoughts && showThoughts)) ? (
              <div
                className="text-sm markdown-body"
                dangerouslySetInnerHTML={renderMarkdown(msg.content || '')}
              />
            ) : (
              msg.isLoading && msg.role === 'model' && <span className="italic text-gray-400">Typing...</span>
            )}
             {/* Display content for system messages if no special formatting needed other than markdown */}
            {msg.role === 'system' && !msg.isLoading && msg.content && (
                 <div
                    className="text-sm markdown-body"
                    dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                />
            )}


            <p className="text-xs opacity-70 mt-1.5 text-right">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {msg.role === 'user' && (
            <div className="flex flex-col items-center">
              <UserMsgIcon />
              {msg.id === lastUserMessageId && !msg.isLoading && ( // Ensure not loading for edit button
                <button
                  onClick={() => onEditMessage(msg.id)}
                  className="mt-1 p-1 text-gray-400 hover:text-sky-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150"
                  aria-label="Edit last message"
                  title="Edit message"
                >
                  <Edit3 size={16} />
                </button>
              )}
            </div>
          )}

          {(msg.role === 'model' || msg.role === 'system') && !(msg.isLoading) && msg.content && ( // Allow copy for system messages too
            <button
              onClick={() => handleCopyMessage(msg.content, msg.id)}
              className="p-1.5 text-gray-400 hover:text-sky-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Copy message content"
              title="Copy message"
              disabled={!msg.content || msg.content.trim() === ''}
            >
              {copiedMessageId === msg.id ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
            </button>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

const UserMsgIcon: React.FC = () => <User size={24} className="text-sky-400 flex-shrink-0 self-start" />; // Align icons to top
const BotMsgIcon: React.FC = () => <Bot size={24} className="text-emerald-400 flex-shrink-0 self-start" />;
const ErrorMsgIcon: React.FC = () => <AlertTriangle size={24} className="text-red-400 flex-shrink-0 self-start" />;
const SystemMsgIcon: React.FC = () => <Info size={24} className="text-indigo-400 flex-shrink-0 self-start" />; // Icon for system messages
