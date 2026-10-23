/**
 * Automated Real-Time Load Testing Script
 * Simulates high concurrency: 25 rooms × 10 users = 250 concurrent WebSockets.
 * Emits real playback commands (play, seek, pause) and NTP pings across all rooms.
 * Measures: connection success, roundtrip latency, server heap delta, event fanout.
 */
import { io, Socket } from 'socket.io-client';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:4000';
const NUM_ROOMS = 25;
const PARTICIPANTS_PER_ROOM = 10; // Total 250 concurrent WebSockets

interface Metrics {
  connectionsAttempted: number;
  connectionsSuccessful: number;
  connectionsFailed: number;
  eventsEmitted: number;
  eventsReceived: number;
  latencies: number[];
}

const metrics: Metrics = {
  connectionsAttempted: 0,
  connectionsSuccessful: 0,
  connectionsFailed: 0,
  eventsEmitted: 0,
  eventsReceived: 0,
  latencies: [],
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchServerMemory(): Promise<{ heapUsedMb: number; rssMb: number } | null> {
  try {
    const res = await fetch(`${TARGET_URL}/health`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.memory || null;
  } catch {
    return null;
  }
}

async function runLoadTest() {
  console.log('====================================================');
  console.log(`🔥 Starting WebSocket Concurrency Load Test on: ${TARGET_URL}`);
  console.log(`   Simulating: ${NUM_ROOMS} rooms × ${PARTICIPANTS_PER_ROOM} users = ${NUM_ROOMS * PARTICIPANTS_PER_ROOM} concurrent connections`);
  console.log('====================================================\n');

  const initialServerMem = await fetchServerMemory();
  const clientStartMem = process.memoryUsage();
  const startTime = Date.now();

  const rooms: Array<{ code: string; hostSocket: Socket; sockets: Socket[] }> = [];

  // 1. Establish rooms & connections
  for (let r = 0; r < NUM_ROOMS; r++) {
    const hostUserId = `host_${r}_${Date.now()}`;
    const hostSocket = io(TARGET_URL, { transports: ['websocket'] });
    metrics.connectionsAttempted++;

    await new Promise<string>((resolve) => {
      hostSocket.on('connect', () => {
        metrics.connectionsSuccessful++;
        hostSocket.emit('create_room', {
          userId: hostUserId,
          username: `Host_R${r}`,
          initialVideoId: 'M7lc1UVf-VE',
        });
      });

      hostSocket.on('room_created', (data: { roomCode: string }) => {
        resolve(data.roomCode);
      });

      hostSocket.on('connect_error', () => {
        metrics.connectionsFailed++;
        resolve('');
      });
    }).then(async (roomCode) => {
      if (!roomCode) return;

      const roomGroup: { code: string; hostSocket: Socket; sockets: Socket[] } = {
        code: roomCode,
        hostSocket,
        sockets: [hostSocket],
      };

      // Host also listens to broadcasts
      hostSocket.on('play', () => { metrics.eventsReceived++; });
      hostSocket.on('pause', () => { metrics.eventsReceived++; });
      hostSocket.on('seek', () => { metrics.eventsReceived++; });
      hostSocket.on('sync_state', () => { metrics.eventsReceived++; });

      // Spawn 9 participants for this room
      for (let p = 1; p < PARTICIPANTS_PER_ROOM; p++) {
        metrics.connectionsAttempted++;
        const partSocket = io(TARGET_URL, { transports: ['websocket'] });
        roomGroup.sockets.push(partSocket);

        const partUserId = `part_${r}_${p}_${Date.now()}`;
        partSocket.on('connect', () => {
          metrics.connectionsSuccessful++;
          partSocket.emit('join_room', {
            roomId: roomCode,
            username: `Viewer_${r}_${p}`,
            userId: partUserId,
          });
        });

        partSocket.on('play', () => { metrics.eventsReceived++; });
        partSocket.on('pause', () => { metrics.eventsReceived++; });
        partSocket.on('seek', () => { metrics.eventsReceived++; });
        partSocket.on('sync_state', () => { metrics.eventsReceived++; });

        partSocket.on('connect_error', () => {
          metrics.connectionsFailed++;
        });
      }

      rooms.push(roomGroup);
    });

    if (r % 5 === 0) await sleep(60);
  }

  // Allow all sockets to settle
  await sleep(1000);

  console.log(`\n⚡ Connected ${metrics.connectionsSuccessful} sockets across ${rooms.length} rooms.`);
  console.log('   Broadcasting play/seek/pause actions and measuring round-trip NTP latency...\n');

  // 2. Broadcast playback actions from each room's host
  for (const room of rooms) {
    if (room.hostSocket.connected) {
      metrics.eventsEmitted += 3;
      room.hostSocket.emit('play', { currentTime: 15 });
      room.hostSocket.emit('seek', { time: 45 });
      room.hostSocket.emit('pause', { currentTime: 45 });
    }
  }

  // 3. NTP Round-Trip Latency sample across all sockets
  for (const room of rooms) {
    for (const s of room.sockets) {
      if (s.connected) {
        metrics.eventsEmitted++;
        const t0 = Date.now();
        s.emit('time_ping', () => {
          metrics.latencies.push(Date.now() - t0);
          metrics.eventsReceived++;
        });
      }
    }
  }

  // Allow broadcasts to fan out and flush
  await sleep(2500);

  const finalServerMem = await fetchServerMemory();
  const clientEndMem = process.memoryUsage();
  const totalDuration = (Date.now() - startTime) / 1000;

  rooms.forEach((r) => r.sockets.forEach((s) => s.disconnect()));

  metrics.latencies.sort((a, b) => a - b);
  const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / (metrics.latencies.length || 1);
  const p95Latency = metrics.latencies[Math.floor(metrics.latencies.length * 0.95)] || 0;
  const p99Latency = metrics.latencies[Math.floor(metrics.latencies.length * 0.99)] || 0;

  console.log('================ LOAD TEST RESULTS ================');
  console.log(`Scope:                        ${NUM_ROOMS} rooms × ${PARTICIPANTS_PER_ROOM} users = ${NUM_ROOMS * PARTICIPANTS_PER_ROOM} connections`);
  console.log(`Total Connections Attempted:  ${metrics.connectionsAttempted}`);
  console.log(`Total Connections Succeeded:  ${metrics.connectionsSuccessful}`);
  console.log(`Connection Failures:          ${metrics.connectionsFailed} (${((metrics.connectionsFailed / (metrics.connectionsAttempted || 1)) * 100).toFixed(2)}%)`);
  console.log(`Events Emitted:               ${metrics.eventsEmitted} (75 room actions + 250 time_pings)`);
  console.log(`Events Received (Fanout):     ${metrics.eventsReceived}`);
  console.log(`Average Round-Trip Latency:   ${avgLatency.toFixed(2)} ms`);
  console.log(`p95 Latency:                  ${p95Latency} ms`);
  console.log(`p99 Latency:                  ${p99Latency} ms`);
  if (finalServerMem && initialServerMem) {
    console.log(`Server Heap Delta:            ${(finalServerMem.heapUsedMb - initialServerMem.heapUsedMb).toFixed(2)} MB (Server Heap: ${finalServerMem.heapUsedMb} MB)`);
    console.log(`Server RSS:                   ${finalServerMem.rssMb} MB`);
  } else {
    console.log(`Load Runner Process Heap:     ${(clientEndMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  }
  console.log(`Total Test Duration:          ${totalDuration.toFixed(2)} s`);
  console.log('====================================================\n');
}

runLoadTest().catch((err) => console.error(err));
