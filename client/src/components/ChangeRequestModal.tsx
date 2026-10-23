import React, { useState } from 'react';
import { Send, X, AlertCircle } from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/youtube';

interface ChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitRequest: (type: 'change_video' | 'seek', payload: any) => void;
}

export const ChangeRequestModal: React.FC<ChangeRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmitRequest,
}) => {
  const [requestType, setRequestType] = useState<'change_video' | 'seek'>('change_video');
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">Request Control Action</h3>
        <p className="text-xs text-gray-400 mb-4">
          As a participant, your request will be sent to the Host and Moderators for approval.
        </p>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-gray-800/80 rounded-lg">
            <button
              type="button"
              onClick={() => setRequestType('change_video')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                requestType === 'change_video'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Suggest Video
            </button>
            <button
              type="button"
              onClick={() => setRequestType('seek')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                requestType === 'seek'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Request Seek
            </button>
          </div>

          {requestType === 'change_video' ? (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                YouTube Video URL or ID
              </label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Seek Timestamp (seconds)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={seekSeconds}
                onChange={(e) => setSeekSeconds(e.target.value)}
                placeholder="e.g. 120 (for 2:00)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                autoFocus
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Request</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

