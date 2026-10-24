import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { EmojiReaction } from '../types';

const POPULAR_EMOJIS = ['❤️', '🔥', '😂', '👏', '🍿', '🚀'];
const ALL_EMOJIS = ['❤️', '🔥', '😂', '👏', '🍿', '🚀', '🎉', '😍', '😮', '🤯', '💯', '✨'];

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
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {activeReactions.map((item) => {
          // Calculate an organic horizontal position between 15% and 85% of screen width
          const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const leftPercent = 15 + (hash % 70);

          return (
            <div
              key={item.id}
              className="absolute select-none pointer-events-none flex flex-col items-center"
              style={{
                left: `${leftPercent}%`,
                bottom: '100px',
                animation: 'cinema-float-up 2.8s cubic-bezier(0.25, 1, 0.5, 1) forwards',
              }}
            >
              <span className="text-4xl sm:text-5xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)] filter">
                {item.emoji}
              </span>
              {item.username && (
                <span className="text-[10px] text-white/90 font-bold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md mt-1 border border-white/10 shadow-lg tracking-wide">
                  {item.username}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Reaction Toolbar */}
      <div className="relative inline-flex items-center gap-1.5">
        {/* Quick One-Tap Reactions Bar */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner backdrop-blur-md">
          {POPULAR_EMOJIS.slice(0, 4).map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:scale-130 active:scale-95 transition-all rounded-lg hover:bg-white/15 select-none"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          {/* More Emojis Expand Button */}
          <button
            onClick={() => setShowPicker(!showPicker)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition ${
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
          <div className="absolute bottom-full mb-3 left-0 z-50 bg-cinema-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-2.5 shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95">
            {ALL_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onSendReaction(emoji);
                  setShowPicker(false);
                }}
                className="w-9 h-9 flex items-center justify-center text-xl hover:scale-135 active:scale-90 transition-all rounded-xl hover:bg-white/10"
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
