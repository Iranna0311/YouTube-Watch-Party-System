import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  AlertCircle,
  Settings,
  Tv,
  Radio,
  RotateCcw,
  FastForward,
  Rewind,
  Check,
  Send,
} from 'lucide-react';
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
  onRequestAction?: (action: 'play' | 'pause' | 'change_video') => void;
  onSendReaction?: (emoji: string) => void;
}

const QUALITY_OPTIONS = [
  { label: 'Auto (Recommended)', value: 'auto' },
  { label: '1080p HD', value: 'hd1080' },
  { label: '720p HD', value: 'hd720' },
  { label: '480p', value: 'large' },
  { label: '360p', value: 'medium' },
  { label: '240p', value: 'small' },
];

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  userRole,
  onEmitPlay,
  onEmitPause,
  onEmitSeek,
  onVideoEnded,
  syncState,
  onRequestControlModal,
  onRequestAction,
  onSendReaction,
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

  // Settings Menu state (Quality & Speed)
  const [showSettings, setShowSettings] = useState(false);
  const [showScreenControls, setShowScreenControls] = useState(false);
  const screenControlsTimerRef = useRef<any>(null);

  const handleScreenClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) {
      return;
    }
    setShowScreenControls((prev) => !prev);
    if (screenControlsTimerRef.current) clearTimeout(screenControlsTimerRef.current);
    screenControlsTimerRef.current = setTimeout(() => {
      setShowScreenControls(false);
    }, 3500);
  };
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [currentSpeed, setCurrentSpeed] = useState(1);

  // Flags & Timers to prevent event loop ping-pong
  const isRemoteUpdateRef = useRef(false);
  const remoteTimerRef = useRef<any>(null);
  const lastReportedTimeRef = useRef(0);
  const seekPollIntervalRef = useRef<any>(null);
  const clockOffsetRef = useRef<number>(0);

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
        if (typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(videoId);
          return;
        }
        try {
          playerRef.current.destroy();
        } catch {}
      }

      let target = document.getElementById('yt-player-target');
      if (!target && containerRef.current) {
        target = document.createElement('div');
        target.id = 'yt-player-target';
        target.className = 'w-full h-full';
        containerRef.current.appendChild(target);
      }
      if (!target) return;

      playerRef.current = new window.YT.Player('yt-player-target', {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            setIsReady(true);
            setDuration(event.target.getDuration() || 0);

            // Suppress spurious state change emissions on mount/join
            isRemoteUpdateRef.current = true;
            if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
            remoteTimerRef.current = setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 3000);

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

            // Sync UI play state with player without firing server pause emissions
            if (playerState === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (playerState === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
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
        } catch {}
      }
    };
  }, [videoId]);

  // 2. Poll player current time and detect scrubber seeks
  useEffect(() => {
    if (!isReady) return;

    seekPollIntervalRef.current = setInterval(() => {
      if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

      const playerTime = playerRef.current.getCurrentTime();
      setCurrentTime(playerTime);
      setDuration(playerRef.current.getDuration() || 0);

      lastReportedTimeRef.current = playerTime;
    }, 500);

    return () => {
      if (seekPollIntervalRef.current) clearInterval(seekPollIntervalRef.current);
    };
  }, [isReady]);

  // 3. Apply Server Sync State with drift correction
  const applySyncState = useCallback(
    (sync: SyncStatePayload, targetPlayer?: any) => {
      const player = targetPlayer || playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      isRemoteUpdateRef.current = true;
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 2000);

      let authoritativeTime = sync.currentTime;
      if (sync.playState === 'playing') {
        const serverNow = Date.now() + clockOffsetRef.current;
        authoritativeTime += Math.max(0, (serverNow - sync.serverTime) / 1000);
      }

      const clientTime = player.getCurrentTime();
      const drift = Math.abs(clientTime - authoritativeTime);

      if (drift > 0.5) {
        player.seekTo(authoritativeTime, true);
        setCurrentTime(authoritativeTime);
        lastReportedTimeRef.current = authoritativeTime;
      }

      if (sync.playState === 'playing') {
        try {
          player.playVideo();
          setIsPlaying(true);
        } catch (e) {
          console.warn('[YouTubePlayer] play error:', e);
        }

        // Modern browser autoplay policy fallback:
        // If unmuted playback is blocked by Chrome/Safari/mobile, auto-mute and continue playing in sync!
        setTimeout(() => {
          try {
            const state = player.getPlayerState();
            if (state !== 1 && state !== 3) {
              player.mute();
              setIsMuted(true);
              player.playVideo();
              setNeedsUserGesture(true);
            } else {
              setNeedsUserGesture(false);
            }
          } catch {}
        }, 400);
      } else {
        try {
          player.pauseVideo();
          if (drift > 0.3) {
            player.seekTo(authoritativeTime, true);
            setCurrentTime(authoritativeTime);
          }
          setIsPlaying(false);
          setNeedsUserGesture(false);
        } catch {}
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
      playerRef.current.pauseVideo();
      setIsPlaying(false);
      onEmitPause(time);
    } else {
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

  const handleSeekDelta = (deltaSeconds: number) => {
    if (!canControl) {
      if (onRequestControlModal) onRequestControlModal();
      return;
    }

    const targetTime = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    setCurrentTime(targetTime);

    if (!playerRef.current) return;
    isRemoteUpdateRef.current = true;
    playerRef.current.seekTo(targetTime, true);
    lastReportedTimeRef.current = targetTime;
    onEmitSeek(targetTime);
  };

  const handleQualityChange = (qValue: string) => {
    setCurrentQuality(qValue);
    if (playerRef.current && typeof playerRef.current.setPlaybackQuality === 'function') {
      playerRef.current.setPlaybackQuality(qValue);
    }
    setShowSettings(false);
  };

  const handleSpeedChange = (speed: number) => {
    setCurrentSpeed(speed);
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      playerRef.current.setPlaybackRate(speed);
    }
    setShowSettings(false);
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
      className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col group select-none border border-white/10"
    >
      {/* 16:9 Video Canvas Frame */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center">
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <div id="yt-player-target" className="w-full h-full" />
        </div>

        {/* On-Screen Center Video Controls Overlay (Always visible when paused, shows on hover/tap when playing) */}
        {!needsUserGesture && (
          <div
            onClick={handleScreenClick}
            className={`absolute inset-0 z-20 flex items-center justify-center gap-5 sm:gap-8 transition-all duration-300 pointer-events-auto cursor-pointer ${
              isPlaying && !showScreenControls
                ? 'opacity-0 hover:opacity-100 bg-black/30 hover:bg-black/50 backdrop-blur-[1px]'
                : 'opacity-100 bg-black/50 backdrop-blur-[2px]'
            }`}
          >
            {/* On-Screen -5s Skip */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSeekDelta(-5);
              }}
              className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white border border-white/15 flex flex-col items-center justify-center transition hover:scale-110 active:scale-90 shadow-2xl cursor-pointer"
              title="Rewind 5 seconds"
            >
              <Rewind className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              <span className="text-[9px] font-bold mt-0.5 tracking-tight">-5s</span>
            </button>

            {/* On-Screen Center Big Play/Pause Action Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePlay();
              }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/95 hover:bg-red-600 active:scale-95 text-white border-2 border-white/30 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-[0_0_35px_rgba(229,9,20,0.65)] cursor-pointer"
              title={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 sm:w-9 sm:h-9 fill-current" />
              ) : (
                <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-current ml-1" />
              )}
            </button>

            {/* On-Screen +5s Skip */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSeekDelta(5);
              }}
              className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white border border-white/15 flex flex-col items-center justify-center transition hover:scale-110 active:scale-90 shadow-2xl cursor-pointer"
              title="Fast forward 5 seconds"
            >
              <FastForward className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              <span className="text-[9px] font-bold mt-0.5 tracking-tight">+5s</span>
            </button>
          </div>
        )}

        {/* Mobile Autoplay Unblock Overlay */}
        {needsUserGesture && (
          <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
            <AlertCircle className="w-12 h-12 text-yellow-400 mb-3 animate-bounce" />
            <h3 className="text-xl font-bold text-white mb-2">Autoplay Audio Blocked</h3>
            <p className="text-gray-300 text-sm max-w-md mb-4">
              Tap below to sync audio and video with the theater.
            </p>
            <button
              onClick={handleUserGestureUnblock}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition"
            >
              Tap to Sync & Watch
            </button>
          </div>
        )}
      </div>

      {/* Modern Cinema Player Controls Section */}
      <div className="bg-cinema-900/95 border-t border-white/10 p-3 sm:p-4 flex flex-col gap-2.5">
        {/* Scrubber Progress Bar with Time Display (0:33 ------- 2:15) */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-300 min-w-[36px] text-right">
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!canControl}
            className={`w-full h-1.5 bg-white/20 hover:bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-600 transition-all focus:outline-none ${
              !canControl ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          />

          <span className="text-xs font-mono text-gray-400 min-w-[36px]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls Action Bar: Play, -10s, +10s, Live, Volume, Settings, Suggest Video, Fullscreen */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Controls Cluster */}
          <div className="flex items-center gap-2">
            {/* Host: Play/Pause. Guest/Friend: Request Play / Request Pause */}
            {canControl ? (
              <button
                onClick={handleTogglePlay}
                className="p-2 text-white hover:text-red-500 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onRequestAction) {
                    onRequestAction(isPlaying ? 'pause' : 'play');
                  } else if (onRequestControlModal) {
                    onRequestControlModal();
                  }
                }}
                className="px-3 sm:px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-red-600/30 active:scale-95 cursor-pointer"
                title={isPlaying ? 'Request VIP Host to pause video' : 'Request VIP Host to play video'}
              >
                <Send className="w-3.5 h-3.5 -rotate-12" />
                <span>{isPlaying ? 'Request Pause' : 'Request Play'}</span>
              </button>
            )}

            {/* Skip Backward -10s */}
            <button
              onClick={() => handleSeekDelta(-5)}
              className="px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl border border-white/10 text-xs font-semibold transition flex items-center gap-1"
              title="Rewind 5 seconds"
            >
              <Rewind className="w-3.5 h-3.5" />
              <span>-5s</span>
            </button>

            {/* Skip Forward +10s */}
            <button
              onClick={() => handleSeekDelta(5)}
              className="px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl border border-white/10 text-xs font-semibold transition flex items-center gap-1"
              title="Fast forward 5 seconds"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>+5s</span>
            </button>

            {/* ((o)) Live Indicator Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-bold tracking-wide select-none shadow-sm">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Live</span>
            </div>

            {/* Volume Control */}
            <div className="hidden sm:flex items-center gap-2 ml-1">
              <button
                onClick={handleToggleMute}
                className="p-1.5 text-gray-300 hover:text-white transition"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
          </div>

          {/* Right Controls Cluster: Settings, Suggest Video, Fullscreen */}
          <div className="flex items-center gap-2 relative">
            {/* Settings Gear (Video Quality & Playback Speed Menu) */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl transition border ${
                  showSettings
                    ? 'bg-red-600 text-white border-red-500'
                    : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'
                }`}
                title="Settings (Video Quality & Speed)"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Quality & Speed Dropdown Popover */}
              {showSettings && (
                <div className="absolute right-0 bottom-full mb-3 z-50 bg-cinema-900/98 backdrop-blur-2xl border border-white/15 rounded-2xl p-3 shadow-2xl w-60 animate-in fade-in zoom-in-95 text-xs text-white">
                  <div className="font-bold text-gray-400 uppercase tracking-wider text-[10px] pb-1.5 mb-2 border-b border-white/10">
                    Playback Settings
                  </div>

                  {/* Quality Section */}
                  <div className="mb-3">
                    <span className="font-semibold text-gray-300 block mb-1.5">Video Quality:</span>
                    <div className="grid grid-cols-2 gap-1">
                      {QUALITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleQualityChange(opt.value)}
                          className={`px-2 py-1.5 rounded-lg text-left text-xs transition flex items-center justify-between ${
                            currentQuality === opt.value
                              ? 'bg-red-600 text-white font-bold'
                              : 'bg-white/5 hover:bg-white/10 text-gray-300'
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          {currentQuality === opt.value && <Check className="w-3 h-3 ml-1 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Speed Section */}
                  <div>
                    <span className="font-semibold text-gray-300 block mb-1.5">Playback Speed:</span>
                    <div className="flex items-center gap-1">
                      {SPEED_OPTIONS.map((spd) => (
                        <button
                          key={spd}
                          onClick={() => handleSpeedChange(spd)}
                          className={`flex-1 py-1 rounded-lg text-center text-xs transition ${
                            currentSpeed === spd
                              ? 'bg-red-600 text-white font-bold'
                              : 'bg-white/5 hover:bg-white/10 text-gray-300'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggest Video Button */}
            <button
              onClick={onRequestControlModal}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl border border-white/10 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Suggest or change video"
            >
              <Tv className="w-4 h-4 text-red-400" />
              <span>Suggest Video</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={handleFullscreen}
              className="p-2 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
              title="Toggle Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Centered Emoji Reactions Row (Directly Matching Uploaded Design) */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 pt-2.5 pb-0.5 border-t border-white/5 select-none">
          {['🔥', '❤️', '👏', '😂', '🍿', '🎉', '🚀'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSendReaction?.(emoji)}
              className="text-2xl sm:text-3xl hover:scale-135 active:scale-90 transition-transform p-1 rounded-xl hover:bg-white/10 touch-manipulation"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
