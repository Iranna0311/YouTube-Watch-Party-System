import React, { useState } from 'react';
import { Send, X, AlertCircle, Play, Pause, Tv, FastForward } from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/youtube';

interface ChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitRequest: (type: 'change_video' | 'seek' | 'play' | 'pause', payload: any) => void;
}

export const ChangeRequestModal: React.FC<ChangeRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmitRequest,
}) => {
  const [requestType, setRequestType] = useState<'change_video' | 'pause' | 'play' | 'seek'>('change_video');
  const [videoUrl, setVideoUrl] = useState('');
  const [seekSeconds, setSeekSeconds] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (requestType === 'change_video') {
      const videoId = extractYouTubeVideoId(videoUrl);
      if (!videoId) {
        setError('Please enter a valid YouTube URL or 11-character video ID');
        return;
      }
      onSubmitRequest('change_video', { videoId });
    } else if (requestType === 'pause') {
      onSubmitRequest('pause', {});
    } else if (requestType === 'play') {
      onSubmitRequest('play', {});
    } else {
      const secs = parseFloat(seekSeconds);
      if (isNaN(secs) || secs < 0) {
        setError('Please enter a valid seek time in seconds');
        return;
      }
      onSubmitRequest('seek', { time: secs });
    }

    onClose();
  };

  const samplePresets = [
    { label: '🎵 Lofi Beats', id: 'jfKfPfyJRdk' },
    { label: '⚡ Synthwave', id: '4xDzrJKXOOY' },
    { label: '🐇 Big Buck Bunny', id: 'aqz-KE-bpKQ' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-cinema-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <Send className="w-4 h-4 text-red-500" />
          <span>Audience Control Request</span>
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Request the VIP Host to pause, play, or change the screening video.
        </p>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setRequestType('change_video')}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                requestType === 'change_video'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Change Video</span>
            </button>
            <button
              type="button"
              onClick={() => setRequestType('pause')}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                requestType === 'pause'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Stop / Pause</span>
            </button>
            <button
              type="button"
              onClick={() => setRequestType('play')}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                requestType === 'play'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Play</span>
            </button>
          </div>

          {requestType === 'change_video' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  YouTube Video Link or ID:
                </label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste YouTube link (e.g. https://youtu.be/...)"
                  className="w-full bg-cinema-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition"
                  autoFocus
                />
              </div>

              {/* Sample Presets */}
              <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
                  Or pick a suggestion preset:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {samplePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setVideoUrl(preset.id)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-gray-300 hover:text-white transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {requestType === 'pause' && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 text-center">
              Request VIP Host to stop/pause the current playback for everyone in the theater.
            </div>
          )}

          {requestType === 'play' && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300 text-center">
              Request VIP Host to resume playing the video for everyone in the room.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-red-600/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {requestType === 'change_video'
                  ? 'Request Change Video'
                  : requestType === 'pause'
                  ? 'Request Pause Video'
                  : 'Request Play Video'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
