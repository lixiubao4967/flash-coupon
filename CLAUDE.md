# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`/backend`)
```bash
npm run dev      # Start dev server with hot reload (ts-node-dev, port 4000)
npm run build    # Compile TypeScript to dist/
npm start        # Run compiled output
```

### Frontend (`/frontend`)
```bash
npm run dev      # Start Next.js dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint via Next.js
```

### Setup
Generate VAPID keys for Web Push:
```bash
npx web-push generate-vapid-keys
```

Environment files needed:
- `backend/.env` — PORT, FRONTEND_URL, REDIS_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
- `frontend/.env.local` — NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY

## Architecture

Full-stack PWA for real-time flash coupons. Merchants publish time-limited coupons; consumers see them instantly and can claim them.

### Stack
- **Frontend**: Next.js 15 App Router + React 19 + TypeScript + Tailwind CSS + PWA
- **Backend**: Express + Socket.io + TypeScript
- **Data store**: Redis (ioredis) — coupons stored with TTL auto-expiration, subscriptions with 30-day TTL
- **Notifications**: Web Push (VAPID)

### Data Flow
1. Merchant submits form → `POST /api/coupons` → Redis stores coupon with TTL
2. Backend broadcasts `new-coupon` via Socket.io + sends Web Push to all subscribers
3. Consumer receives event → UI updates immediately with countdown timer
4. Consumer claims → `POST /api/coupons/:id/use` → Redis increments `usedCount` → broadcasts `coupon-used`

### Key Files
- `backend/src/index.ts` — Express app, Socket.io setup, CORS
- `backend/src/routes/coupons.ts` — All API endpoints
- `backend/src/services/redis.ts` — Redis operations (coupon storage in sorted set by expiry, subscription storage)
- `backend/src/types.ts` — Shared `Coupon` interface
- `frontend/app/page.tsx` — Consumer UI (real-time coupon list with countdown timers)
- `frontend/app/merchant/page.tsx` — Merchant publish form
- `frontend/components/CouponCard.tsx` — Coupon display with countdown and quota bar
- `frontend/lib/socket.ts` — Socket.io client singleton
- `frontend/lib/webpush.ts` — Web Push subscription logic
- `frontend/public/sw.js` — Service Worker for offline support and caching

### Core Data Model
```typescript
interface Coupon {
  id: string;           // UUID
  shopId: string;
  shopName: string;
  item: string;
  discount: string;     // e.g. "50%"
  description: string;
  publishedAt: number;  // ms timestamp
  expiresAt: number;    // publishedAt + durationMinutes * 60000
  durationMinutes: number;
  location: { lat: number; lng: number };
  radiusKm: number;
  totalQuota: number;
  usedCount: number;
}
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/coupons` | All active coupons |
| POST | `/api/coupons` | Publish coupon (201) |
| POST | `/api/coupons/:id/use` | Claim coupon (409 if quota exhausted) |
| POST | `/api/coupons/push/subscribe` | Register Web Push subscription |
| GET | `/health` | Health check |

### Socket.io Events
- `new-coupon` — broadcast when merchant publishes
- `coupon-used` — broadcast when consumer claims (includes updated `usedCount`)

### PWA Details
- `frontend/next.config.js` sets `Cache-Control: no-cache` for `sw.js` to prevent stale service worker
- Service Worker registered in `frontend/app/layout.tsx`
- Tailwind uses a custom orange-based brand palette with a `pulse-fast` animation

## Deployment (AWS)

### Recommended Stack
- **Frontend**: Vercel（免费，自动 CI/CD，连接 GitHub 仓库即可）
- **Backend**: AWS EC2 或 Railway
- **Redis**: [Upstash](https://upstash.com)（推荐，免费额度，无需自建，零运维）

### Redis — 使用 Upstash
1. 注册 [upstash.com](https://upstash.com)，创建 Redis 数据库，选择离服务器最近的区域
2. 复制 `Redis URL`（格式：`rediss://...`）
3. 填入 `backend/.env`：
   ```
   REDIS_URL=rediss://your-upstash-url
   ```

### Backend 部署到 AWS EC2
```bash
# 服务器上安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 克隆项目，安装依赖，编译
cd backend
npm install
npm run build

# 用 PM2 保持后台运行
npm install -g pm2
pm2 start dist/index.js --name flash-coupon-backend
pm2 save
pm2 startup   # 设置开机自启
```

配置 `backend/.env`（生产环境）：
```
PORT=4000
FRONTEND_URL=https://your-vercel-domain.vercel.app
REDIS_URL=rediss://your-upstash-url
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

### Frontend 部署到 Vercel
1. 将代码推送到 GitHub
2. 在 Vercel 导入仓库，设置 Root Directory 为 `frontend`
3. 添加环境变量：
   ```
   NEXT_PUBLIC_BACKEND_URL=http://your-ec2-ip:4000
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   ```

### 注意事项
- EC2 安全组需开放 4000 端口（后端）
- Next.js 15.0.3 有已知安全漏洞（CVE-2025-66478），生产部署前建议升级到最新版
- 安装时前端需用 `npm install --legacy-peer-deps`（React 19.2.x 与 Next.js 15.0.3 peer deps 冲突）
