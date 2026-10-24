import React, { useState } from 'react';
import { ListMusic, Plus, SkipForward, AlertCircle, CheckCircle2, Clock, Check, X } from 'lucide-react';
import { QueueItem, Role, ChangeRequest } from '../types';
import { extractYouTubeVideoId } from '../utils/youtube';

interface PlaylistQueueProps {
  queue: QueueItem[];
  userRole: Role;
  pendingRequests?: ChangeRequest[];
  onAddToQueue: (videoId: string, title?: string) => void;
  onAdvanceQueue: () => void;
  onRequestSuggestQueue: (videoId: string) => void;
  onApproveRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
}

export const PlaylistQueue: React.FC<PlaylistQueueProps> = ({
  queue,
  userRole,
  pendingRequests = [],
  onAddToQueue,
  onAdvanceQueue,
  onRequestSuggestQueue,
  onApproveRequest,
  onRejectRequest,
}) => {
  const [videoInput, setVideoInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const canManage = userRole === 'Host' || userRole === 'Moderator';
  const queueRequests = pendingRequests.filter((r) => r.type === 'add_to_queue');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    submitVideo(videoInput);
  };

  const submitVideo = (input: string) => {
    setErrorMsg(null);
    setStatusMsg(null);

    const trimmed = input.trim();
    if (!trimmed) return;

    const id = extractYouTubeVideoId(trimmed);
    if (!id) {
      setErrorMsg('Invalid YouTube URL or ID. Please paste a link like https://youtu.be/... or 11-char ID.');
      return;
    }

    if (canManage) {
      onAddToQueue(id);
      setStatusMsg(`Added video (${id}) to queue!`);
    } else {
      onRequestSuggestQueue(id);
      setStatusMsg(`Suggestion sent to VIP Host for approval!`);
    }

    setVideoInput('');
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const samplePresets = [
    { label: '🎵 Lofi Beats', id: 'jfKfPfyJRdk' },
    { label: '⚡ Synthwave', id: '4xDzrJKXOOY' },
    { label: '🐇 Big Buck Bunny', id: 'aqz-KE-bpKQ' },
  ];

  return (
    <div className="bg-cinema-900/80 border border-white/5 rounded-2xl p-4 flex flex-col h-full shadow-lg backdrop-blur-md">
      {/* Queue Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-red-500" />
          <h3 className="font-bold text-white text-sm">Screening Queue</h3>
          <span className="bg-white/5 border border-white/10 text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {queue.length}
          </span>
        </div>

        {canManage && queue.length > 0 && (
          <button
            onClick={onAdvanceQueue}
            className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95"
            title="Skip to next queued video"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Next</span>
          </button>
        )}
      </div>

      {/* Status or Error Notifications */}
      {statusMsg && (
        <div className="mb-2 p-2 bg-green-500/15 border border-green-500/30 rounded-xl text-xs text-green-300 flex items-center gap-1.5 animate-in fade-in shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-2 p-2 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-1.5 animate-in fade-in shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Host / Moderator: Pending Suggestions Cluster */}
      {canManage && queueRequests.length > 0 && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-cinema-gold font-bold mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Pending Suggestions ({queueRequests.length})</span>
          </div>
          <div className="space-y-1.5 max-h-28 overflow-y-auto custom-scrollbar">
            {queueRequests.map((req) => (
              <div
                key={req.requestId}
                className="flex items-center justify-between p-1.5 rounded-lg bg-black/40 border border-white/5"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-white font-mono text-[11px] truncate">
                    {req.payload?.videoId || 'Video'}
                  </div>
                  <div className="text-gray-400 text-[10px]">by {req.username}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onApproveRequest?.(req.requestId)}
                    className="p-1 px-2 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold transition flex items-center gap-0.5"
                    title="Approve & add to queue"
                  >
                    <Check className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                  <button
                    onClick={() => onRejectRequest?.(req.requestId)}
                    className="p-1 px-1.5 bg-white/10 hover:bg-red-600/40 text-gray-300 hover:text-white rounded text-[10px] transition"
                    title="Reject suggestion"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue items list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-xs min-h-[140px]">
        {queue.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-center p-4 gap-2">
            <ListMusic className="w-6 h-6 text-gray-600 stroke-[1.5]" />
            <span>Playlist is empty. Add or suggest upcoming videos!</span>
          </div>
        ) : (
          queue.map((item, index) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between hover:border-white/10 transition"
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

      {/* Quick Testing Presets */}
      <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0 select-none">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider shrink-0">Try:</span>
        {samplePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => submitVideo(preset.id)}
            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[10px] font-semibold transition shrink-0 border border-white/5"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Add / Suggest form */}
      <form onSubmit={handleAdd} className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={videoInput}
          onChange={(e) => {
            setVideoInput(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder={canManage ? 'Paste YouTube URL or ID to queue...' : 'Suggest video to queue...'}
          className="flex-1 bg-cinema-950/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition shadow-inner"
        />
        <button
          type="submit"
          disabled={!videoInput.trim()}
          className="p-2.5 px-3 bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-md shadow-red-600/25 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{canManage ? 'Queue' : 'Suggest'}</span>
        </button>
      </form>
    </div>
  );
};
