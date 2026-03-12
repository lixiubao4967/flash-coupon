# Flash Coupon — 闪购优惠券

任何人都可以用语音发布限时优惠，AI 自动解析，实时推送给周边用户，一键分享扩散。
同时聚合 Hot Pepper 餐厅数据和 X 社交帖子，自动发现优惠信息。

PWA 应用，可安装到手机桌面，支持离线访问与 Web Push 通知。

---

## 功能概览

| 功能 | 说明 |
|------|------|
| 🎤 语音发布 | 任何人说出优惠，Claude AI 解析为结构化字段，一键发布 |
| ⚡ 实时推送 | Socket.io 广播 + Web Push 通知，订阅者即时收到 |
| 🔗 分享扩散 | 发布后 Web Share API 一键分享到微信/LINE/Twitter |
| 🍜 自动聚合 | Hot Pepper 餐厅优惠（每30分钟）+ X 社交帖子（每15分钟） |
| 🗂 分类/地区筛选 | 按餐厅类型和地区过滤，橙色/蓝色 tag 快速切换 |
| ✋ 领取核销 | 配额管理、进度条、到期自动下架 |
| 📱 PWA | 安装到桌面，离线缓存，Service Worker |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS + PWA |
| 后端 | Node.js + Express + TypeScript |
| 实时推送 | Socket.io (WebSocket) |
| 数据库 | Redis（活跃优惠券 TTL 自动过期 + 订阅存储） |
| AI 解析 | Claude Haiku（语音转录 → 结构化字段） |
| 通知 | Web Push (VAPID) |
| 自动抓取 | Hot Pepper Gourmet API + xAI Grok API（解析 X 帖子） |

---

## 项目结构

```
flash-coupon/
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # 消费者首页（实时券列表 + 分类/地区筛选）
│   │   ├── voice/page.tsx        # 语音发布页（人人可用）
│   │   ├── merchant/page.tsx     # 商家发布页（表单）
│   │   ├── layout.tsx            # 全局布局 + 导航 + SW 注册
│   │   └── globals.css
│   ├── components/
│   │   ├── CouponCard.tsx        # 优惠券卡片（来源 badge、倒计时、分享按钮）
│   │   ├── VoicePublisher.tsx    # 语音录制 → AI 解析 → 确认 → 发布 → 分享
│   │   └── PublishForm.tsx       # 商家发布表单
│   ├── lib/
│   │   ├── socket.ts             # Socket.io 客户端单例
│   │   ├── types.ts              # 共享 TypeScript 类型
│   │   └── webpush.ts            # Web Push 订阅工具
│   ├── types/
│   │   └── speech.d.ts           # Web Speech API 类型声明
│   └── public/
│       ├── manifest.json         # PWA manifest
│       ├── sw.js                 # Service Worker（缓存 + 推送）
│       └── icons/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express + Socket.io 入口 + cron 定时任务
│   │   ├── routes/coupons.ts     # 所有 API 路由
│   │   ├── services/
│   │   │   ├── redis.ts          # Redis 操作封装
│   │   │   ├── ai-parser.ts      # Claude Haiku 解析语音转录
│   │   │   ├── hotpepper.ts      # Hot Pepper API 定时抓取
│   │   │   └── grok.ts           # xAI Grok 解析 X 社交帖子
│   │   └── types.ts              # 共享类型定义
│   ├── .env.example
│   └── package.json
└── README.md
```

---

## 本地启动

### 前置条件

- Node.js >= 18
- Redis 运行在 `localhost:6379`

```bash
# macOS
brew install redis && brew services start redis
redis-cli ping   # 应返回 PONG
```

### 1. 后端

```bash
cd backend
cp .env.example .env   # 填写必要的环境变量（见下方）
npm install
npm run dev            # http://localhost:4000
```

### 2. 前端

```bash
cd frontend
npm install --legacy-peer-deps
# 创建 .env.local
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:4000" > .env.local
npm run dev            # http://localhost:3000
```

### 3. 环境变量

`backend/.env` 最小配置（仅语音功能）：

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=your_key        # 语音 AI 解析（必须）

# Web Push（可选，npx web-push generate-vapid-keys 生成）
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com

# 自动聚合（可选）
HOTPEPPER_API_KEY=...
GROK_API_KEY=...
GROK_SEARCH_AREAS=渋谷,新宿,梅田,博多,名古屋
```

---

## 使用说明

### 消费者

1. **浏览优惠券** — 打开首页，实时显示周边活跃优惠券，按分类/地区 tab 筛选
2. **订阅通知** — 点击「开启通知」，新优惠发布时浏览器会推送提醒（需授权）
3. **领取优惠** — 点击券卡上的「领取」按钮，配额耗尽时按钮置灰不可用
4. **安装到桌面** — Chrome / Safari（iOS 16.4+）访问首页 → 「添加到主屏幕」，支持离线访问

### 商家 / 发布者

**方式一：语音发布（推荐）**

1. 进入 `/voice` 页面
2. 点击录音按钮，说出优惠内容（如「今天拉面半价，限 20 份，有效 2 小时」）
3. AI 自动解析为结构化字段，确认后一键发布
4. 发布成功后可通过 Web Share 分享到微信 / LINE / Twitter

**方式二：表单发布**

1. 进入 `/merchant` 页面
2. 填写店铺名、优惠项目、折扣、有效时长、配额等字段
3. 点击发布，订阅用户立即收到通知

---

## API 费用说明

| 操作 | 消耗 | 说明 |
|------|------|------|
| 语音发布（每次） | Anthropic Token（Claude Haiku） | 约 200 token/次，≈ $0.00005，可忽略不计 |
| Hot Pepper 自动抓取 | 无 Token 消耗 | 直接调用 Hot Pepper REST API |
| Grok 抓取 X 帖子（每15分钟） | xAI Token（`GROK_API_KEY`） | 用量取决于 `GROK_SEARCH_AREAS` 配置的地区数量 |
| 浏览 / 领取 / 通知推送 | 无 Token 消耗 | — |

> **只有语音发布才会消耗 Anthropic Token。** 手动表单发布、Hot Pepper 抓取、用户浏览和领取均不调用 AI 接口。
> 日常使用下 Anthropic 费用极低，Haiku 定价约 $0.25 / 百万 input token。

---

## 数据来源

| 来源 | 标签 | 触发方式 | 有效时长 |
|------|------|----------|----------|
| 用户语音/手动发布 | 商家发布 | 实时 | 自定义 |
| Hot Pepper Gourmet | Hot Pepper | 每 30 分钟 | 2 小时 |
| X 社交帖子（via Grok） | 来自 X | 每 15 分钟 | 90 分钟 |

---

## API 参考

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/coupons` | 获取活跃优惠券，支持 `?category=` `?area=` |
| POST | `/api/coupons` | 发布优惠券（201） |
| POST | `/api/coupons/voice/parse` | 语音转录 → AI 解析结构化字段 |
| POST | `/api/coupons/:id/use` | 核销（配额耗尽返回 409） |
| POST | `/api/coupons/push/subscribe` | 注册 Web Push 订阅 |
| GET | `/health` | 健康检查 |

Socket.io 事件：`new-coupon`（新发布）、`coupon-used`（被核销，含最新 usedCount）

---

## 核心数据结构

```typescript
interface Coupon {
  id: string;
  shopId: string;
  shopName: string;
  item: string;
  discount: string;           // "50%" / "半額" / "买一送一"
  description: string;
  publishedAt: number;        // ms 时间戳
  expiresAt: number;
  durationMinutes: number;
  location: { lat: number; lng: number };
  radiusKm: number;
  totalQuota: number;
  usedCount: number;
  source: 'manual' | 'hotpepper' | 'social';
  category: string;           // "ラーメン" / "居酒屋"
  area: string;               // "渋谷" / "新宿"
  originalUrl?: string;       // Hot Pepper 或 X 帖子原链接
}
```

---

## 部署

详细步骤见 [CLAUDE.md](./CLAUDE.md) 的「部署」章节。

### 方案一：Vercel + Railway + Upstash（推荐，全托管）

1. [Upstash](https://upstash.com) 创建 Redis → 复制 `rediss://` URL
2. [Railway](https://railway.app) 部署 `backend/`（Root Dir = `backend/`），填写所有环境变量
3. [Vercel](https://vercel.com) 部署 `frontend/`（Root Dir = `frontend/`），填写 Railway 域名
4. 回 Railway 更新 `FRONTEND_URL` 为 Vercel 域名，重新部署

### 方案二：Vercel + AWS EC2 + Cloudflare Tunnel（实测可行）

1. EC2 安装 Node.js 18、Redis，克隆仓库，`npm run build`，pm2 启动后端
2. [Vercel](https://vercel.com) 部署 `frontend/`
3. EC2 安装 cloudflared，用 pm2 守护隧道，获取 `https://xxx.trycloudflare.com` 地址
4. Vercel 环境变量 `NEXT_PUBLIC_BACKEND_URL` 填隧道 HTTPS 地址，重新部署

```bash
# EC2：启动 Cloudflare Tunnel
pm2 start "cloudflared tunnel --url http://localhost:4000" --name cloudflared
pm2 save
pm2 logs cloudflared --lines 30   # 找 https://xxx.trycloudflare.com
```

> Quick Tunnel 域名重启后会变，需同步更新 Vercel 环境变量。

#### EC2 重启后恢复步骤

```bash
# 1. 恢复 PM2 进程（后端 + cloudflared 同时拉起）
pm2 resurrect

# 2. 查看新的 Cloudflare Tunnel 域名
pm2 logs cloudflared --lines 30
# 找形如 https://xxxx-xxxx.trycloudflare.com 的行
```

**3. 更新 Vercel 环境变量**（只需改这一项，Vercel 会自动重新部署）：
- Vercel → 项目 → Settings → Environment Variables
- 将 `NEXT_PUBLIC_BACKEND_URL` 改为新的 `https://xxxx.trycloudflare.com` 地址

> 如需彻底避免每次重启改域名，可升级为 Cloudflare Named Tunnel（固定域名，免费，需注册 Cloudflare 账号）。

### 需要申请的 API Key

| Key | 用途 | 申请地址 |
|-----|------|----------|
| `ANTHROPIC_API_KEY` | 语音 AI 解析（必须） | console.anthropic.com |
| `HOTPEPPER_API_KEY` | Hot Pepper 抓取（可选） | webservice.recruit.co.jp/register |
| `GROK_API_KEY` | X 社交优惠发现（可选） | console.x.ai |

