import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// roomId -> Set of socket IDs
const rooms = new Map<string, Set<string>>();

function getRoomPeers(roomId: string): string[] {
  return Array.from(rooms.get(roomId) ?? []);
}

io.on('connection', (socket: Socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Join a room ──────────────────────────────────────────────
  socket.on('join-room', (roomId: string) => {
    if (!roomId || typeof roomId !== 'string') return;

    // Tell the joining peer who is already in the room
    const existingPeers = getRoomPeers(roomId);
    socket.emit('room-peers', existingPeers);

    // Add to room
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId)!.add(socket.id);
    socket.join(roomId);

    // Tell existing peers that someone new joined
    socket.to(roomId).emit('peer-joined', socket.id);

    console.log(`[join] ${socket.id} → room ${roomId} (${existingPeers.length + 1} total)`);
  });

  // ── WebRTC signaling relay ───────────────────────────────────
  socket.on('offer', ({ to, offer }: { to: string; offer: unknown }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }: { to: string; answer: unknown }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }: { to: string; candidate: unknown }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // ── Leave / disconnect ───────────────────────────────────────
  socket.on('leave-room', (roomId: string) => {
    leaveRoom(socket, roomId);
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        leaveRoom(socket, roomId);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
  });
});

function leaveRoom(socket: Socket, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.delete(socket.id);
  if (room.size === 0) rooms.delete(roomId);
  socket.to(roomId).emit('peer-left', socket.id);
  socket.leave(roomId);
  console.log(`[leave] ${socket.id} ← room ${roomId}`);
}

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`LiveStudio signaling server running on http://localhost:${PORT}`);
});
