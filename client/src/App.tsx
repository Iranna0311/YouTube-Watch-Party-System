import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tv,
  Copy,
  Check,
  LogOut,
  Send,
  AlertCircle,
  History,
  ListMusic,
  Users,
  MessageSquare,
  Crown,
  Shield,
  Eye,
  Film,
  Sparkles,
  Ticket,
  Moon,
  Sun,
  Clapperboard,
} from 'lucide-react';
import { socket } from './services/socket';
import {
  Role,
  ParticipantData,
  SyncStatePayload,
  ChangeRequest,
  ChatMessage,
  EmojiReaction,
  QueueItem,
  AuditLogEntry,
} from './types';
import {
  getOrCreateUserId,
  getSavedUsername,
  saveUsername,
  getSessionToken,
  saveSessionToken,
} from './utils/userId';
import { extractYouTubeVideoId } from './utils/youtube';
import { Lobby } from './components/Lobby';
import { YouTubePlayer } from './components/YouTubePlayer';
import { ParticipantList } from './components/ParticipantList';
import { ChatPanel } from './components/ChatPanel';
import { ChangeRequestBanner } from './components/ChangeRequestBanner';
import { ChangeRequestModal } from './components/ChangeRequestModal';
import { EmojiReactions } from './components/EmojiReactions';
import { PlaylistQueue } from './components/PlaylistQueue';
import { AuditLogModal } from './components/AuditLogModal';

export const App: React.FC = () => {
  const userId = useRef(getOrCreateUserId()).current;

  // Session & Room State
  const [inRoom, setInRoom] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<Role>('Participant');
  const [username, setUsername] = useState(getSavedUsername());
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // Video & Queue State
  const [videoId, setVideoId] = useState('M7lc1UVf-VE');
  const [syncState, setSyncState] = useState<SyncStatePayload | null>(null);
  const [newVideoInput, setNewVideoInput] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Active Tab in Sidebar (participants | queue | chat)
  const [sidebarTab, setSidebarTab] = useState<'participants' | 'queue' | 'chat'>('chat');

  // Approval Requests
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Chat & Reactions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeReactions, setActiveReactions] = useState<EmojiReaction[]>([]);

  // Cinema Mode / Theater Lights toggle
  const [theaterMode, setTheaterMode] = useState(false);

  // Toast / Error
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // 1. Socket Event Listeners
  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      console.log('[Socket Connected]:', socket.id);
      setIsConnected(true);
    });
    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on(
      'room_created',
      (data: {
        roomCode: string;
        host: ParticipantData;
        sessionToken: string;
        syncState: SyncStatePayload;
        queue?: QueueItem[];
        auditLog?: AuditLogEntry[];
      }) => {
        setRoomCode(data.roomCode);
        setCurrentUserRole(data.host.role);
        setVideoId(data.syncState.videoId);
        setSyncState(data.syncState);
        if (data.sessionToken) saveSessionToken(data.sessionToken);
        if (data.queue) setQueue(data.queue);
        if (data.auditLog) setAuditLogs(data.auditLog);
        setInRoom(true);

        window.history.pushState({}, '', `?room=${data.roomCode}`);
      }
    );

    socket.on('session_authenticated', (data: { sessionToken: string; role: Role }) => {
      if (data.sessionToken) saveSessionToken(data.sessionToken);
      if (data.role) setCurrentUserRole(data.role);
    });

    socket.on('sync_state', (payload: SyncStatePayload) => {
      setSyncState(payload);
      if (payload.videoId && payload.videoId !== videoId) {
        setVideoId(payload.videoId);
      }
    });

    socket.on(
      'user_joined',
      (data: { userId: string; username: string; role: Role; participants: ParticipantData[] }) => {
        setParticipants(data.participants);
        const me = data.participants.find((p) => p.userId === userId);
        if (me) {
          setCurrentUserRole(me.role);
        }
        setInRoom(true);

        // Notify room when someone joins
        if (data.userId !== userId) {
          showToast(`🎬 ${data.username} joined the screening (${data.role})`);
          setChatMessages((prev) => [
            ...prev,
            {
              id: 'sys_' + Math.random().toString(36).substring(2, 9),
              userId: 'system',
              username: 'System',
              role: 'Participant',
              text: `🎬 ${data.username} joined the screening (${data.role})`,
              timestamp: Date.now(),
            },
          ]);
        }
      }
    );

    socket.on('user_left', (data: { userId: string; username: string; participants: ParticipantData[] }) => {
      setParticipants(data.participants);
      if (data.userId !== userId) {
        showToast(`👋 ${data.username} left the room`);
        setChatMessages((prev) => [
          ...prev,
          {
            id: 'sys_' + Math.random().toString(36).substring(2, 9),
            userId: 'system',
            username: 'System',
            role: 'Participant',
            text: `👋 ${data.username} left the theater`,
            timestamp: Date.now(),
          },
        ]);
      }
    });

    socket.on(
      'role_assigned',
      (data: { userId: string; username: string; role: Role; participants: ParticipantData[] }) => {
        setParticipants(data.participants);
        if (data.userId === userId) {
          setCurrentUserRole(data.role);
          showToast(`Your role was updated to: ${data.role}`);
        }
      }
    );

    socket.on('change_video', (data: { videoId: string }) => {
      setVideoId(data.videoId);
    });

    socket.on('queue_updated', (updatedQueue: QueueItem[]) => {
      setQueue(updatedQueue);
    });

    socket.on('audit_log_entry', (entry: AuditLogEntry) => {
      setAuditLogs((prev) => [...prev, entry]);
    });

    socket.on('audit_log_updated', (logs: AuditLogEntry[]) => {
      setAuditLogs(logs);
    });

    socket.on(
      'participant_removed',
      (data: { userId: string; reason?: string; participants?: ParticipantData[] }) => {
        if (data.userId === userId) {
          alert(data.reason || 'You have been removed from this room by the host.');
          setInRoom(false);
          setRoomCode('');
          window.history.pushState({}, '', window.location.pathname);
        } else if (data.participants) {
          setParticipants(data.participants);
        }
      }
    );

    // Approval Request Events
    socket.on('change_request_received', (req: ChangeRequest) => {
      setPendingRequests((prev) => [...prev, req]);
    });

    socket.on('change_request_submitted', () => {
      showToast('Your request was submitted for approval.');
    });

    socket.on('change_request_resolved', (data: { requestId: string; status: string; approvedBy?: string }) => {
      setPendingRequests((prev) => prev.filter((r) => r.requestId !== data.requestId));
      if (data.status === 'approved') {
        showToast(`Request was approved by ${data.approvedBy || 'staff'}!`);
      } else {
        showToast('Request was rejected.');
      }
    });

    // Chat & Reactions
    socket.on('chat_message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('reaction', (reaction: EmojiReaction) => {
      if (reaction.userId === userId) return;
      setActiveReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3000);
    });

    socket.on('error', (err: { message: string }) => {
      showToast(err.message || 'An unexpected error occurred');
    });

    return () => {
      socket.off('connect');
      socket.off('room_created');
      socket.off('session_authenticated');
      socket.off('sync_state');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('role_assigned');
      socket.off('change_video');
      socket.off('queue_updated');
      socket.off('audit_log_entry');
      socket.off('audit_log_updated');
      socket.off('participant_removed');
      socket.off('change_request_received');
      socket.off('change_request_submitted');
      socket.off('change_request_resolved');
      socket.off('chat_message');
      socket.off('reaction');
      socket.off('error');
    };
  }, [userId, videoId, showToast]);

  // Handlers for Lobby
  const handleCreateRoom = (chosenUsername: string, initialVideo?: string) => {
    setUsername(chosenUsername);
    saveUsername(chosenUsername);
    socket.emit('create_room', {
      userId,
      username: chosenUsername,
      initialVideoId: initialVideo,
    });
  };

  const handleJoinRoom = (chosenUsername: string, code: string) => {
    setUsername(chosenUsername);
    saveUsername(chosenUsername);
    setRoomCode(code);
    if (!socket.connected) {
      socket.connect();
    }
    const existingToken = getSessionToken();
    socket.emit('join_room', {
      roomId: code,
      username: chosenUsername,
      userId,
      sessionToken: existingToken || undefined,
    });
  };

  // Playback Control Handlers
  const handleEmitPlay = (time: number) => {
    socket.emit('play', { currentTime: time });
  };

  const handleEmitPause = (time: number) => {
    socket.emit('pause', { currentTime: time });
  };

  const handleEmitSeek = (time: number) => {
    socket.emit('seek', { time });
  };

  const handleVideoEnded = () => {
    socket.emit('advance_queue');
  };

  const handleChangeVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoInput.trim()) return;

    const parsedId = extractYouTubeVideoId(newVideoInput);
    if (!parsedId) {
      showToast('Invalid YouTube URL or ID format');
      return;
    }

    if (currentUserRole === 'Participant') {
      socket.emit('change_request', {
        type: 'change_video',
        payload: { videoId: parsedId },
      });
      setNewVideoInput('');
      return;
    }

    socket.emit('change_video', { videoId: parsedId });
    setNewVideoInput('');
  };

  // Queue Handlers
  const handleAddToQueue = (queuedVideoId: string) => {
    socket.emit('add_to_queue', { videoId: queuedVideoId });
  };

  const handleAdvanceQueue = () => {
    socket.emit('advance_queue');
  };

  const handleSuggestQueue = (queuedVideoId: string) => {
    socket.emit('change_request', {
      type: 'add_to_queue',
      payload: { videoId: queuedVideoId },
    });
  };

  // Role & Room Administration
  const handleAssignRole = (targetUserId: string, newRole: Role) => {
    socket.emit('assign_role', { userId: targetUserId, role: newRole });
  };

  const handleRemoveParticipant = (targetUserId: string) => {
    socket.emit('remove_participant', { userId: targetUserId });
  };

  const handleTransferHost = (targetUserId: string) => {
    socket.emit('transfer_host', { userId: targetUserId });
  };

  // Change Request Approvals
  const handleApproveRequest = (requestId: string) => {
    socket.emit('approve_request', { requestId });
  };

  const handleRejectRequest = (requestId: string) => {
    socket.emit('reject_request', { requestId });
  };

  const handleSubmitParticipantRequest = (type: 'change_video' | 'seek', payload: any) => {
    socket.emit('change_request', { type, payload });
  };

  const handleSendMessage = (text: string) => {
    socket.emit('chat_message', { text });
  };

  const handleSendReaction = (emoji: string) => {
    socket.emit('reaction', { emoji });
    const localReaction: EmojiReaction = {
      id: 'react_local_' + Math.random().toString(36).substring(2, 9),
      emoji,
      userId,
      username: username || 'You',
      timestamp: Date.now(),
    };
    setActiveReactions((prev) => [...prev, localReaction]);
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== localReaction.id));
    }, 3000);
  };

  const handleLeaveRoom = () => {
    socket.emit('leave_room', { roomId: roomCode });
    setInRoom(false);
    setRoomCode('');
    setParticipants([]);
    setChatMessages([]);
    window.history.pushState({}, '', window.location.pathname);
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!inRoom) {
    return (
      <Lobby
        initialUsername={username}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  const canManagePlayback = currentUserRole === 'Host' || currentUserRole === 'Moderator';

  return (
    <div className={`min-h-screen text-white flex flex-col transition-colors duration-700 ${theaterMode ? 'bg-black' : 'cinema-bg'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 cinema-panel-glow border-red-500/40 text-gray-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Cinema Marquee Bar */}
      <header className={`h-16 border-b transition-all duration-500 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 ${
        theaterMode
          ? 'border-white/5 bg-black/80 backdrop-blur-md'
          : 'border-white/10 cinema-panel shadow-md'
      }`}>
        {/* Brand & Room Pass */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 font-black text-base tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Clapperboard className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:inline">Watch<span className="text-red-500 text-glow-red">Sync</span></span>
          </div>

          {/* Ticket Room Badge */}
          <div className="flex items-center gap-1.5 bg-cinema-900/90 border border-red-500/30 rounded-xl px-3 py-1.5 text-xs shadow-sm">
            <Ticket className="w-3.5 h-3.5 text-cinema-gold" />
            <span className="text-gray-400 text-[11px] font-medium hidden md:inline">PASS:</span>
            <span className="font-mono font-black text-white tracking-widest text-sm">{roomCode}</span>
            <button
              onClick={copyCode}
              className="p-1 text-gray-400 hover:text-white transition rounded ml-0.5"
              title="Copy Room Code"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            onClick={copyRoomLink}
            className="hidden md:flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 text-xs transition font-semibold"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
            <span>{copiedLink ? 'Copied Link!' : 'Invite Audience'}</span>
          </button>
        </div>

        {/* Change Video Input Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-sm sm:max-w-md mx-2 sm:mx-4">
          <form onSubmit={handleChangeVideoSubmit} className="flex-1 flex gap-1.5">
            <input
              type="text"
              value={newVideoInput}
              onChange={(e) => setNewVideoInput(e.target.value)}
              placeholder={canManagePlayback ? 'Load YouTube URL or Video ID...' : 'Suggest a YouTube video to staff...'}
              className="w-full bg-cinema-900/90 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition"
            />
            <button
              type="submit"
              disabled={!newVideoInput.trim()}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shrink-0 transition shadow-md shadow-red-600/20"
            >
              {canManagePlayback ? 'Screen' : 'Suggest'}
            </button>
          </form>
        </div>

        {/* Cinema Controls & Role Badges */}
        <div className="flex items-center gap-2.5">
          {/* Theater Lights Toggle */}
          <button
            onClick={() => setTheaterMode(!theaterMode)}
            className={`p-2 rounded-xl transition border ${
              theaterMode
                ? 'bg-cinema-gold/20 text-cinema-gold border-cinema-gold/40 shadow-sm'
                : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
            }`}
            title={theaterMode ? 'Turn Theater Lights ON' : 'Turn Lights OFF (Theater Mode)'}
          >
            {theaterMode ? <Sun className="w-4 h-4 text-cinema-gold" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Room Audit Log Modal Button */}
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
            title="View Screening Audit Log"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Role Pill */}
          {currentUserRole === 'Host' ? (
            <span className="text-xs bg-amber-500/15 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-sm">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">VIP HOST</span>
            </span>
          ) : currentUserRole === 'Moderator' ? (
            <span className="text-xs bg-blue-500/15 border border-blue-500/40 text-blue-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">MODERATOR</span>
            </span>
          ) : (
            <span className="text-xs bg-white/5 border border-white/10 text-gray-300 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-gray-400" />
              <span className="hidden sm:inline">AUDIENCE</span>
            </span>
          )}

          {/* Exit Room Button */}
          <button
            onClick={handleLeaveRoom}
            className="p-2 text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-xl transition"
            title="Exit Theater"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Theater Stage */}
      <main className="flex-1 p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto w-full">
        {/* Left Column (3/4): Video Theater, Change Request Banner, Emoji Controls */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {canManagePlayback && (
            <ChangeRequestBanner
              requests={pendingRequests}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
            />
          )}

          {/* Cinema Screen Frame with Ambient Ambilight Backglow */}
          <div className="relative rounded-2xl overflow-hidden shadow-screen border border-white/10 group transition-all duration-500">
            {/* Ambilight glow aura */}
            <div className="absolute -inset-2 bg-gradient-to-r from-red-600/30 via-red-500/20 to-cinema-gold/25 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition duration-1000 -z-10 animate-cinema-glow" />

            <YouTubePlayer
              videoId={videoId}
              userRole={currentUserRole}
              onEmitPlay={handleEmitPlay}
              onEmitPause={handleEmitPause}
              onEmitSeek={handleEmitSeek}
              onVideoEnded={handleVideoEnded}
              syncState={syncState}
              onRequestControlModal={() => setIsRequestModalOpen(true)}
              onSendReaction={handleSendReaction}
            />
          </div>

          {/* Cinema Ambient Action Bar (Responsive Mobile & Desktop) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 cinema-panel rounded-2xl p-2.5 sm:p-3 px-3 sm:px-4 shadow-md border border-white/5">
            <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
              <EmojiReactions
                onSendReaction={handleSendReaction}
                activeReactions={activeReactions}
              />

              {!canManagePlayback && (
                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 bg-red-600/15 hover:bg-red-600/25 text-red-300 rounded-xl border border-red-500/30 text-[11px] sm:text-xs font-semibold transition flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Request Song / Control</span>
                  <span className="sm:hidden">Request</span>
                </button>
              )}
            </div>

            {/* Synced Indicator */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 text-[11px] font-medium text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              <span className="text-gray-300">DOLBY SYNCED</span>
            </div>
          </div>
        </div>

        {/* Right Column (1/4): Tabbed Sidebar (Audience, Queue, Live Chat) */}
        <div className="lg:col-span-1 flex flex-col h-[480px] sm:h-[540px] lg:h-[calc(100vh-6.5rem)]">
          {/* Cinema Tab Selector */}
          <div className="flex cinema-panel rounded-2xl p-1 mb-3 border border-white/5">
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                sidebarTab === 'chat'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => setSidebarTab('queue')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                sidebarTab === 'queue'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue ({queue.length})</span>
            </button>

            <button
              onClick={() => setSidebarTab('participants')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                sidebarTab === 'participants'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Cast ({participants.length})</span>
            </button>
          </div>

          {/* Active Sidebar Tab Panel */}
          <div className="flex-1 min-h-0 cinema-panel rounded-2xl p-1 border border-white/5 overflow-hidden">
            {sidebarTab === 'chat' && (
              <ChatPanel
                messages={chatMessages}
                currentUserId={userId}
                onSendMessage={handleSendMessage}
                onSendReaction={handleSendReaction}
              />
            )}

            {sidebarTab === 'queue' && (
              <PlaylistQueue
                queue={queue}
                userRole={currentUserRole}
                onAddToQueue={handleAddToQueue}
                onAdvanceQueue={handleAdvanceQueue}
                onRequestSuggestQueue={handleSuggestQueue}
              />
            )}

            {sidebarTab === 'participants' && (
              <ParticipantList
                participants={participants}
                currentUserId={userId}
                currentUserRole={currentUserRole}
                onAssignRole={handleAssignRole}
                onRemoveParticipant={handleRemoveParticipant}
                onTransferHost={handleTransferHost}
              />
            )}
          </div>
        </div>
      </main>

      <ChangeRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSubmitRequest={handleSubmitParticipantRequest}
      />

      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
      />
    </div>
  );
};

export default App;
