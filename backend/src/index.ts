import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createCouponRouter } from './routes/coupons';
import { getRedisClient } from './services/redis';

const PORT = parseInt(process.env.PORT || '4000', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function bootstrap() {
  // ─── Express 应用 ──────────────────────────────────────────────────────────
  const app = express();
  app.use(cors({ origin: FRONTEND_URL, credentials: true }));
  app.use(express.json());

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── HTTP 服务器 & Socket.io ───────────────────────────────────────────────
  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  // ─── 路由 ──────────────────────────────────────────────────────────────────
  app.use('/api/coupons', createCouponRouter(io));

  // ─── 预连接 Redis ──────────────────────────────────────────────────────────
  const redis = getRedisClient();
  await redis.connect().catch((err: Error) => {
    console.error('[Redis] Failed to connect on startup:', err.message);
    // 不阻塞启动，Redis 会在首次操作时自动重连
  });

  // ─── 启动监听 ──────────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.log(`[Server] Flash Coupon backend running on http://localhost:${PORT}`);
    console.log(`[Server] Socket.io ready`);
    console.log(`[Server] Allowing CORS from: ${FRONTEND_URL}`);
  });

  // ─── 优雅关闭 ──────────────────────────────────────────────────────────────
  process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received, shutting down...');
    await redis.quit();
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
