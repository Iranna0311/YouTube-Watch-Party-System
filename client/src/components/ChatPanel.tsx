import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Sparkles, Mic, Square, X, Play, Pause, Volume2 } from 'lucide-react';
import { ChatMessage, Role } from '../types';
import { formatTime } from '../utils/youtube';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string, audioUrl?: string, audioDuration?: number) => void;
}

const VoiceMessageBubble: React.FC<{ audioUrl: string; duration?: number; isSelf: boolean }> = ({
  audioUrl,
  duration,
  isSelf,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setPlaybackTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
    };

    audio.onpause = () => {
      setIsPlaying(false);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((e) => console.warn('Audio playback error:', e));
      setIsPlaying(true);
    }
  };

  const totalDuration = duration || (audioRef.current?.duration ? Math.round(audioRef.current.duration) : 0);

  return (
    <div className="flex items-center gap-3 py-1 px-0.5 min-w-[210px] sm:min-w-[240px]">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition active:scale-95 shadow-md ${
          isSelf ? 'bg-white text-red-600 hover:bg-gray-100' : 'bg-red-600 text-white hover:bg-red-500'
        }`}
        title={isPlaying ? 'Pause audio' : 'Play voice note'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col justify-center select-none">
        {/* Animated Waveform Visualizer */}
        <div className="flex items-center gap-1 h-5">
          {[40, 70, 55, 95, 65, 100, 80, 90, 50, 75, 85, 45, 60, 80].map((height, i) => (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                isSelf ? 'bg-white/80' : 'bg-red-400'
              } ${isPlaying ? 'animate-pulse' : 'opacity-60'}`}
              style={{
                height: isPlaying ? `${Math.max(25, (height * (Math.sin(playbackTime * 5 + i) + 1.2)) / 2.2)}%` : `${height}%`,
              }}
            />
          ))}
        </div>

        {/* Timestamp & Duration */}
        <div className="flex items-center justify-between text-[10px] mt-1 font-mono opacity-80">
          <span>{formatTime(playbackTime)}</span>
          <span className="flex items-center gap-1">
            <Volume2 className="w-2.5 h-2.5 opacity-60" />
            <span>{totalDuration ? formatTime(totalDuration) : 'Voice'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up any recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 29) {
            stopAndSendRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone permission is required to record voice chat notes.');
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const finalDuration = recordingSeconds || 1;

    mediaRecorderRef.current.onstop = () => {
      const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mime });
      if (audioBlob.size > 0) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onSendMessage(text.trim(), base64Audio, finalDuration);
          setText('');
        };
        reader.readAsDataURL(audioBlob);
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsRecording(false);
      setRecordingSeconds(0);
    };

    mediaRecorderRef.current.stop();
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'Host':
        return 'text-cinema-gold font-bold flex items-center gap-1';
      case 'Moderator':
        return 'text-blue-400 font-bold';
      default:
        return 'text-gray-400 font-medium';
    }
  };

  return (
    <div className="bg-cinema-900/80 border border-white/5 rounded-2xl p-4 flex flex-col h-full shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-red-500" />
          <h3 className="font-bold text-white text-sm">Audience Chat</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startRecording}
            className="text-[11px] px-2.5 py-1 rounded-full bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer"
            title="Record Voice Note"
          >
            <Mic className="w-3.5 h-3.5 text-red-400 group-hover:text-white animate-pulse" />
            <span>Voice Note</span>
          </button>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 font-mono">
            {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 italic gap-2 py-12 select-none">
            <Sparkles className="w-5 h-5 text-gray-600" />
            <span>Theater chat is quiet. Say hello or send a voice note!</span>
          </div>
        ) : (
          messages.map((msg) => {
            // System Notification (User joined / User left)
            if (msg.userId === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300 font-medium tracking-wide flex items-center gap-1.5 shadow-sm">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isSelf = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                  <span className={getRoleBadge(msg.role)}>
                    {msg.username}
                    {msg.role === 'Host' && ' 👑'}
                  </span>
                  <span className="text-gray-500 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div
                  className={`p-2.5 px-3 rounded-2xl max-w-[85%] break-words leading-relaxed text-xs shadow-md ${
                    isSelf
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white rounded-br-none'
                      : 'bg-cinema-800 text-gray-200 border border-white/10 rounded-bl-none'
                  }`}
                >
                  {/* Voice Note Audio Player */}
                  {msg.audioUrl ? (
                    <div>
                      <VoiceMessageBubble
                        audioUrl={msg.audioUrl}
                        duration={msg.audioDuration}
                        isSelf={isSelf}
                      />
                      {msg.text && msg.text !== '🎙️ Voice Note' && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/15 text-xs">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input / Voice Recording Bar (Guaranteed sticky at bottom & immune to keyboard crush) */}
      <div className="mt-2 pt-2.5 border-t border-white/10 shrink-0">
        {isRecording ? (
          /* Active Voice Recording Controls */
          <div className="flex items-center justify-between gap-2 bg-red-950/60 border border-red-500/40 rounded-xl px-3.5 py-2 animate-in fade-in duration-200 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-red-300 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>Recording Voice Note...</span>
              <span className="font-mono text-white text-[11px] bg-red-600/30 px-2 py-0.5 rounded-full border border-red-500/30">
                {formatTime(recordingSeconds)} / 0:30
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg transition"
                title="Cancel recording"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="p-1.5 px-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-md shadow-red-600/40 cursor-pointer"
                title="Send voice note to theater"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal Message Input Form with Mic Button */
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Whisper message or record voice..."
              maxLength={500}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="flex-1 bg-cinema-950/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition shadow-inner"
            />

            {/* Voice Record Button (Prominent & High-Contrast) */}
            <button
              type="button"
              onClick={startRecording}
              className="p-2.5 px-3 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 rounded-xl transition flex items-center justify-center gap-1 shrink-0 cursor-pointer shadow-sm group"
              title="Record Voice Note (Tap to speak)"
            >
              <Mic className="w-4 h-4 text-red-400 group-hover:text-white animate-pulse" />
              <span className="text-[11px] font-bold text-red-300 group-hover:text-white">Voice</span>
            </button>

            {/* Text Send Button */}
            <button
              type="submit"
              disabled={!text.trim()}
              className="p-2.5 px-3 bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-40 disabled:hover:bg-red-600 text-white rounded-xl transition shadow-md shadow-red-600/30 flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed"
              title="Send message"
            >
              <Send className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
