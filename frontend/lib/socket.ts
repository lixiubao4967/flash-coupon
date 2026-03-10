import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket.io] Connected, id:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.io] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket.io] Connection error:', err.message);
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
