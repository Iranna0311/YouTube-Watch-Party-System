import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Permissions } from '../models/Permissions';
import { Participant } from '../models/Participant';
import { Room } from '../models/Room';
import { SocketRateLimiter } from '../utils/rateLimiter';
import { CreateRoomSchema, SeekSchema, VideoEndedSchema } from '../validators/schemas';

const createMockIO = () => ({
  to: vi.fn().mockReturnThis(),
  except: vi.fn().mockReturnThis(),
  emit: vi.fn(),
  sockets: { sockets: new Map() },
} as any);

// ─────────────────────────────────────────────────────────────────────────────
describe('1. Permissions Matrix', () => {
  it('Host can perform all operations', () => {
    const actions = ['play', 'pause', 'seek', 'change_video', 'assign_role', 'remove_participant', 'transfer_host', 'approve_request', 'manage_queue'] as const;
    actions.forEach((a) => expect(Permissions.can('Host', a)).toBe(true));
  });

  it('Moderator can control playback but cannot assign roles or remove users', () => {
    expect(Permissions.can('Moderator', 'play')).toBe(true);
    expect(Permissions.can('Moderator', 'change_video')).toBe(true);
    expect(Permissions.can('Moderator', 'manage_queue')).toBe(true);
    expect(Permissions.can('Moderator', 'assign_role')).toBe(false);
    expect(Permissions.can('Moderator', 'remove_participant')).toBe(false);
    expect(Permissions.can('Moderator', 'transfer_host')).toBe(false);
  });

  it('Participant has no direct control actions', () => {
    const actions = ['play', 'pause', 'seek', 'change_video', 'manage_queue', 'assign_role'] as const;
    actions.forEach((a) => expect(Permissions.can('Participant', a)).toBe(false));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('2. Bug D – Secure Identity Reclaim', () => {
  let room: Room;

  beforeEach(() => {
    const mockIO = createMockIO();
    room = new Room('TEST01', 'host_1', mockIO);
    room.addParticipant(new Participant('host_1', 'Alice', 'Host', 'sock_1'));
    room.addParticipant(new Participant('user_2', 'Bob', 'Participant', 'sock_2'));
  });

  it('toJSON() strips sessionToken and socketId from public payload', () => {
    const json = room.getParticipant('host_1')!.toJSON();
    expect((json as any).sessionToken).toBeUndefined();
    expect((json as any).socketId).toBeUndefined();
    expect(json.userId).toBe('host_1');
  });

  it('Legitimate owner reclaims session with valid token', () => {
    const token = room.getParticipant('host_1')!.sessionToken;
    expect(room.reclaim('host_1', token, 'sock_new')).toBe(true);
    expect(room.getParticipantBySocket('sock_new')?.userId).toBe('host_1');
  });

  it('Attacker using copied userId but wrong token is rejected', () => {
    expect(room.reclaim('host_1', 'wrong-token', 'sock_evil')).toBe(false);
    // Original socket mapping is intact
    expect(room.getParticipant('host_1')?.socketId).toBe('sock_1');
  });

  it('Fresh userId (no existing participant) is not reclaimed', () => {
    expect(room.reclaim('brand_new_id', 'any-token', 'sock_x')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('3. Bug C – Host Role Invariant', () => {
  let room: Room;

  beforeEach(() => {
    const mockIO = createMockIO();
    room = new Room('TEST02', 'host_1', mockIO);
    room.addParticipant(new Participant('host_1', 'Alice', 'Host', 'sock_1'));
    room.addParticipant(new Participant('user_2', 'Bob', 'Participant', 'sock_2'));
  });

  it('assignRole rejects direct Host assignment', () => {
    expect(room.assignRole('user_2', 'Host')).toBe(false);
    expect(room.getParticipant('user_2')?.role).toBe('Participant');
  });

  it('assignRole promotes to Moderator', () => {
    expect(room.assignRole('user_2', 'Moderator')).toBe(true);
    expect(room.getParticipant('user_2')?.role).toBe('Moderator');
  });

  it('transferHost switches ownership and demotes old host to Moderator', () => {
    expect(room.transferHost('user_2')).toBe(true);
    expect(room.hostId).toBe('user_2');
    expect(room.getParticipant('user_2')?.role).toBe('Host');
    expect(room.getParticipant('host_1')?.role).toBe('Moderator');
  });

  it('cannot remove the current host via assignRole', () => {
    // The host target guard: assignRole on hostId returns false
    expect(room.assignRole('host_1', 'Moderator')).toBe(false);
    expect(room.getParticipant('host_1')?.role).toBe('Host');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('4. Video Ended – Abuse Prevention', () => {
  let room: Room;

  beforeEach(() => {
    vi.useFakeTimers();
    const mockIO = createMockIO();
    room = new Room('TEST03', 'host_1', mockIO, 'videoAAA11');
    room.addParticipant(new Participant('host_1', 'Alice', 'Host', 'sock_1'));
    room.addParticipant(new Participant('mod_1', 'BobMod', 'Moderator', 'sock_2'));
    room.addParticipant(new Participant('part_1', 'Charlie', 'Participant', 'sock_3'));

    room.addToQueue({ id: 'q1', videoId: 'nextVideo11', title: 'Next', suggestedBy: 'host', suggestedAt: Date.now() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Participant cannot trigger video_ended advance', () => {
    const result = room.tryAdvanceOnVideoEnd('part_1', 'videoAAA11');
    expect(result).toBeNull();
    expect(room.videoState.videoId).toBe('videoAAA11');
  });

  it('Host triggers advance once; simultaneous call for same video is debounced within 3s', () => {
    const first = room.tryAdvanceOnVideoEnd('host_1', 'videoAAA11');
    expect(first?.videoId).toBe('nextVideo11');
    expect(room.videoState.videoId).toBe('nextVideo11');

    // Queue another item right away
    room.addToQueue({ id: 'q2', videoId: 'anotherVid11', title: '2nd', suggestedBy: 'host', suggestedAt: Date.now() });

    // Simultaneous second call (e.g. from Moderator for current video within 50ms) is debounced
    vi.advanceTimersByTime(50);
    const second = room.tryAdvanceOnVideoEnd('mod_1', 'nextVideo11');
    expect(second).toBeNull();
    expect(room.videoState.videoId).toBe('nextVideo11');

    // After 3000ms cooldown, next valid video_ended advances successfully
    vi.advanceTimersByTime(3001);
    const third = room.tryAdvanceOnVideoEnd('host_1', 'nextVideo11');
    expect(third?.videoId).toBe('anotherVid11');
    expect(room.videoState.videoId).toBe('anotherVid11');
  });

  it('Mismatched videoId (stale signal) is rejected', () => {
    const result = room.tryAdvanceOnVideoEnd('host_1', 'wrongVidId1');
    expect(result).toBeNull();
    expect(room.videoState.videoId).toBe('videoAAA11');
  });

  it('Empty queue does not lock future advance (empty queue then replay)', () => {
    const emptyRoom = new Room('TEST03_EMPTY', 'host_1', createMockIO(), 'replayVid11');
    emptyRoom.addParticipant(new Participant('host_1', 'Alice', 'Host', 'sock_1'));

    // Video ends with empty queue -> returns null
    const result1 = emptyRoom.tryAdvanceOnVideoEnd('host_1', 'replayVid11');
    expect(result1).toBeNull();

    // Now someone queues a video and video ends again
    emptyRoom.addToQueue({ id: 'q_rep', videoId: 'afterEmpty11', title: 'Rep', suggestedBy: 'host', suggestedAt: Date.now() });
    vi.advanceTimersByTime(3100);

    const result2 = emptyRoom.tryAdvanceOnVideoEnd('host_1', 'replayVid11');
    expect(result2?.videoId).toBe('afterEmpty11');
    expect(emptyRoom.videoState.videoId).toBe('afterEmpty11');
  });

  it('Same video queued twice in a row advances correctly after cooldown', () => {
    const repRoom = new Room('TEST03_DUP', 'host_1', createMockIO(), 'loopVid11');
    repRoom.addParticipant(new Participant('host_1', 'Alice', 'Host', 'sock_1'));
    repRoom.addToQueue({ id: 'd1', videoId: 'loopVid11', title: 'Loop', suggestedBy: 'host', suggestedAt: Date.now() });

    const adv1 = repRoom.tryAdvanceOnVideoEnd('host_1', 'loopVid11');
    expect(adv1?.videoId).toBe('loopVid11');

    // 3 seconds later video ends again (replay finished)
    vi.advanceTimersByTime(3100);
    repRoom.addToQueue({ id: 'd2', videoId: 'finalVid11', title: 'Final', suggestedBy: 'host', suggestedAt: Date.now() });

    const adv2 = repRoom.tryAdvanceOnVideoEnd('host_1', 'loopVid11');
    expect(adv2?.videoId).toBe('finalVid11');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('5. Host Disconnect & Grace Period Auto-Promotion', () => {
  it('Auto-promotes oldest connected Moderator over Participant', () => {
    vi.useFakeTimers();
    const room = new Room('TEST04', 'host_1', createMockIO());

    room.addParticipant(new Participant('host_1', 'Alice', 'Host', 'sock_1'));
    room.addParticipant(new Participant('mod_1', 'BobMod', 'Moderator', 'sock_2'));
    room.addParticipant(new Participant('part_1', 'Charlie', 'Participant', 'sock_3'));

    const promoteCb = vi.fn();
    room.scheduleHostGracePeriod(promoteCb, 5000);
    vi.advanceTimersByTime(5001);

    expect(promoteCb).toHaveBeenCalledTimes(1);
    expect(room.hostId).toBe('mod_1');

    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('6. Audit Log Visibility', () => {
  let room: Room;

  beforeEach(() => {
    const mockIO = createMockIO();
    room = new Room('TEST05', 'host_1', mockIO);
    room.addParticipant(new Participant('host_1', 'Alice', 'Host', 'sock_1'));
    room.addParticipant(new Participant('mod_1', 'Bob', 'Moderator', 'sock_2'));
    room.addParticipant(new Participant('part_1', 'Charlie', 'Participant', 'sock_3'));
    room.logAudit('change_video', 'Alice', 'Changed to dQw4w9WgXcQ');
  });

  it('Host receives audit log entries', () => {
    expect(room.getAuditLogForUser('host_1').length).toBe(1);
  });

  it('Moderator receives audit log entries', () => {
    expect(room.getAuditLogForUser('mod_1').length).toBe(1);
  });

  it('Participant receives empty audit log', () => {
    expect(room.getAuditLogForUser('part_1').length).toBe(0);
  });

  it('Unknown user receives empty audit log', () => {
    expect(room.getAuditLogForUser('unknown_user')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('7. Playlist Queue', () => {
  it('Adds items and shifts in FIFO order', () => {
    const room = new Room('TEST06', 'h1', createMockIO());
    room.addToQueue({ id: 'q1', videoId: 'aaaaaaaaaaA', title: 'A', suggestedBy: 'Host', suggestedAt: Date.now() });
    room.addToQueue({ id: 'q2', videoId: 'bbbbbbbbbbb', title: 'B', suggestedBy: 'Host', suggestedAt: Date.now() });

    expect(room.getQueue().length).toBe(2);
    const next = room.advanceQueue();
    expect(next?.videoId).toBe('aaaaaaaaaaA');
    expect(room.videoState.videoId).toBe('aaaaaaaaaaA');
    expect(room.videoState.playState).toBe('playing');
    expect(room.getQueue().length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('8. Rate Limiter', () => {
  it('Rejects burst beyond window limit', () => {
    const limiter = new SocketRateLimiter(3, 1000);
    const key = 'sock_test';
    expect(limiter.checkLimit(key)).toBe(true);
    expect(limiter.checkLimit(key)).toBe(true);
    expect(limiter.checkLimit(key)).toBe(true);
    expect(limiter.checkLimit(key)).toBe(false);
  });

  it('reset() clears the entry so requests succeed again', () => {
    const limiter = new SocketRateLimiter(1, 1000);
    expect(limiter.checkLimit('s1')).toBe(true);
    expect(limiter.checkLimit('s1')).toBe(false);
    limiter.reset('s1');
    expect(limiter.checkLimit('s1')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('9. Zod Input Validation', () => {
  it('CreateRoomSchema rejects empty username', () => {
    const r = CreateRoomSchema.safeParse({ userId: 'u1', username: '' });
    expect(r.success).toBe(false);
  });

  it('CreateRoomSchema rejects username over 32 chars', () => {
    const r = CreateRoomSchema.safeParse({ userId: 'u1', username: 'A'.repeat(33) });
    expect(r.success).toBe(false);
  });

  it('SeekSchema rejects negative time', () => {
    expect(SeekSchema.safeParse({ time: -1 }).success).toBe(false);
  });

  it('SeekSchema rejects Infinity', () => {
    expect(SeekSchema.safeParse({ time: Infinity }).success).toBe(false);
  });

  it('VideoEndedSchema rejects malformed video ID', () => {
    expect(VideoEndedSchema.safeParse({ videoId: 'bad' }).success).toBe(false);
    expect(VideoEndedSchema.safeParse({ videoId: '../../../etc' }).success).toBe(false);
  });

  it('VideoEndedSchema accepts valid 11-char ID', () => {
    expect(VideoEndedSchema.safeParse({ videoId: 'dQw4w9WgXcQ' }).success).toBe(true);
  });
});
