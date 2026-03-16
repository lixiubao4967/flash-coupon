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
- `backend/.env` — PORT, FRONTEND_URL, REDIS_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, ANTHROPIC_API_KEY, HOTPEPPER_API_KEY, GROK_API_KEY
- `frontend/.env.local` — NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY

### ⚠️ 部署前需要你完成的事项

#### Step 1 — 申请 API Keys

| Key | 用途 | 是否必须 | 申请地址 |
|-----|------|----------|----------|
| `ANTHROPIC_API_KEY` | 语音发布 AI 解析（Claude Haiku） | **必须** | https://console.anthropic.com/ |
| `HOTPEPPER_API_KEY` | 自动抓取 Hot Pepper 餐厅优惠 | 可选 | https://webservice.recruit.co.jp/register |
| `GROK_API_KEY` | 解析 X 社交帖子中的优惠信息 | 可选 | https://console.x.ai/ |

> Hot Pepper / Grok 未配置时后端会跳过对应抓取，语音发布和手动发布不受影响。

#### Step 2 — 生成 VAPID Keys（Web Push 通知）

```bash
cd backend
npx web-push generate-vapid-keys
# 复制输出的 Public Key 和 Private Key
```

#### Step 3 — 选择部署平台，填写 .env

见下方「部署」章节。

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
- `backend/src/index.ts` — Express app, Socket.io setup, CORS, cron jobs
- `backend/src/routes/coupons.ts` — All API endpoints
- `backend/src/services/redis.ts` — Redis operations (coupon storage in sorted set by expiry, subscription storage)
- `backend/src/services/hotpepper.ts` — Hot Pepper Gourmet API 定时抓取（每 30 分钟，默认东京地区）
- `backend/src/services/grok.ts` — xAI Grok Responses API 搜索 X 社交帖子（每天 JST 7:00，默认虎ノ門）
- `backend/src/services/ai-parser.ts` — Claude Haiku 解析语音转录文本为结构化字段
- `backend/src/types.ts` — Shared `Coupon` interface
- `frontend/app/page.tsx` — Consumer UI (real-time coupon list, category/area filter tabs)
- `frontend/app/voice/page.tsx` — 语音发布页（任何人均可使用）
- `frontend/app/merchant/page.tsx` — Merchant publish form
- `frontend/components/VoicePublisher.tsx` — 语音录制 → AI 解析 → 确认 → 发布 → 分享全流程
- `frontend/components/CouponCard.tsx` — Coupon display with source badge, share button, countdown and quota bar
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
  source: 'manual' | 'hotpepper' | 'social';  // 数据来源
  category: string;     // 分类，如 "ラーメン"
  area: string;         // 地区，如 "渋谷"
  originalUrl?: string; // 外部原文链接
}
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/coupons` | All active coupons（支持 `?category=` `?area=` 过滤） |
| POST | `/api/coupons` | Publish coupon (201)，可选字段 `category` `area` |
| POST | `/api/coupons/voice/parse` | 语音转录文本 → AI 解析结构化字段（需 ANTHROPIC_API_KEY） |
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

## 部署

### 推荐组合

| 服务 | 平台 | 费用 | 说明 |
|------|------|------|------|
| Frontend | Vercel | 免费 | 连 GitHub 自动 CI/CD |
| Backend | Railway | 免费额度 / $5起 | 比 EC2 简单，支持 Socket.io |
| Redis | Upstash | 免费额度 | 无需自建，提供 `rediss://` URL |

> **为什么不用 AWS EC2？** EC2 可以用，但 Railway 部署更简单（无需配置安全组、SSH），对个人项目更友好。如果已有 EC2 可参考末尾的 EC2 部分。

---

### 一、Upstash Redis

1. 注册 [upstash.com](https://upstash.com) → Create Database → 选离用户最近的区域（日本用 ap-northeast-1）
2. 复制 `REST URL` 旁边的 **Redis URL**（格式 `rediss://...`）
3. 后续填入 `REDIS_URL`

---

### 二、Backend 部署到 Railway

1. 注册 [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. 选择本仓库，设置 **Root Directory** 为 `backend`
3. Railway 会自动检测 Node.js 并运行 `npm run build && npm start`
4. 进入项目 → Variables，添加以下所有环境变量：

```
PORT=4000
FRONTEND_URL=https://your-vercel-domain.vercel.app   # 第三步填写后回来更新
REDIS_URL=rediss://your-upstash-url

# Web Push（必填，用 npx web-push generate-vapid-keys 生成）
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:you@example.com

# AI 解析（语音发布功能必填）
ANTHROPIC_API_KEY=your_anthropic_key

# 自动抓取（可选）
HOTPEPPER_API_KEY=your_hotpepper_key
GROK_API_KEY=your_grok_key
GROK_SEARCH_AREAS=虎ノ門
```

5. Deploy 后复制 Railway 分配的域名，格式为 `https://xxx.railway.app`

---

### 三、Frontend 部署到 Vercel

1. 注册 [vercel.com](https://vercel.com) → Add New Project → Import GitHub repo
2. 设置 **Root Directory** 为 `frontend`
3. Framework Preset 选 **Next.js**（自动检测）
4. 添加环境变量：

```
NEXT_PUBLIC_BACKEND_URL=https://xxx.railway.app   # Railway 域名
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
```

5. Deploy → 复制 Vercel 域名（如 `https://flash-coupon.vercel.app`）
6. **回到 Railway**，把 `FRONTEND_URL` 更新为 Vercel 域名，重新部署

---

### 四、验证部署

```bash
# 检查后端健康
curl https://xxx.railway.app/health

# 检查优惠券接口
curl https://xxx.railway.app/api/coupons
```

打开 Vercel 域名，测试：
- [ ] 首页能加载，连接状态显示绿点（Socket.io 正常）
- [ ] 语音发布页（/voice）可以录音并解析
- [ ] 商家发布页（/merchant）可以发布，首页实时出现

---

### 备选：Backend 部署到 AWS EC2

```bash
# EC2 上安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# 克隆并编译
git clone https://github.com/your/flash-coupon.git
cd flash-coupon/backend
npm install
npm run build

# 创建 .env（参考上方变量列表）
nano .env

# PM2 守护进程
npm install -g pm2
pm2 start dist/index.js --name flash-coupon-backend
pm2 save && pm2 startup
```

EC2 注意事项：
- 安全组需开放 **4000 端口**（入站 TCP）
- `FRONTEND_URL` 填 Vercel 域名（CORS 白名单）
- Vercel 的 `NEXT_PUBLIC_BACKEND_URL` 填 `http://your-ec2-ip:4000`

---

### 备选：使用 EC2 本地 Redis（替代 Upstash）

如果 Backend 部署在 EC2 上，可以直接使用 EC2 本机安装的 Redis，无需 Upstash。

```bash
# 安装 Redis
sudo apt update
sudo apt install -y redis-server

# 启动并设置开机自启
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 验证运行
redis-cli ping   # 返回 PONG 即正常
```

`.env` 中 `REDIS_URL` 填本地地址：

```
REDIS_URL=redis://127.0.0.1:6379
```

> 注意：本地 Redis 默认无密码、仅监听 127.0.0.1，不对外暴露，安全性良好。如需设置密码，在 `/etc/redis/redis.conf` 中配置 `requirepass yourpassword`，并将 URL 改为 `redis://:yourpassword@127.0.0.1:6379`。

---

### 注意事项

- ~~Next.js 15.0.3 有已知安全漏洞（CVE-2025-66478）~~ → 已升级到 16.1.6，问题已修复
- 前端安装依赖需用 `npm install --legacy-peer-deps`（React 19 与旧版 Next.js peer deps 冲突，升级后仍需此标志）
- Socket.io 需要 WebSocket 支持：Railway 默认支持；EC2 需确认 nginx/防火墙未阻断 WebSocket 升级

---

## 实际部署记录（2026-03-12）

### 当前部署方案
- **Frontend**: Vercel — https://flash-coupon.vercel.app
- **Backend**: AWS EC2（ap-northeast-1，IP: 13.115.193.55，端口 4000）
- **Redis**: EC2 本地 Redis（redis://127.0.0.1:6379）

### 遇到的问题与解决方案

#### 问题 1：Vercel npm install 失败（peer deps 冲突）
**报错**: `ERESOLVE could not resolve` — next@15.0.3 与 react@19 peer deps 不兼容
**解决**: Vercel 项目 → Settings → General → Install Command 改为：
```
npm install --legacy-peer-deps
```

#### 问题 2：webpush.ts TypeScript 类型错误导致构建失败
**报错**: `Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'string | BufferSource'`
**解决**: `frontend/lib/webpush.ts` 第 36 行加类型断言：
```ts
applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
```

#### 问题 3：Vercel 因安全漏洞拒绝部署
**报错**: `Vulnerable version of Next.js detected` (CVE-2025-66478)
**解决**: 升级 Next.js 到最新版：
```bash
cd frontend && npm install next@latest --legacy-peer-deps
```

#### 问题 4：前端 "Failed to fetch"（Mixed Content）✅ 已解决
**原因**: 前端是 HTTPS（Vercel），后端是 HTTP（EC2 裸 IP），浏览器阻止混合内容请求
**解决**: 使用 Cloudflare Tunnel 为 EC2 后端提供 HTTPS 地址，无需域名，免费。

```bash
# EC2 上安装 cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# 用 pm2 守护（开机自启）
pm2 start "cloudflared tunnel --url http://localhost:4000" --name cloudflared
pm2 save

# 查看分配的 HTTPS 地址
pm2 logs cloudflared --lines 30
# 找形如 https://xxx.trycloudflare.com 的行
```

然后将 Vercel 环境变量 `NEXT_PUBLIC_BACKEND_URL` 更新为该 HTTPS 地址，重新部署前端。

> ⚠️ Quick Tunnel 的域名**每次重启 cloudflared 会变**，需同步更新 Vercel 环境变量并重新部署。
> 如需固定域名，注册 Cloudflare 账号后改用 Named Tunnel。

---

## 调试与修复记录（2026-03-17）

### 修复内容

#### 1. PWA 图标无效
**问题**: `frontend/public/icons/` 下所有 PNG 都是 1×1 像素的占位图，浏览器报 Manifest 图标下载错误
**解决**: 用 Python Pillow 生成橙色背景 + 白色闪电图案的正式 PWA 图标（72~512px 全尺寸）

#### 2. xAI Grok API 410 Gone
**问题**: xAI 于 2025-12 废弃了 `/v1/chat/completions` 的 `search_parameters` 功能
**解决**: 迁移到新的 Responses API：
- 端点: `/v1/chat/completions` → `/v1/responses`
- 请求体: `messages` → `input`，`search_parameters` → `tools: [{ type: "web_search" }]`
- 模型: `grok-3` → `grok-4-latest`（搜索工具仅支持 grok-4 系列）
- 响应解析: 适配新的 `output[].content[].text` 格式

#### 3. HotPepper 返回空结果
**问题**: 查询未指定地区，API 返回空
**解决**: 添加 `large_area: 'Z011'`（东京地区）参数

#### 4. Grok API 费用优化
**问题**: 每 15 分钟 × 5 个城市 = 480 次/天，约 $540/月
**解决**:
- 频率: 每 15 分钟 → 每天 JST 07:00（cron: `0 22 * * *` UTC）
- 区域: 5 个城市 → 仅虎ノ門（`.env` 中 `GROK_SEARCH_AREAS=虎ノ門`）
- 费用: $540/月 → 约 $1.2/月（节省 99.8%）

### 当前运行费用

| 服务 | 月费用 | 说明 |
|------|--------|------|
| xAI Grok API | ~$1.2 | 每天 1 次搜索（JST 7:00） |
| Anthropic Claude API | 按量 | 语音发布时触发，单次 ~$0.001 |
| HotPepper API | 免费 | — |
| Vercel (Frontend) | 免费 | 免费额度内 |
| AWS EC2 (Backend) | 按实例 | 已有资源 |
| Redis | 免费 | EC2 本地运行 |
| Cloudflare Tunnel | 免费 | Quick Tunnel |

### EC2 后端更新流程

```bash
cd /data/okcoin/flash-coupon && git pull && cd backend && npm run build && pm2 restart flash-coupon-backend
```

查看日志：
```bash
pm2 logs flash-coupon-backend --lines 20
```
