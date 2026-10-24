import { Server, Socket } from 'socket.io';
import { RoomManager } from '../models/RoomManager';
import { Participant } from '../models/Participant';
import { Role, ChangeRequest, ChatMessage, EmojiReaction, QueueItem } from '../types';
import { SocketRateLimiter } from '../utils/rateLimiter';
import {
  CreateRoomSchema,
  JoinRoomSchema,
  SeekSchema,
  ChangeVideoSchema,
  AssignRoleSchema,
  RemoveParticipantSchema,
  TransferHostSchema,
  ChangeRequestSchema,
  ApproveRejectSchema,
  AddToQueueSchema,
  ChatMessageSchema,
  ReactionSchema,
  VideoIdPayloadSchema,
  SeekPayloadSchema,
  VideoEndedSchema,
} from '../validators/schemas';
import { dbPersistRoom, dbUpdateRoomVideo, dbPersistChatMessage, dbPersistAuditLog } from '../services/supabase';
import { logUserJoin, logChatMessage, logUserLeave } from '../services/liveLogger';

interface SocketData {
  userId?: string;
  roomCode?: string;
}

export function registerSocketHandlers(io: Server, roomManager: RoomManager) {
  const rateLimiter = new SocketRateLimiter(15, 1000);

  io.on('connection', (socket: Socket) => {
    const data: SocketData = {};

    const getContext = () => {
      if (!data.roomCode) return null;
      const room = roomManager.getRoom(data.roomCode);
      if (!room) return null;
      const participant = room.getParticipantBySocket(socket.id);
      return { room, participant };
    };

    const checkRateLimit = (): boolean => {
      if (!rateLimiter.checkLimit(socket.id)) {
        socket.emit('error', { message: 'Too many requests. Slow down.' });
        return false;
      }
      return true;
    };

    // --- NTP CLOCK SYNC ---
    socket.on('time_ping', (ack?: (serverTime: number) => void) => {
      if (typeof ack === 'function') ack(Date.now());
    });

    // --- 1. CREATE ROOM ---
    socket.on('create_room', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;

      const parsed = CreateRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('error', { message: parsed.error.issues[0].message });
        return;
      }

      const { userId, username, initialVideoId } = parsed.data;

      const { room, host } = roomManager.createRoom(
        userId,
        username,
        socket.id,
        initialVideoId // already coerced to 11-char ID by Zod
      );

      data.roomCode = room.code;
      data.userId = userId;
      socket.join(room.code);

      // sessionToken sent ONLY to this socket, never broadcast
      socket.emit('room_created', {
        roomCode: room.code,
        host: host.toJSON(),
        sessionToken: host.sessionToken,
        syncState: room.getSyncPayload(),
        queue: room.getQueue(),
        auditLog: room.getAuditLogForUser(userId),
      });

      // Broadcast participant list (no sessionToken inside toJSON)
      room.broadcast('user_joined', {
        userId: host.userId,
        username: host.username,
        role: host.role,
        participants: room.getParticipantsList(),
      });

      const audit = room.logAudit('room_created', host.username, `Room created with video ${initialVideoId ?? 'M7lc1UVf-VE'}`);
      dbPersistRoom(room.code, host.userId, initialVideoId ?? 'M7lc1UVf-VE');
      dbPersistAuditLog(room.code, audit);
      logUserJoin(room.code, host.userId, host.username, host.role);
    });

    // --- 2. JOIN ROOM ---
    socket.on('join_room', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;

      const parsed = JoinRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('error', { message: parsed.error.issues[0].message });
        return;
      }

      const { roomId, username, userId, sessionToken } = parsed.data;
      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: `Room "${roomId.toUpperCase()}" not found` });
        return;
      }

      if (room.isBanned(userId)) {
        socket.emit('error', { message: 'You have been removed and banned from this room' });
        return;
      }

      data.roomCode = room.code;
      data.userId = userId;

      const existing = room.getParticipant(userId);

      if (existing) {
        // Reconnect path: token required
        if (!sessionToken || !room.reclaim(userId, sessionToken, socket.id)) {
          socket.emit('error', {
            message: 'Identity in use: Invalid session token. Could not reclaim role.',
          });
          return;
        }

        socket.join(room.code);

        // Send token only to its owner
        socket.emit('session_authenticated', {
          sessionToken: existing.sessionToken,
          role: existing.role,
        });
        socket.emit('sync_state', room.getSyncPayload());
        socket.emit('queue_updated', room.getQueue());
        socket.emit('audit_log_updated', room.getAuditLogForUser(userId));

        room.broadcast('user_joined', {
          userId: existing.userId,
          username: existing.username,
          role: existing.role,
          participants: room.getParticipantsList(),
        });
        logUserJoin(room.code, existing.userId, existing.username, existing.role);
        return;
      }

      // Fresh join — new Participant, no token needed
      const newParticipant = new Participant(userId, username, 'Participant', socket.id);
      room.addParticipant(newParticipant);
      socket.join(room.code);

      socket.emit('session_authenticated', {
        sessionToken: newParticipant.sessionToken,
        role: newParticipant.role,
      });
      socket.emit('sync_state', room.getSyncPayload());
      socket.emit('queue_updated', room.getQueue());
      // Participants get an empty audit log; Host/Mod get full log
      socket.emit('audit_log_updated', room.getAuditLogForUser(userId));

      room.broadcast('user_joined', {
        userId: newParticipant.userId,
        username: newParticipant.username,
        role: newParticipant.role,
        participants: room.getParticipantsList(),
      });
      logUserJoin(room.code, newParticipant.userId, newParticipant.username, newParticipant.role);
    });

    // --- 3. PLAY ---
    socket.on('play', (rawPayload?: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'play')) {
        socket.emit('error', { message: 'Unauthorized: Host or Moderator required' });
        return;
      }

      const currentTime = (rawPayload as any)?.currentTime ?? room.getCurrentPlaybackTime();
      room.updateVideoState({ playState: 'playing', currentTime });
      room.broadcast('play', { userId: participant.userId, currentTime });
      room.broadcast('sync_state', room.getSyncPayload());
    });

    // --- 4. PAUSE ---
    socket.on('pause', (rawPayload?: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'pause')) {
        socket.emit('error', { message: 'Unauthorized: Host or Moderator required' });
        return;
      }

      const currentTime = (rawPayload as any)?.currentTime ?? room.getCurrentPlaybackTime();
      room.updateVideoState({ playState: 'paused', currentTime });
      room.broadcast('pause', { userId: participant.userId, currentTime });
      room.broadcast('sync_state', room.getSyncPayload());
    });

    // --- 5. SEEK ---
    socket.on('seek', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'seek')) {
        socket.emit('error', { message: 'Unauthorized: Host or Moderator required' });
        return;
      }

      const parsed = SeekSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid seek time' });
        return;
      }

      room.updateVideoState({ currentTime: parsed.data.time });
      room.broadcast('seek', { time: parsed.data.time, userId: participant.userId });
      room.broadcast('sync_state', room.getSyncPayload());
    });

    // --- 6. CHANGE VIDEO ---
    socket.on('change_video', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'change_video')) {
        socket.emit('error', { message: 'Unauthorized: Host or Moderator required' });
        return;
      }

      const parsed = ChangeVideoSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('error', { message: parsed.error.issues[0].message });
        return;
      }

      room.updateVideoState({ videoId: parsed.data.videoId, currentTime: 0, playState: 'paused' });
      room.broadcast('change_video', { videoId: parsed.data.videoId, userId: participant.userId });
      room.broadcast('sync_state', room.getSyncPayload());

      const audit = room.logAudit('change_video', participant.username, `Changed video to ${parsed.data.videoId}`);
      room.broadcastToStaff('audit_log_entry', audit);
      dbUpdateRoomVideo(room.code, parsed.data.videoId);
      dbPersistAuditLog(room.code, audit);
    });

    // --- 7. VIDEO ENDED (queue auto-advance) ---
    // Only accepted from Host or Moderators.
    // De-duplicated per video: the first valid signal advances, rest are no-ops.
    socket.on('video_ended', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      const parsed = VideoEndedSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const nextVideo = room.tryAdvanceOnVideoEnd(participant.userId, parsed.data.videoId);
      if (nextVideo) {
        room.broadcast('change_video', { videoId: nextVideo.videoId, userId: 'system' });
        room.broadcast('sync_state', room.getSyncPayload());
        room.broadcast('queue_updated', room.getQueue());

        const audit = room.logAudit('queue_advance', participant.username, `Auto-advanced to ${nextVideo.videoId}`);
        room.broadcastToStaff('audit_log_entry', audit);
      dbPersistAuditLog(room.code, audit);
      }
    });

    // --- 8. QUEUE MANAGEMENT ---
    socket.on('add_to_queue', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'manage_queue')) {
        socket.emit('error', { message: 'Unauthorized: Host or Moderator required' });
        return;
      }

      const parsed = AddToQueueSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('error', { message: parsed.error.issues[0].message });
        return;
      }

      const item: QueueItem = {
        id: 'q_' + Math.random().toString(36).substring(2, 9),
        videoId: parsed.data.videoId,
        title: parsed.data.title || `Video (${parsed.data.videoId})`,
        suggestedBy: participant.username,
        suggestedAt: Date.now(),
      };

      room.addToQueue(item);
      room.broadcast('queue_updated', room.getQueue());

      const audit = room.logAudit('queue_add', participant.username, `Added ${parsed.data.videoId} to queue`);
      room.broadcastToStaff('audit_log_entry', audit);
      dbPersistAuditLog(room.code, audit);
    });

    socket.on('advance_queue', () => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'manage_queue')) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const nextVideo = room.advanceQueue();
      if (nextVideo) {
        room.broadcast('change_video', { videoId: nextVideo.videoId, userId: participant.userId });
        room.broadcast('sync_state', room.getSyncPayload());
        room.broadcast('queue_updated', room.getQueue());

        const audit = room.logAudit('queue_advance', participant.username, `Skipped to ${nextVideo.videoId}`);
        room.broadcastToStaff('audit_log_entry', audit);
      dbPersistAuditLog(room.code, audit);
      }
    });

    // --- 9. ASSIGN ROLE (Host only) ---
    socket.on('assign_role', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'assign_role')) {
        socket.emit('error', { message: 'Unauthorized: Only the Host can assign roles' });
        return;
      }

      const parsed = AssignRoleSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit('error', { message: parsed.error.issues[0].message });
        return;
      }

      const target = room.getParticipant(parsed.data.userId);
      if (!target) {
        socket.emit('error', { message: 'Target participant not found' });
        return;
      }

      const success = room.assignRole(parsed.data.userId, parsed.data.role);
      if (success) {
        room.broadcast('role_assigned', {
          userId: target.userId,
          username: target.username,
          role: parsed.data.role,
          participants: room.getParticipantsList(),
        });

        const audit = room.logAudit('role_assigned', participant.username, `Set ${target.username} → ${parsed.data.role}`);
        room.broadcastToStaff('audit_log_entry', audit);
      dbPersistAuditLog(room.code, audit);
      } else {
        socket.emit('error', { message: 'Role assignment rejected' });
      }
    });

    // --- 10. REMOVE PARTICIPANT ---
    socket.on('remove_participant', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'remove_participant')) {
        socket.emit('error', { message: 'Unauthorized: Only the Host can remove participants' });
        return;
      }

      const parsed = RemoveParticipantSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      if (parsed.data.userId === room.hostId) {
        socket.emit('error', { message: 'Cannot remove the room Host' });
        return;
      }

      const target = room.getParticipant(parsed.data.userId);
      if (target) {
        room.banUser(parsed.data.userId);
        room.removeParticipant(parsed.data.userId);

        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.emit('participant_removed', {
            userId: parsed.data.userId,
            reason: 'You have been removed and banned from this room by the host',
          });
          targetSocket.leave(room.code);
          targetSocket.disconnect(true);
        }

        room.broadcast('participant_removed', {
          userId: parsed.data.userId,
          participants: room.getParticipantsList(),
        });

        const audit = room.logAudit('user_kicked', participant.username, `Removed and banned ${target.username}`);
        room.broadcastToStaff('audit_log_entry', audit);
      dbPersistAuditLog(room.code, audit);
      }
    });

    // --- 11. TRANSFER HOST ---
    socket.on('transfer_host', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'transfer_host')) {
        socket.emit('error', { message: 'Unauthorized: Only current Host can transfer ownership' });
        return;
      }

      const parsed = TransferHostSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const success = room.transferHost(parsed.data.userId);
      if (success) {
        const newHost = room.getParticipant(parsed.data.userId);
        room.broadcast('role_assigned', {
          userId: parsed.data.userId,
          username: newHost?.username || '',
          role: 'Host',
          participants: room.getParticipantsList(),
        });

        const audit = room.logAudit('host_transfer', participant.username, `Transferred ownership to ${newHost?.username}`);
        room.broadcastToStaff('audit_log_entry', audit);
      dbPersistAuditLog(room.code, audit);
      }
    });

    // --- 12. CHANGE REQUEST APPROVAL WORKFLOW ---
    socket.on('change_request', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      const parsed = ChangeRequestSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const request: ChangeRequest = {
        requestId: 'req_' + Math.random().toString(36).substring(2, 9),
        userId: participant.userId,
        username: participant.username,
        type: parsed.data.type,
        payload: parsed.data.payload,
        requestedAt: Date.now(),
      };

      room.addChangeRequest(request);

      // Notify Host and Moderators only
      room.broadcastToStaff('change_request_received', request);

      socket.emit('change_request_submitted', { requestId: request.requestId });
    });

    socket.on('approve_request', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'approve_request')) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const parsed = ApproveRejectSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const request = room.getChangeRequest(parsed.data.requestId);
      if (!request) return;

      room.removeChangeRequest(parsed.data.requestId);

      if (request.type === 'change_video') {
        const vidParsed = VideoIdPayloadSchema.safeParse(request.payload);
        if (vidParsed.success) {
          room.updateVideoState({ videoId: vidParsed.data.videoId, currentTime: 0, playState: 'paused' });
          room.broadcast('change_video', { videoId: vidParsed.data.videoId, userId: request.userId });
        }
      } else if (request.type === 'add_to_queue') {
        const vidParsed = VideoIdPayloadSchema.safeParse(request.payload);
        if (vidParsed.success) {
          room.addToQueue({
            id: 'q_' + Math.random().toString(36).substring(2, 9),
            videoId: vidParsed.data.videoId,
            title: `Suggested by ${request.username}`,
            suggestedBy: request.username,
            suggestedAt: Date.now(),
          });
          room.broadcast('queue_updated', room.getQueue());
        }
      } else if (request.type === 'seek') {
        const seekParsed = SeekPayloadSchema.safeParse(request.payload);
        if (seekParsed.success) {
          room.updateVideoState({ currentTime: seekParsed.data.time });
          room.broadcast('seek', { time: seekParsed.data.time, userId: request.userId });
        }
      } else if (request.type === 'play') {
        const time = typeof request.payload?.time === 'number' ? request.payload.time : room.getSyncPayload().currentTime;
        room.updateVideoState({ playState: 'playing', currentTime: time });
        room.broadcast('play', { time, userId: request.userId });
      } else if (request.type === 'pause') {
        const time = typeof request.payload?.time === 'number' ? request.payload.time : room.getSyncPayload().currentTime;
        room.updateVideoState({ playState: 'paused', currentTime: time });
        room.broadcast('pause', { time, userId: request.userId });
      }

      room.broadcast('sync_state', room.getSyncPayload());
      room.broadcast('change_request_resolved', {
        requestId: request.requestId,
        status: 'approved',
        approvedBy: participant.username,
      });

      const audit = room.logAudit('request_approved', participant.username, `Approved ${request.username}'s ${request.type}`);
      room.broadcastToStaff('audit_log_entry', audit);
      dbPersistAuditLog(room.code, audit);
    });

    socket.on('reject_request', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      if (!room.can(participant.userId, 'approve_request')) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const parsed = ApproveRejectSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      room.removeChangeRequest(parsed.data.requestId);
      room.broadcast('change_request_resolved', {
        requestId: parsed.data.requestId,
        status: 'rejected',
        rejectedBy: participant.username,
      });
    });

    // --- 13. CHAT ---
    socket.on('chat_message', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      const parsed = ChatMessageSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const message: ChatMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 9),
        userId: participant.userId,
        username: participant.username,
        role: participant.role,
        text: parsed.data.text, // already trimmed by Zod; React escapes on render
        timestamp: Date.now(),
      };

      room.broadcast('chat_message', message);
      logChatMessage(room.code, message);
    });

    // --- 14. EMOJI REACTIONS ---
    socket.on('reaction', (rawPayload: unknown) => {
      if (!checkRateLimit()) return;
      const ctx = getContext();
      if (!ctx?.participant) return;
      const { room, participant } = ctx;

      const parsed = ReactionSchema.safeParse(rawPayload);
      if (!parsed.success) return;

      const reaction: EmojiReaction = {
        id: 'react_' + Math.random().toString(36).substring(2, 9),
        emoji: parsed.data.emoji,
        userId: participant.userId,
        username: participant.username,
        timestamp: Date.now(),
      };

      room.broadcast('reaction', reaction);
    });

    // --- 15. LEAVE / DISCONNECT ---
    const handleLeave = () => {
      // Clean up rate-limiter entry to prevent memory leak
      rateLimiter.reset(socket.id);

      if (!data.roomCode) return;
      const room = roomManager.getRoom(data.roomCode);
      if (!room) return;

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) return;

      socket.leave(room.code);

      if (participant.userId === room.hostId) {
        room.scheduleHostGracePeriod((newHost) => {
          room.broadcast('role_assigned', {
            userId: newHost.userId,
            username: newHost.username,
            role: 'Host',
            participants: room.getParticipantsList(),
          });
          const audit = room.logAudit('auto_promoted', 'System', `${newHost.username} auto-promoted to Host`);
          room.broadcastToStaff('audit_log_entry', audit);
      dbPersistAuditLog(room.code, audit);
        }, 10000);
      } else {
        room.removeParticipant(participant.userId);
      }

      room.broadcast('user_left', {
        userId: participant.userId,
        username: participant.username,
        participants: room.getParticipantsList(),
      });
      logUserLeave(room.code, participant.userId, participant.username, participant.role);

      // Cleanup empty room: clears timers, maps, and interval
      roomManager.cleanupRoomIfEmpty(room.code);
    };

    socket.on('leave_room', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
