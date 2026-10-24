import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Sparkles } from 'lucide-react';
import { ChatMessage, Role } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'Host':
        return 'text-cinema-gold font-bold flex items-center gap-1';
      case 'Moderator':
        return 'text-blue-400 font-bold';
      default:
        return 'text-gray-400 font-medium';
    }
  };

  return (
    <div className="bg-cinema-900/80 border border-white/5 rounded-2xl p-4 flex flex-col h-full shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-red-500" />
          <h3 className="font-bold text-white text-sm">Audience Chat</h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 font-mono">
          {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 italic gap-2 py-12">
            <Sparkles className="w-5 h-5 text-gray-600" />
            <span>Theater chat is quiet. Say hello!</span>
          </div>
        ) : (
          messages.map((msg) => {
            // System Notification (User joined / User left)
            if (msg.userId === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300 font-medium tracking-wide flex items-center gap-1.5 shadow-sm">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isSelf = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                  <span className={getRoleBadge(msg.role)}>
                    {msg.username}
                    {msg.role === 'Host' && ' 👑'}
                  </span>
                  <span className="text-gray-500 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div
                  className={`p-2.5 px-3 rounded-2xl max-w-[85%] break-words leading-relaxed text-xs ${
                    isSelf
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white rounded-br-none shadow-md'
                      : 'bg-cinema-800 text-gray-200 border border-white/10 rounded-bl-none shadow'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form (Guaranteed sticky at bottom & immune to keyboard crush) */}
      <form onSubmit={handleSubmit} className="mt-2 pt-2.5 border-t border-white/10 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Whisper something to the theater..."
          maxLength={500}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          className="flex-1 bg-cinema-950/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition shadow-inner"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2.5 px-3 bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-40 disabled:hover:bg-red-600 text-white rounded-xl transition shadow-md shadow-red-600/30 flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed"
          title="Send message"
        >
          <Send className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>
      </form>
    </div>
  );
};
