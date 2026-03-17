import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import cron from 'node-cron';
import { Server as SocketServer } from 'socket.io';
import { createCouponRouter } from './routes/coupons';
import { getRedisClient } from './services/redis';
import { fetchHotPepperCoupons } from './services/hotpepper';
import { fetchGrokSocialCoupons } from './services/grok';

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

  // ─── 定时抓取任务 ──────────────────────────────────────────────────────────
  // Hot Pepper：每 30 分钟拉取一次
  cron.schedule('*/30 * * * *', () => {
    console.log('[Cron] Running Hot Pepper coupon fetch...');
    fetchHotPepperCoupons().catch((err: Error) =>
      console.error('[Cron] Hot Pepper error:', err.message)
    );
  });

  // Grok / X 社交：每天 7:00 和 19:00（JST）拉取
  cron.schedule('0 10,22 * * *', () => {  // UTC 10:00 = JST 19:00, UTC 22:00 = JST 07:00
    console.log('[Cron] Running Grok social coupon fetch...');
    fetchGrokSocialCoupons().catch((err: Error) =>
      console.error('[Cron] Grok error:', err.message)
    );
  });

  // 启动时立即执行一次
  fetchHotPepperCoupons().catch(console.error);
  fetchGrokSocialCoupons().catch(console.error);

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
