import React, { useState, useEffect } from 'react';
import { Smile } from 'lucide-react';
import { EmojiReaction } from '../types';

const EMOJIS = ['❤️', '🔥', '😂', '👏', '🍿', '🚀'];

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
      {/* Floating Animated Emojis in Theater */}
      <div className="pointer-events-none fixed bottom-24 right-8 z-40 flex flex-col items-end overflow-hidden h-96 w-32">
        {activeReactions.map((item) => (
          <div
            key={item.id}
            className="animate-float text-3xl mb-2 drop-shadow-lg select-none"
            style={{
              transform: `translateX(${(Math.random() - 0.5) * 40}px)`,
            }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* Emoji Trigger & Quick Picker Bar */}
      <div className="relative inline-block">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 transition flex items-center gap-1.5 text-xs font-medium"
          title="React with Emoji"
        >
          <Smile className="w-4 h-4 text-yellow-400" />
          <span>React</span>
        </button>

        {showPicker && (
          <div className="absolute bottom-full mb-2 left-0 z-30 bg-gray-900 border border-gray-800 rounded-xl p-2 shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onSendReaction(emoji);
                  setShowPicker(false);
                }}
                className="text-lg hover:scale-125 transition-transform p-1.5 rounded-lg hover:bg-gray-800"
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

