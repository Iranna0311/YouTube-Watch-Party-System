import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, AlertCircle } from 'lucide-react';
import { Role, SyncStatePayload } from '../types';
import { formatTime } from '../utils/youtube';
import { socket } from '../services/socket';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  userRole: Role;
  onEmitPlay: (currentTime: number) => void;
  onEmitPause: (currentTime: number) => void;
  onEmitSeek: (time: number) => void;
  onVideoEnded?: () => void;
  syncState: SyncStatePayload | null;
  onRequestControlModal?: () => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  userRole,
  onEmitPlay,
  onEmitPause,
  onEmitSeek,
  onVideoEnded,
  syncState,
  onRequestControlModal,
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);

  // Flags & Timers to prevent event loop ping-pong
  const isRemoteUpdateRef = useRef(false);
  const remoteTimerRef = useRef<any>(null);
  const lastReportedTimeRef = useRef(0);
  const seekPollIntervalRef = useRef<any>(null);

  // NTP Clock Offset measurement (Bug A fix)
  const clockOffsetRef = useRef(0);

  const canControl = userRole === 'Host' || userRole === 'Moderator';

  // NTP Clock sync every 30 seconds
  useEffect(() => {
    const syncClock = () => {
      const t0 = Date.now();
      socket.emit('time_ping', (serverTime: number) => {
        const t1 = Date.now();
        clockOffsetRef.current = serverTime - (t0 + t1) / 2;
      });
    };

    syncClock();
    const interval = setInterval(syncClock, 30000);
    return () => clearInterval(interval);
  }, []);

  // 1. Initialize YouTube Player
  useEffect(() => {
    let checkYTInterval: any = null;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player('yt-player-target', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            setDuration(event.target.getDuration() || 0);

            if (syncState) {
              applySyncState(syncState, event.target);
            }
          },
          onStateChange: (event: any) => {
            const playerState = event.data;

            // Video ended: auto-advance queue
            if (playerState === 0) {
              if (canControl && onVideoEnded) {
                onVideoEnded();
              }
              return;
            }

            // Suppress event if triggered by remote update
            if (isRemoteUpdateRef.current) {
              if (playerState === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
              } else if (playerState === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              }
              return;
            }

            // Local user interacted directly with video
            if (canControl) {
              if (playerState === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                onEmitPlay(event.target.getCurrentTime());
              } else if (playerState === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                onEmitPause(event.target.getCurrentTime());
              }
            } else {
              // Participant attempted to control: revert to authoritative state
              if (syncState) {
                applySyncState(syncState, event.target);
              }
            }
          },
          onError: (err: any) => {
            console.error('[YouTubePlayer Error]:', err);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      checkYTInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          if (checkYTInterval) clearInterval(checkYTInterval);
          initPlayer();
        }
      }, 100);
    }

    return () => {
      if (checkYTInterval) clearInterval(checkYTInterval);
      if (seekPollIntervalRef.current) clearInterval(seekPollIntervalRef.current);
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [videoId]);

  // 2. Poll player current time and detect scrubber seeks & jumps
  useEffect(() => {
    if (!isReady) return;

    seekPollIntervalRef.current = setInterval(() => {
      if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

      const playerTime = playerRef.current.getCurrentTime();
      setCurrentTime(playerTime);
      setDuration(playerRef.current.getDuration() || 0);

      if (canControl && !isRemoteUpdateRef.current) {
        const expectedDiff = Math.abs(playerTime - (lastReportedTimeRef.current + 0.5));
        if (expectedDiff > 1.5 && Math.abs(playerTime - lastReportedTimeRef.current) > 1.5) {
          onEmitSeek(playerTime);
        }
      }

      lastReportedTimeRef.current = playerTime;
    }, 500);

    return () => {
      if (seekPollIntervalRef.current) clearInterval(seekPollIntervalRef.current);
    };
  }, [isReady, canControl, onEmitSeek]);

  /**
   * 3. Apply Server Sync State (Bug A & Bug B fixes)
   */
  const applySyncState = useCallback(
    (sync: SyncStatePayload, targetPlayer?: any) => {
      const player = targetPlayer || playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      // Bug B fix: Reset isRemoteUpdateRef after timeout so it never gets stuck
      isRemoteUpdateRef.current = true;
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 500);

      // Bug A fix: Correctly advance authoritativeTime as of sync.serverTime without double-counting
      let authoritativeTime = sync.currentTime;
      if (sync.playState === 'playing') {
        const serverNow = Date.now() + clockOffsetRef.current;
        authoritativeTime += Math.max(0, (serverNow - sync.serverTime) / 1000);
      }

      const clientTime = player.getCurrentTime();
      const drift = Math.abs(clientTime - authoritativeTime);

      // DRIFT CORRECTION: Only seek if drift exceeds threshold (1.0s)
      if (drift > 1.0) {
        player.seekTo(authoritativeTime, true);
        setCurrentTime(authoritativeTime);
        lastReportedTimeRef.current = authoritativeTime;
      }

      if (sync.playState === 'playing') {
        const playPromise = player.playVideo();
        setIsPlaying(true);
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            setNeedsUserGesture(true);
          });
        }
      } else {
        player.pauseVideo();
        setIsPlaying(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isReady && syncState) {
      applySyncState(syncState);
    }
  }, [syncState, isReady, applySyncState]);

  // Controls Handlers
  const handleTogglePlay = () => {
    if (!canControl) {
      if (onRequestControlModal) onRequestControlModal();
      return;
    }

    if (!playerRef.current) return;
    const time = playerRef.current.getCurrentTime();

    if (isPlaying) {
      isRemoteUpdateRef.current = true;
      playerRef.current.pauseVideo();
      setIsPlaying(false);
      onEmitPause(time);
    } else {
      isRemoteUpdateRef.current = true;
      playerRef.current.playVideo();
      setIsPlaying(true);
      onEmitPlay(time);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);

    if (!canControl) {
      if (onRequestControlModal) onRequestControlModal();
      return;
    }

    if (!playerRef.current) return;
    isRemoteUpdateRef.current = true;
    playerRef.current.seekTo(targetTime, true);
    lastReportedTimeRef.current = targetTime;
    onEmitSeek(targetTime);
  };

  const handleToggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (playerRef.current) {
      playerRef.current.setVolume(val);
      if (val === 0) setIsMuted(true);
      else if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  };

  const handleUserGestureUnblock = () => {
    if (playerRef.current) {
      playerRef.current.unMute();
      playerRef.current.playVideo();
      setNeedsUserGesture(false);
      setIsPlaying(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl flex flex-col group select-none"
    >
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div id="yt-player-target" className="w-full h-full" />
      </div>

      {needsUserGesture && (
        <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mb-3 animate-bounce" />
          <h3 className="text-xl font-bold text-white mb-2">Autoplay Audio Blocked</h3>
          <p className="text-gray-300 text-sm max-w-md mb-4">
            Click below to unblock browser audio playback.
          </p>
          <button
            onClick={handleUserGestureUnblock}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-lg transition"
          >
            Click to Start & Unmute Audio
          </button>
        </div>
      )}

      <div
        onClick={handleTogglePlay}
        className="absolute inset-0 z-10 cursor-pointer"
        title={canControl ? 'Click to Play/Pause' : 'Participant: View only (Click to request)'}
      />

      <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!canControl}
            className={`w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none ${
              !canControl ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTogglePlay}
              className={`p-2 text-white hover:text-red-500 transition rounded-full hover:bg-white/10 ${
                !canControl ? 'opacity-50 hover:opacity-80' : ''
              }`}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMute}
                className="p-1.5 text-gray-300 hover:text-white transition"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="text-xs font-mono text-gray-300">
              <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!canControl && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded">
                Watch Only
              </span>
            )}

            <button
              onClick={handleFullscreen}
              className="p-1.5 text-gray-300 hover:text-white transition rounded hover:bg-white/10"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
