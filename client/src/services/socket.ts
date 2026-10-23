import { io, Socket } from 'socket.io-client';

// Connect to explicit env URL if configured; in production fallback to same origin ('/'), else localhost:4000
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '/' : 'http://localhost:4000');

export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

