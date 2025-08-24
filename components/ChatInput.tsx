import React from 'react';
import { Send, Loader2, Edit2 } from 'lucide-react';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSendMessage: () => void; // Changed: no message argument, uses inputText from props
  isLoading: boolean;
  isEditing: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  onSendMessage,
  isLoading,
  isEditing
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage();
    // inputText will be cleared by App component after message is processed
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Auto-resize textarea height
    e.target.style.height = 'auto'; // Reset height
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`; // Set new height, max 128px (8rem / max-h-32)
  };


  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 sm:p-4 bg-gray-900 border-t border-gray-700 flex items-end gap-2 sm:gap-3"
    >
      <textarea
        value={inputText}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        placeholder="Type your message..."
        className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-100 placeholder-gray-400 resize-none overflow-y-auto text-sm"
        rows={1}
        style={{minHeight: '44px', maxHeight: '128px'}} // min-h equivalent for p-3 + border, max-h-32 (8rem)
        disabled={isLoading}
        aria-label="Chat message input"
      />
      <button
        type="submit"
        disabled={isLoading || !inputText.trim()}
        className={`p-3 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-sky-600 hover:bg-sky-700'} text-white rounded-full disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 ${isEditing ? 'focus:ring-amber-400' : 'focus:ring-sky-500'} focus:ring-opacity-50 flex-shrink-0`}
        aria-label={isLoading ? "Sending message" : isEditing ? "Update and send message" : "Send message"}
        title={isEditing ? "Update & Send" : "Send"}
      >
        {isLoading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isEditing ? (
          <Edit2 size={20} />
        ) : (
          <Send size={20} />
        )}
      </button>
    </form>
  );
};