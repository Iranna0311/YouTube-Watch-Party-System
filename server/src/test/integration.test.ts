import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client, Socket } from 'socket.io-client';
import { server, startServer } from '../index';

const PORT = 4002;
let hostSocket: Socket;
let partSocket: Socket;
let part3Socket: Socket;
let roomCode = '';
let hostSessionToken = '';
let charlieSessionToken = '';

beforeAll(async () => {
  if (!server.listening) {
    await new Promise<void>((resolve) => {
      startServer(PORT);
      resolve();
    });
  }
});

afterAll(async () => {
  hostSocket?.disconnect();
  partSocket?.disconnect();
  part3Socket?.disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Live WebSocket Integration Tests', () => {
  const url = `http://localhost:${PORT}`;

  it('1. Host creates room and receives private sessionToken', async () => {
    hostSocket = Client(url);
    await new Promise<void>((resolve, reject) => {
      hostSocket.on('connect', () => {
        hostSocket.emit('create_room', {
          userId: 'user_host_1',
          username: 'AliceHost',
          initialVideoId: 'dQw4w9WgXcQ',
        });
      });

      hostSocket.on('room_created', (data: any) => {
        expect(data.roomCode).toBeDefined();
        expect(data.host.role).toBe('Host');
        expect(data.sessionToken).toBeDefined();
        expect(data.syncState.videoId).toBe('dQw4w9WgXcQ');
        roomCode = data.roomCode;
        hostSessionToken = data.sessionToken;
        resolve();
      });

      hostSocket.on('error', (err: any) => reject(new Error(err.message)));
    });
  });

  it('2. Participant joins room and receives role Participant & sessionToken', async () => {
    partSocket = Client(url);
    await new Promise<void>((resolve, reject) => {
      partSocket.on('connect', () => {
        partSocket.emit('join_room', {
          roomId: roomCode,
          username: 'BobParticipant',
          userId: 'user_part_2',
        });
      });

      partSocket.on('session_authenticated', (data: any) => {
        expect(data.role).toBe('Participant');
        expect(data.sessionToken).toBeDefined();
      });

      partSocket.on('user_joined', (data: any) => {
        if (data.participants.length === 2) {
          resolve();
        }
      });

      partSocket.on('error', (err: any) => reject(new Error(err.message)));
    });
  });

  it('3. Participant attempts unauthorized video change -> Server rejects', async () => {
    await new Promise<void>((resolve) => {
      partSocket.once('error', (err: any) => {
        expect(err.message).toContain('Unauthorized');
        resolve();
      });

      partSocket.emit('change_video', { videoId: 'M7lc1UVf-VE' });
    });
  });

  it('4. Host promotes Participant to Moderator', async () => {
    await new Promise<void>((resolve) => {
      partSocket.once('role_assigned', (data: any) => {
        expect(data.role).toBe('Moderator');
        resolve();
      });

      hostSocket.emit('assign_role', { userId: 'user_part_2', role: 'Moderator' });
    });
  });

  it('5. Moderator can now change video', async () => {
    await new Promise<void>((resolve) => {
      hostSocket.once('change_video', (data: any) => {
        expect(data.videoId).toBe('M7lc1UVf-VE');
        resolve();
      });

      partSocket.emit('change_video', { videoId: 'M7lc1UVf-VE' });
    });
  });

  it('6. Bug D Security Verification: Impersonation without token fails', async () => {
    const maliciousSocket = Client(url);
    await new Promise<void>((resolve) => {
      maliciousSocket.on('connect', () => {
        // Passes schema (valid non-uuid string) but token won't match stored UUID
        maliciousSocket.emit('join_room', {
          roomId: roomCode,
          username: 'EvilHacker',
          userId: 'user_host_1',
          sessionToken: 'totally-wrong-token-stolen-from-participant-list',
        });
      });

      maliciousSocket.on('error', (err: any) => {
        expect(err.message).toContain('Identity in use');
        maliciousSocket.disconnect();
        resolve();
      });
    });
  }, 8000);

  it('7. Participant submits Change Request and Host approves', async () => {
    part3Socket = Client(url);
    await new Promise<void>((resolve) => {
      part3Socket.on('connect', () => {
        part3Socket.emit('join_room', {
          roomId: roomCode,
          username: 'CharlieViewer',
          userId: 'user_charlie_3',
        });
      });
      part3Socket.on('session_authenticated', (data: any) => {
        charlieSessionToken = data.sessionToken;
        resolve();
      });
    });

    let pendingReqId = '';
    await new Promise<void>((resolve) => {
      hostSocket.once('change_request_received', (req: any) => {
        expect(req.type).toBe('seek');
        pendingReqId = req.requestId;
        resolve();
      });

      part3Socket.emit('change_request', {
        type: 'seek',
        payload: { time: 55 },
      });
    });

    await new Promise<void>((resolve) => {
      part3Socket.once('change_request_resolved', (res: any) => {
        expect(res.status).toBe('approved');
        expect(res.approvedBy).toBe('AliceHost');
        resolve();
      });

      hostSocket.emit('approve_request', { requestId: pendingReqId });
    });
  });

  it('8. Host kicks and bans Charlie -> Charlie cannot rejoin', async () => {
    await new Promise<void>((resolve) => {
      part3Socket.once('participant_removed', (data: any) => {
        expect(data.reason).toContain('removed and banned');
        resolve();
      });

      hostSocket.emit('remove_participant', { userId: 'user_charlie_3' });
    });

    // Attempt to rejoin
    const bannedRejoinSocket = Client(url);
    await new Promise<void>((resolve) => {
      bannedRejoinSocket.on('connect', () => {
        bannedRejoinSocket.emit('join_room', {
          roomId: roomCode,
          username: 'CharlieBanned',
          userId: 'user_charlie_3',
          sessionToken: charlieSessionToken,
        });
      });

      bannedRejoinSocket.on('error', (err: any) => {
        expect(err.message).toContain('banned');
        bannedRejoinSocket.disconnect();
        resolve();
      });
    });
  });

  it('9. video_ended from Participant is silently ignored (Participant cannot skip)', async () => {
    // Join a fresh participant for this test
    const skipAbuser = Client(url);
    await new Promise<void>((resolve) => {
      skipAbuser.on('connect', () => {
        skipAbuser.emit('join_room', {
          roomId: roomCode,
          username: 'SkipAbuser',
          userId: 'user_skip_abuser',
        });
      });
      skipAbuser.on('session_authenticated', () => resolve());
    });

    // Add something to the queue first
    await new Promise<void>((resolve) => {
      hostSocket.emit('add_to_queue', { videoId: 'M7lc1UVf-VE' });
      setTimeout(resolve, 200); // small pause for server to process
    });

    // Participant tries to trigger queue advance via video_ended
    let gotQueueUpdate = false;
    skipAbuser.on('queue_updated', () => { gotQueueUpdate = true; });
    skipAbuser.emit('video_ended', { videoId: 'M7lc1UVf-VE' });

    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    expect(gotQueueUpdate).toBe(false); // server must have ignored it

    skipAbuser.disconnect();
  });

  it('10. Reconnect with wrong token is rejected; fresh userId still joins fine', async () => {
    // Attempt to reclaim Bob's role with a wrong token
    const impersonatorSocket = Client(url);
    await new Promise<void>((resolve) => {
      impersonatorSocket.on('connect', () => {
        impersonatorSocket.emit('join_room', {
          roomId: roomCode,
          username: 'ImpersonatorBob',
          userId: 'user_part_2',
          sessionToken: '00000000-0000-0000-0000-000000000000', // wrong uuid
        });
      });
      impersonatorSocket.on('error', (err: any) => {
        expect(err.message).toContain('Invalid session token');
        impersonatorSocket.disconnect();
        resolve();
      });
    });

    // Fresh userId with no token must still be allowed in as Participant
    const freshSocket = Client(url);
    await new Promise<void>((resolve) => {
      freshSocket.on('connect', () => {
        freshSocket.emit('join_room', {
          roomId: roomCode,
          username: 'BrandNewUser',
          userId: 'user_brand_new_xyz',
          // no sessionToken
        });
      });
      freshSocket.on('session_authenticated', (data: any) => {
        expect(data.role).toBe('Participant');
        freshSocket.disconnect();
        resolve();
      });
    });
  });
});
