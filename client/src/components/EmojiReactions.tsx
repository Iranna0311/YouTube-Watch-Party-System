import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { EmojiReaction } from '../types';

const POPULAR_EMOJIS = ['❤️', '🔥', '😂', '👏', '🍿', '🚀'];
const EXTENDED_EMOJIS = ['🎉', '😍', '😮', '🤯', '💯', '✨', '⚡', '👀', '💃', '🙌'];

interface EmojiReactionsProps {
  onSendReaction: (emoji: string) => void;
  activeReactions: EmojiReaction[];
}

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  onSendReaction,
  activeReactions,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      {/* Floating Animated Emojis flying up over the Cinema Screen */}
      <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden select-none">
        {activeReactions.map((item) => {
          // Dynamic horizontal dispersion between 15% and 80% screen width
          const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const leftPercent = 15 + (hash % 70);

          return (
            <div
              key={item.id}
              className="absolute select-none pointer-events-none flex flex-col items-center"
              style={{
                left: `${leftPercent}%`,
                bottom: '120px',
                animation: 'cinema-float-up 2.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              }}
            >
              <span className="text-5xl sm:text-6xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.95)]">
                {item.emoji}
              </span>
              {item.username && (
                <span className="text-[10px] sm:text-xs text-white font-bold px-2.5 py-0.5 rounded-full bg-black/85 backdrop-blur-md mt-1 border border-white/20 shadow-2xl tracking-wide whitespace-nowrap">
                  {item.username}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Reaction Toolbar (Optimized for Mobile & Desktop) */}
      <div className="relative inline-flex items-center gap-1">
        <div className="flex items-center gap-0.5 sm:gap-1 bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner backdrop-blur-md">
          {POPULAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSendReaction(emoji)}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-xl sm:text-lg hover:scale-130 active:scale-90 transition-all rounded-lg hover:bg-white/15 active:bg-white/20 touch-manipulation select-none"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          {/* More Emojis Expand Button */}
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition touch-manipulation ${
              showPicker
                ? 'bg-red-600 text-white'
                : 'text-gray-400 hover:text-yellow-400 hover:bg-white/10'
            }`}
            title="More Reactions"
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>

        {/* Extended Reaction Picker Popup */}
        {showPicker && (
          <div className="absolute bottom-full mb-3 left-0 z-[100] bg-cinema-900/98 backdrop-blur-2xl border border-white/20 rounded-2xl p-2.5 shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95 max-w-[280px] flex-wrap">
            {EXTENDED_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSendReaction(emoji);
                  setShowPicker(false);
                }}
                className="w-9 h-9 flex items-center justify-center text-xl hover:scale-135 active:scale-90 transition-all rounded-xl hover:bg-white/10 touch-manipulation"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
