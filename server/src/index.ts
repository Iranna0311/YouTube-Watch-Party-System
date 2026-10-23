import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './models/RoomManager';
import { registerSocketHandlers } from './handlers/socketHandlers';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

// Standard Express middleware
app.use(
  cors({
    origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint with server memory metrics (for Render / uptime / load monitoring)
app.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: {
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    },
  });
});

// Initialize Socket.IO with CORS support
const io = new SocketIOServer(server, {
  cors: {
    origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// Horizontal Scaling: Attach Redis adapter if REDIS_URL is provided
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const Redis = require('ioredis');
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err: any) => console.error('[WatchParty Redis Pub] Error:', err));
    subClient.on('error', (err: any) => console.error('[WatchParty Redis Sub] Error:', err));
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[WatchParty Server] Connected to Redis for horizontal cluster scaling');
  } catch (err) {
    console.warn('[WatchParty Server] Redis adapter failed to initialize, running single instance:', err);
  }
}

// Instantiate OOP State Manager
const roomManager = new RoomManager(io);

// Optional HTTP endpoint to check if a room code exists
app.get('/api/room/:code', (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  return res.json({
    code: room.code,
    hostId: room.hostId,
    participantsCount: room.getParticipantsList().length,
  });
});

// Serve frontend build if dist folder exists (Full-stack Render deployment support)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Register real-time Socket.IO event handlers
registerSocketHandlers(io, roomManager);

export function startServer(port: number | string = PORT) {
  if (server.listening) return server;
  return server.listen(port, () => {
    console.log(`[WatchParty Server] Running on http://localhost:${port}`);
    console.log(`[WatchParty Server] CORS allowed origin: ${CLIENT_ORIGIN}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, server, roomManager, io };
