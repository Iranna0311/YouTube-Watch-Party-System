import React, { useState, useEffect } from 'react';
import { Tv, Users, Play, Plus, ArrowRight, AlertCircle } from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/youtube';

interface LobbyProps {
  initialUsername: string;
  onJoinRoom: (username: string, roomCode: string) => void;
  onCreateRoom: (username: string, initialVideoId?: string) => void;
  errorMessage?: string;
}

export const Lobby: React.FC<LobbyProps> = ({
  initialUsername,
  onJoinRoom,
  onCreateRoom,
  errorMessage,
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
      setLocalError('Please choose a display username');
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
      setLocalError('Please choose a display username');
      return;
    }
    if (!roomCode.trim()) {
      setLocalError('Please enter a 6-character room code');
      return;
    }

    onJoinRoom(username.trim(), roomCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 shadow-xl shadow-red-500/20 mb-4">
            <Tv className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            WatchSync
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time synchronized YouTube watch parties with role controls
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          {/* Tabs */}
          <div className="flex gap-1.5 p-1 bg-gray-950/60 rounded-xl mb-6 border border-gray-800/60">
            <button
              onClick={() => {
                setTab('create');
                setLocalError('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                tab === 'create'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Room</span>
            </button>
            <button
              onClick={() => {
                setTab('join');
                setLocalError('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                tab === 'join'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Join Room</span>
            </button>
          </div>

          {(localError || errorMessage) && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError || errorMessage}</span>
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Alex"
                  maxLength={24}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Initial YouTube URL or Video ID (Optional)
                </label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition hover:scale-[1.01]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Watch Party (Become Host)</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Jordan"
                  maxLength={24}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  6-Character Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 725PQ4"
                  maxLength={6}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-widest text-white uppercase placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition hover:scale-[1.01]"
              >
                <span>Join Watch Party</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

