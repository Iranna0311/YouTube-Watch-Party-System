import React, { useState, useEffect } from 'react';
import { Film, Users, Play, Plus, ArrowRight, AlertCircle, Sparkles, Clapperboard, Ticket } from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/youtube';

interface LobbyProps {
  initialUsername: string;
  onJoinRoom: (username: string, roomCode: string) => void;
  onCreateRoom: (username: string, initialVideoId?: string) => void;
  errorMessage?: string;
  isConnected?: boolean;
}

const CINEMA_PRESETS = [
  { title: 'Big Buck Bunny (4K Open Movie)', id: 'aqz-KE-bpKQ' },
  { title: 'Tears of Steel (Sci-Fi Short)', id: 'R6MlUcmgull' },
  { title: 'Synthwave Night Drive (Visualizer)', id: '4xDzrJKXOOY' },
];

export const Lobby: React.FC<LobbyProps> = ({
  initialUsername,
  onJoinRoom,
  onCreateRoom,
  errorMessage,
  isConnected = true,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [username, setUsername] = useState(initialUsername || '');
  const [roomCode, setRoomCode] = useState('');
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  const [localError, setLocalError] = useState('');

  // Auto-detect room code from query params (e.g. ?room=XYZ123)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('room');
    if (codeParam) {
      setRoomCode(codeParam.toUpperCase());
      setTab('join');
    }
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!username.trim()) {
      setLocalError('Please choose a premiere display name');
      return;
    }

    let extractedId: string | undefined = undefined;
    if (videoUrl.trim()) {
      const parsed = extractYouTubeVideoId(videoUrl);
      if (!parsed) {
        setLocalError('Invalid YouTube URL or Video ID');
        return;
      }
      extractedId = parsed;
    }

    onCreateRoom(username.trim(), extractedId);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!username.trim()) {
      setLocalError('Please enter your attendee name');
      return;
    }
    if (!roomCode.trim()) {
      setLocalError('Please enter a 6-character room code');
      return;
    }

    onJoinRoom(username.trim(), roomCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen cinema-bg text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-red-600/15 rounded-full blur-[140px] pointer-events-none animate-cinema-glow" />

      {/* Top Theater Header */}
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/80 border border-red-500/30 text-red-400 text-xs font-semibold tracking-wider uppercase mb-4 shadow-lg shadow-red-900/30">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Interactive Cinema Premiere</span>
          </div>
          
          <h1 className="text-4xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>Watch</span>
            <span className="text-red-500 text-glow-red">Sync</span>
            <span className="text-xs px-2 py-0.5 rounded bg-cinema-gold text-black font-extrabold ml-1">PRO</span>
          </h1>
          <p className="text-gray-400 text-xs mt-2 max-w-sm mx-auto">
            Experience synchronized frame-accurate movie nights, real-time chat, suggestion queues, and VIP host controls.
          </p>
        </div>

        {/* Cinema Card */}
        <div className="cinema-panel-glow rounded-3xl p-6 sm:p-7 shadow-screen backdrop-blur-2xl relative">
          {/* Subtle ticket corner notch illusion */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full bg-cinema-850 border border-red-500/30 text-[10px] font-mono tracking-widest text-red-300 uppercase flex items-center gap-1.5 shadow">
            <Ticket className="w-3 h-3 text-cinema-gold" />
            <span>ADMIT ALL • DOLBY SYNC</span>
          </div>
          {/* Live Server Connection Indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-4 mt-2 text-[11px] font-medium">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-400 animate-ping'}`} />
            <span className={isConnected ? 'text-gray-300' : 'text-yellow-400 font-semibold'}>
              {isConnected ? 'Server Online • Ready to Watch' : 'Connecting to Server...'}
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 p-1.5 bg-cinema-950/80 rounded-2xl mb-6 border border-white/5 mt-2">
            <button
              onClick={() => {
                setTab('create');
                setLocalError('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                tab === 'create'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Create Screening</span>
            </button>
            <button
              onClick={() => {
                setTab('join');
                setLocalError('');
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                tab === 'join'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Enter Theater</span>
            </button>
          </div>

          {/* Error Notice */}
          {(localError || errorMessage) && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{localError || errorMessage}</span>
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center justify-between">
                  <span>Host Name</span>
                  <span className="text-[10px] text-cinema-gold font-normal">Assigned VIP Host</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Captain Cinema"
                  maxLength={24}
                  className="w-full bg-cinema-900/90 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center justify-between">
                  <span>Premiere YouTube URL</span>
                  <span className="text-[10px] text-gray-400">or Paste Video ID</span>
                </label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-cinema-900/90 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition"
                />
              </div>

              {/* Quick Cinema Presets */}
              <div className="pt-1">
                <span className="text-[11px] font-medium text-gray-400 mb-2 block flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cinema-gold" />
                  <span>Popular Screening Suggestions:</span>
                </span>
                <div className="flex flex-col gap-1.5">
                  {CINEMA_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setVideoUrl(`https://www.youtube.com/watch?v=${preset.id}`)}
                      className="text-left px-3 py-1.5 rounded-lg bg-cinema-950/60 hover:bg-white/5 border border-white/5 text-[11px] text-gray-300 hover:text-white transition flex items-center justify-between group"
                    >
                      <span className="truncate">{preset.title}</span>
                      <span className="text-[10px] text-gray-500 group-hover:text-red-400 font-mono">Select &rarr;</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-3 py-3.5 bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-xl text-sm shadow-cinema flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Launch Screening Room</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Attendee Name
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Cinephile99"
                  maxLength={24}
                  className="w-full bg-cinema-900/90 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center justify-between">
                  <span>6-Character Room Pass</span>
                  <span className="text-[10px] text-gray-400">Ask your Host</span>
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 725PQ4"
                  maxLength={6}
                  className="w-full bg-cinema-900/90 border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono font-black tracking-widest text-cinema-gold uppercase placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl text-sm shadow-cinema flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Take Your Seat</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Feature Badges below card */}
        <div className="flex items-center justify-center gap-6 mt-6 text-gray-400 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>NTP Drift Sync</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cinema-gold" />
            <span>VIP Permissions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>Supabase DB</span>
          </div>
        </div>
      </div>
    </div>
  );
};
