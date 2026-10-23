import React from 'react';
import { Check, X, Bell } from 'lucide-react';
import { ChangeRequest } from '../types';
import { formatTime } from '../utils/youtube';

interface ChangeRequestBannerProps {
  requests: ChangeRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export const ChangeRequestBanner: React.FC<ChangeRequestBannerProps> = ({
  requests,
  onApprove,
  onReject,
}) => {
  if (requests.length === 0) return null;

  return (
    <div className="space-y-2 mb-4 animate-in slide-in-from-top duration-200">
      {requests.map((req) => (
        <div
          key={req.requestId}
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
              <Bell className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-semibold text-yellow-400">
                Action Request from {req.username}
              </div>
              <div className="text-xs text-gray-300">
                {req.type === 'change_video' && (
                  <span>
                    Wants to switch video to{' '}
                    <code className="bg-gray-800 px-1 py-0.5 rounded text-yellow-300">
                      {req.payload.videoId}
                    </code>
                  </span>
                )}
                {req.type === 'seek' && (
                  <span>
                    Wants to seek to{' '}
                    <code className="bg-gray-800 px-1 py-0.5 rounded text-yellow-300">
                      {formatTime(req.payload.time)}
                    </code>
                  </span>
                )}
                {req.type === 'play' && <span>Wants to resume playback</span>}
                {req.type === 'pause' && <span>Wants to pause playback</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onApprove(req.requestId)}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow transition"
              title="Approve and apply change"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
            <button
              onClick={() => onReject(req.requestId)}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1 transition"
              title="Reject request"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

