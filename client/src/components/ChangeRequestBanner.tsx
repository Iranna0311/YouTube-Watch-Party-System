import React from 'react';
import { Check, X, Bell, Play, Pause, FastForward, Tv, ListMusic } from 'lucide-react';
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
    <div className="space-y-2 mb-3 animate-in slide-in-from-top-2 duration-200">
      {requests.map((req) => (
        <div
          key={req.requestId}
          className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/25 border border-amber-500/40 text-cinema-gold flex items-center justify-center shrink-0">
              {req.type === 'play' && <Play className="w-4 h-4 fill-current animate-pulse" />}
              {req.type === 'pause' && <Pause className="w-4 h-4 fill-current animate-pulse" />}
              {req.type === 'change_video' && <Tv className="w-4 h-4" />}
              {req.type === 'seek' && <FastForward className="w-4 h-4" />}
              {req.type === 'add_to_queue' && <ListMusic className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>Audience Request from {req.username}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-200 rounded font-mono uppercase">
                  {req.type.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-gray-200 truncate mt-0.5">
                {req.type === 'change_video' && (
                  <span>
                    Wants to switch screen video to{' '}
                    <code className="bg-black/60 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px] border border-white/10">
                      {req.payload?.videoId || 'video'}
                    </code>
                  </span>
                )}
                {req.type === 'seek' && (
                  <span>
                    Wants to seek playback to{' '}
                    <code className="bg-black/60 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px] border border-white/10">
                      {formatTime(req.payload?.time || 0)}
                    </code>
                  </span>
                )}
                {req.type === 'play' && <span>Wants to resume playing the video</span>}
                {req.type === 'pause' && <span>Wants to pause/stop the video</span>}
                {req.type === 'add_to_queue' && (
                  <span>
                    Wants to add{' '}
                    <code className="bg-black/60 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px] border border-white/10">
                      {req.payload?.videoId || 'video'}
                    </code>{' '}
                    to the upcoming playlist
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => onApprove(req.requestId)}
              className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-green-600/30 transition cursor-pointer"
              title="Approve and apply change for all viewers"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
            <button
              onClick={() => onReject(req.requestId)}
              className="px-3 py-1.5 bg-white/10 hover:bg-red-600/30 text-gray-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
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
