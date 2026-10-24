import React from 'react';
import { EmojiReaction } from '../types';

interface FloatingReactionsProps {
  activeReactions: EmojiReaction[];
}

export const FloatingReactions: React.FC<FloatingReactionsProps> = ({ activeReactions }) => {
  if (activeReactions.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[99999] overflow-hidden select-none">
      {activeReactions.map((item, index) => {
        // Deterministic spread between 15% and 80% screen width based on reaction ID & timestamp
        const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const leftPercent = 15 + ((hash + index * 17) % 70);

        return (
          <div
            key={item.id}
            className="absolute select-none pointer-events-none flex flex-col items-center animate-cinema-float"
            style={{
              left: `${leftPercent}%`,
              bottom: '130px',
            }}
          >
            <span className="text-5xl sm:text-6xl drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]">
              {item.emoji}
            </span>
            <span className="text-[11px] sm:text-xs text-white font-extrabold px-3 py-1 rounded-full bg-black/90 backdrop-blur-md mt-1.5 border border-white/20 shadow-2xl tracking-wide whitespace-nowrap">
              {item.username || 'Viewer'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

