import { io, Socket } from 'socket.io-client';

// Determine backend WebSocket server URL:
// 1. Explicit environment variable if configured
// 2. If loaded from Vercel (*.vercel.app), connect directly to live Render backend
// 3. If hosted on Render, use same origin ('/')
// 4. In local development, fallback to localhost:4000
function getBackendUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('vercel.app') || host.includes('vercel')) {
      return 'https://youtube-watch-party-system-udjv.onrender.com';
    }
  }
  return Boolean(import.meta.env.PROD) ? '/' : 'http://localhost:4000';
}

const SERVER_URL = getBackendUrl();

export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
