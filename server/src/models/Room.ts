import { Server } from 'socket.io';
import {
  Action,
  AuditLogEntry,
  ChangeRequest,
  ParticipantData,
  QueueItem,
  Role,
  SyncStatePayload,
  VideoState,
} from '../types';
import { Participant } from './Participant';
import { Permissions } from './Permissions';

export class Room {
  public readonly code: string;
  private participants: Map<string, Participant> = new Map();
  private socketToUserId: Map<string, string> = new Map();
  private bannedUserIds: Set<string> = new Set();
  private pendingRequests: Map<string, ChangeRequest> = new Map();
  private videoQueue: QueueItem[] = [];
  private auditLog: AuditLogEntry[] = [];

  // Debounce timestamp for video_ended events to prevent duplicate advances
  private lastAdvanceAt: number = 0;

  public hostId: string;
  public videoState: VideoState;
  private io: Server;
  private hostGraceTimer: NodeJS.Timeout | null = null;
  private periodicSyncTimer: NodeJS.Timeout | null = null;

  constructor(code: string, hostId: string, io: Server, initialVideoId: string = 'M7lc1UVf-VE') {
    this.code = code;
    this.hostId = hostId;
    this.io = io;
    this.videoState = {
      videoId: initialVideoId,
      playState: 'paused',
      currentTime: 0,
      updatedAt: Date.now(),
    };
    this.startPeriodicSync();
  }

  /**
   * Authoritative playback time — advances wall-clock when playing.
   */
  public getCurrentPlaybackTime(): number {
    if (this.videoState.playState === 'playing') {
      const elapsedSeconds = (Date.now() - this.videoState.updatedAt) / 1000;
      return this.videoState.currentTime + elapsedSeconds;
    }
    return this.videoState.currentTime;
  }

  public getSyncPayload(): SyncStatePayload {
    return {
      videoId: this.videoState.videoId,
      playState: this.videoState.playState,
      currentTime: this.getCurrentPlaybackTime(),
      serverTime: Date.now(),
      updatedAt: this.videoState.updatedAt,
    };
  }

  /** Permission check. Host always passes. */
  public can(userId: string, action: Action): boolean {
    const participant = this.participants.get(userId);
    if (!participant) return false;
    if (userId === this.hostId) return true;
    return Permissions.can(participant.role, action);
  }

  /**
   * BUG D FIX: Secure session reclaim via private sessionToken.
   * Returns true only if the stored token matches.
   */
  public reclaim(userId: string, token: string, newSocketId: string): boolean {
    const p = this.participants.get(userId);
    if (!p || p.sessionToken !== token) return false;

    this.socketToUserId.delete(p.socketId);
    p.updateSocket(newSocketId);
    this.socketToUserId.set(newSocketId, userId);

    if (userId === this.hostId) this.cancelHostGracePeriod();
    return true;
  }

  public addParticipant(participant: Participant): void {
    this.participants.set(participant.userId, participant);
    this.socketToUserId.set(participant.socketId, participant.userId);
  }

  public getParticipant(userId: string): Participant | undefined {
    return this.participants.get(userId);
  }

  public getParticipantBySocket(socketId: string): Participant | undefined {
    const userId = this.socketToUserId.get(socketId);
    if (!userId) return undefined;
    return this.participants.get(userId);
  }

  public removeParticipant(userId: string): Participant | undefined {
    const participant = this.participants.get(userId);
    if (participant) {
      this.socketToUserId.delete(participant.socketId);
      this.participants.delete(userId);
    }
    return participant;
  }

  public banUser(userId: string): void {
    this.bannedUserIds.add(userId);
  }

  public isBanned(userId: string): boolean {
    return this.bannedUserIds.has(userId);
  }

  /**
   * BUG C FIX: assignRole cannot assign 'Host'. Use transferHost().
   */
  public assignRole(targetUserId: string, newRole: Role): boolean {
    if (newRole === 'Host') return false;
    const participant = this.participants.get(targetUserId);
    if (!participant || targetUserId === this.hostId) return false;
    participant.setRole(newRole);
    return true;
  }

  public transferHost(newHostUserId: string): boolean {
    const newHost = this.participants.get(newHostUserId);
    if (!newHost) return false;

    const oldHost = this.participants.get(this.hostId);
    if (oldHost) oldHost.setRole('Moderator');

    this.hostId = newHostUserId;
    newHost.setRole('Host');
    this.cancelHostGracePeriod();
    return true;
  }

  public scheduleHostGracePeriod(
    onPromote: (newHost: Participant) => void,
    gracePeriodMs: number = 10000
  ): void {
    this.cancelHostGracePeriod();
    const host = this.participants.get(this.hostId);
    if (host) host.setDisconnected();

    this.hostGraceTimer = setTimeout(() => {
      const nextHost = this.findNextHostCandidate();
      if (nextHost) {
        this.transferHost(nextHost.userId);
        onPromote(nextHost);
      }
    }, gracePeriodMs);
  }

  public cancelHostGracePeriod(): void {
    if (this.hostGraceTimer) {
      clearTimeout(this.hostGraceTimer);
      this.hostGraceTimer = null;
    }
    const host = this.participants.get(this.hostId);
    if (host) host.isConnected = true;
  }

  private findNextHostCandidate(): Participant | undefined {
    const connected = Array.from(this.participants.values()).filter(
      (p) => p.userId !== this.hostId && p.isConnected
    );
    if (connected.length === 0) return undefined;

    const moderators = connected
      .filter((p) => p.role === 'Moderator')
      .sort((a, b) => a.joinedAt - b.joinedAt);

    if (moderators.length > 0) return moderators[0];
    return connected.sort((a, b) => a.joinedAt - b.joinedAt)[0];
  }

  public updateVideoState(updates: Partial<VideoState>): void {
    this.videoState = {
      ...this.videoState,
      ...updates,
      updatedAt: Date.now(),
    };
  }

  /**
   * VIDEO_ENDED: Advance queue only once per video, and only for
   * Host / Moderator senders whose reported videoId matches current state.
   * Debounced by 3000ms window so simultaneous client reports only advance once.
   * Returns the QueueItem advanced to (or null if ignored).
   */
  public tryAdvanceOnVideoEnd(senderUserId: string, reportedVideoId: string): QueueItem | null {
    if (!this.can(senderUserId, 'manage_queue')) return null;
    if (reportedVideoId !== this.videoState.videoId) return null;
    if (Date.now() - this.lastAdvanceAt < 3000) return null;

    const next = this.advanceQueue();
    if (next) {
      this.lastAdvanceAt = Date.now();
    }
    return next;
  }

  // --- QUEUE ---
  public addToQueue(item: QueueItem): void {
    this.videoQueue.push(item);
  }

  public removeFromQueue(id: string): boolean {
    const initial = this.videoQueue.length;
    this.videoQueue = this.videoQueue.filter((q) => q.id !== id);
    return this.videoQueue.length !== initial;
  }

  public advanceQueue(): QueueItem | null {
    if (this.videoQueue.length === 0) return null;
    const nextItem = this.videoQueue.shift()!;
    this.updateVideoState({ videoId: nextItem.videoId, currentTime: 0, playState: 'playing' });
    return nextItem;
  }

  public getQueue(): QueueItem[] {
    return [...this.videoQueue];
  }

  // --- AUDIT LOG (Host and Moderators only) ---
  public logAudit(action: string, performer: string, details: string): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: 'audit_' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      action,
      performer,
      details,
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > 50) this.auditLog.shift();
    return entry;
  }

  /** Returns audit log only for callers allowed to see it (Host / Moderator). */
  public getAuditLogForUser(userId: string): AuditLogEntry[] {
    const p = this.participants.get(userId);
    if (!p) return [];
    if (p.role !== 'Host' && p.role !== 'Moderator' && userId !== this.hostId) return [];
    return [...this.auditLog];
  }

  public getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  // --- CHANGE REQUESTS ---
  public addChangeRequest(request: ChangeRequest): void {
    this.pendingRequests.set(request.requestId, request);
  }

  public getChangeRequest(requestId: string): ChangeRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  public removeChangeRequest(requestId: string): void {
    this.pendingRequests.delete(requestId);
  }

  public getParticipantsList(): ParticipantData[] {
    return Array.from(this.participants.values()).map((p) => p.toJSON());
  }

  public isEmpty(): boolean {
    return this.participants.size === 0;
  }

  public broadcast(event: string, payload: any, exceptSocketId?: string): void {
    if (exceptSocketId) {
      this.io.to(this.code).except(exceptSocketId).emit(event, payload);
    } else {
      this.io.to(this.code).emit(event, payload);
    }
  }

  /** Emit an event only to Host and Moderators in this room. */
  public broadcastToStaff(event: string, payload: any): void {
    this.io.to(`${this.code}:staff`).emit(event, payload);
    this.participants.forEach((p) => {
      if (p.role === 'Host' || p.role === 'Moderator') {
        this.io.to(p.socketId).emit(event, payload);
      }
    });
  }

  private startPeriodicSync(): void {
    this.periodicSyncTimer = setInterval(() => {
      if (this.participants.size > 0 && this.videoState.playState === 'playing') {
        this.broadcast('sync_state', this.getSyncPayload());
      }
    }, 5000);
  }

  public destroy(): void {
    if (this.hostGraceTimer) clearTimeout(this.hostGraceTimer);
    if (this.periodicSyncTimer) clearInterval(this.periodicSyncTimer);
    this.participants.clear();
    this.socketToUserId.clear();
    this.bannedUserIds.clear();
    this.pendingRequests.clear();
    this.videoQueue = [];
    this.auditLog = [];
  }
}
