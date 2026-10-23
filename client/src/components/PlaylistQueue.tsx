import React, { useState } from 'react';
import { ListMusic, Plus, SkipForward, Trash2 } from 'lucide-react';
import { QueueItem, Role } from '../types';
import { extractYouTubeVideoId } from '../utils/youtube';

interface PlaylistQueueProps {
  queue: QueueItem[];
  userRole: Role;
  onAddToQueue: (videoId: string, title?: string) => void;
  onAdvanceQueue: () => void;
  onRequestSuggestQueue: (videoId: string) => void;
}

export const PlaylistQueue: React.FC<PlaylistQueueProps> = ({
  queue,
  userRole,
  onAddToQueue,
  onAdvanceQueue,
  onRequestSuggestQueue,
}) => {
  const [videoInput, setVideoInput] = useState('');
  const canManage = userRole === 'Host' || userRole === 'Moderator';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoInput.trim()) return;

    const id = extractYouTubeVideoId(videoInput);
    if (!id) return;

    if (canManage) {
      onAddToQueue(id);
    } else {
      onRequestSuggestQueue(id);
    }
    setVideoInput('');
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-white text-sm">Video Queue</h3>
          <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full font-mono">
            {queue.length}
          </span>
        </div>

        {canManage && queue.length > 0 && (
          <button
            onClick={onAdvanceQueue}
            className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
            title="Skip to next queued video"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Next</span>
          </button>
        )}
      </div>

      {/* Queue items list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-xs">
        {queue.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 italic text-center p-4">
            Playlist is empty. Add or suggest upcoming videos!
          </div>
        ) : (
          queue.map((item, index) => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg bg-gray-800/60 border border-gray-800 flex items-center justify-between hover:border-gray-700 transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-gray-500 font-bold w-4 text-center">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-gray-200 truncate">{item.title}</div>
                  <div className="text-[10px] text-gray-400">
                    Added by <span className="text-gray-300 font-semibold">{item.suggestedBy}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Suggest form */}
      <form onSubmit={handleAdd} className="mt-3 pt-3 border-t border-gray-800 flex gap-2">
        <input
          type="text"
          value={videoInput}
          onChange={(e) => setVideoInput(e.target.value)}
          placeholder={canManage ? 'Add video to queue...' : 'Suggest video to queue...'}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
        />
        <button
          type="submit"
          disabled={!videoInput.trim()}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{canManage ? 'Queue' : 'Suggest'}</span>
        </button>
      </form>
    </div>
  );
};

