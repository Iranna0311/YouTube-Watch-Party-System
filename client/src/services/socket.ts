import { io, Socket } from 'socket.io-client';

// Determine backend WebSocket server URL:
// 1. Explicit environment variable if configured
// 2. In any remote/production deployment (Vercel, network IP, Render), connect to live Render backend
// 3. In local loopback dev (localhost / 127.0.0.1), connect to localhost:4000
function getBackendUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Connect to live Render backend whenever on Vercel, phone IP, or non-localhost
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'https://youtube-watch-party-system-udjv.onrender.com';
    }
  }
  return Boolean(import.meta.env.PROD) ? 'https://youtube-watch-party-system-udjv.onrender.com' : 'http://localhost:4000';
}

const SERVER_URL = getBackendUrl();

export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
