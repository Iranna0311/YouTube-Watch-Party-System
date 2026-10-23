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

  // Video & Queue State
  const [videoId, setVideoId] = useState('M7lc1UVf-VE');
  const [syncState, setSyncState] = useState<SyncStatePayload | null>(null);
  const [newVideoInput, setNewVideoInput] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Active Tab in Sidebar (participants | queue | chat)
  const [sidebarTab, setSidebarTab] = useState<'participants' | 'queue' | 'chat'>('participants');

  // Approval Requests
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Chat & Reactions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeReactions, setActiveReactions] = useState<EmojiReaction[]>([]);

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
      }
    );

    socket.on('user_left', (data: { userId: string; username: string; participants: ParticipantData[] }) => {
      setParticipants(data.participants);
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
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-700 text-gray-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-medium animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-gray-800/80 bg-gray-900/60 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-base tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <span>WatchSync</span>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-800/90 border border-gray-700/80 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-gray-400 font-medium">Room:</span>
            <span className="font-mono font-bold text-white tracking-wider">{roomCode}</span>
            <button
              onClick={copyCode}
              className="p-1 text-gray-400 hover:text-white transition rounded"
              title="Copy Room Code"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            onClick={copyRoomLink}
            className="hidden sm:flex items-center gap-1 bg-gray-800/60 hover:bg-gray-800 text-gray-300 hover:text-white px-2.5 py-1 rounded-lg border border-gray-700/60 text-xs transition font-medium"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied Link!' : 'Invite Link'}</span>
          </button>
        </div>

        {/* Change Video Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-md mx-4">
          <form onSubmit={handleChangeVideoSubmit} className="flex-1 flex gap-1.5">
            <input
              type="text"
              value={newVideoInput}
              onChange={(e) => setNewVideoInput(e.target.value)}
              placeholder={canManagePlayback ? 'Paste YouTube URL or ID...' : 'Suggest a YouTube video...'}
              className="w-full bg-gray-800/90 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              disabled={!newVideoInput.trim()}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shrink-0 transition"
            >
              {canManagePlayback ? 'Load' : 'Suggest'}
            </button>
          </form>
        </div>

        {/* Audit Log, Role Badge & Exit */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            title="View Room Audit Log"
          >
            <History className="w-4 h-4" />
          </button>

          <span className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1 rounded-lg">
            Role: <span className="font-bold text-white">{currentUserRole}</span>
          </span>

          <button
            onClick={handleLeaveRoom}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
            title="Leave Room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto w-full">
        {/* Left Column (3/4): Video Theater, Change Request Banner, Emoji Controls */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {canManagePlayback && (
            <ChangeRequestBanner
              requests={pendingRequests}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
            />
          )}

          <YouTubePlayer
            videoId={videoId}
            userRole={currentUserRole}
            onEmitPlay={handleEmitPlay}
            onEmitPause={handleEmitPause}
            onEmitSeek={handleEmitSeek}
            onVideoEnded={handleVideoEnded}
            syncState={syncState}
            onRequestControlModal={() => setIsRequestModalOpen(true)}
          />

          <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-3 shadow-md">
            <div className="flex items-center gap-3">
              <EmojiReactions
                onSendReaction={handleSendReaction}
                activeReactions={activeReactions}
              />

              {!canManagePlayback && (
                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg border border-gray-700 text-xs font-medium transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Request Control / Suggestion</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              <span>Synced with Server</span>
            </div>
          </div>
        </div>

        {/* Right Column (1/4): Tabbed Sidebar (Participants, Playlist Queue, Chat) */}
        <div className="lg:col-span-1 flex flex-col h-[calc(100vh-6rem)]">
          {/* Sidebar Tab Selector */}
          <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-3">
            <button
              onClick={() => setSidebarTab('participants')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1 ${
                sidebarTab === 'participants'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users ({participants.length})</span>
            </button>

            <button
              onClick={() => setSidebarTab('queue')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1 ${
                sidebarTab === 'queue'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue ({queue.length})</span>
            </button>

            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1 ${
                sidebarTab === 'chat'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
          </div>

          <div className="flex-1 min-h-0">
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

            {sidebarTab === 'queue' && (
              <PlaylistQueue
                queue={queue}
                userRole={currentUserRole}
                onAddToQueue={handleAddToQueue}
                onAdvanceQueue={handleAdvanceQueue}
                onRequestSuggestQueue={handleSuggestQueue}
              />
            )}

            {sidebarTab === 'chat' && (
              <ChatPanel
                messages={chatMessages}
                currentUserId={userId}
                onSendMessage={handleSendMessage}
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
