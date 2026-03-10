# Flash Coupon - 闪购优惠券

商家发布短时效优惠券（例如"半小时内拉面半价"），消费者实时收到推送，在有效期内使用。
PWA 应用，消费者可直接从浏览器安装到手机桌面，支持离线访问与 Web Push 通知。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15 (App Router) + TypeScript + Tailwind CSS + PWA |
| 后端 | Node.js + Express + TypeScript |
| 实时推送 | Socket.io (WebSocket) |
| 数据库 | Redis（活跃优惠券 + TTL 自动过期） |
| 推送通知 | Web Push (VAPID / FCM) |

---

## 项目结构

```
flash-coupon/
├── frontend/                  # Next.js 15 PWA
│   ├── app/
│   │   ├── page.tsx           # 消费者首页，显示附近活跃优惠券列表
│   │   ├── merchant/page.tsx  # 商家发布优惠券页面
│   │   ├── layout.tsx         # 全局布局 + SW 注册
│   │   └── globals.css
│   ├── components/
│   │   ├── CouponCard.tsx     # 优惠券卡片，含实时倒计时
│   │   └── PublishForm.tsx    # 商家发布表单
│   ├── lib/
│   │   ├── socket.ts          # Socket.io 客户端单例
│   │   ├── types.ts           # 共享 TypeScript 类型
│   │   └── webpush.ts         # Web Push 订阅工具
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   ├── sw.js              # Service Worker（缓存 + 推送）
│   │   ├── icons/             # PWA 图标（各尺寸）
│   │   └── generate-icons.js  # 占位图标生成脚本（开发用）
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── index.ts           # Express + Socket.io 入口
│   │   ├── routes/coupons.ts  # POST /api/coupons, GET /api/coupons
│   │   ├── services/redis.ts  # Redis 操作封装
│   │   └── types.ts           # 共享类型定义
│   ├── tsconfig.json
│   └── package.json
├── .gitignore
└── README.md
```

---

## 本地启动

### 前置条件

- Node.js >= 18
- Redis 服务运行在 `localhost:6379`

安装 Redis（macOS）：

```bash
brew install redis
brew services start redis
# 验证连接
redis-cli ping   # 应返回 PONG
```

---

### 1. 启动后端

```bash
cd backend
cp .env.example .env          # 按需修改端口和 VAPID 密钥
npm install
npm run dev                   # 监听 http://localhost:4000
```

后端启动后会看到：

```
[Redis] Connected to Redis at redis://localhost:6379
[Server] Flash Coupon backend running on http://localhost:4000
[Server] Socket.io ready
```

---

### 2. 启动前端

```bash
cd frontend
cp .env.local.example .env.local   # 按需修改后端地址
npm install
npm run dev                         # 监听 http://localhost:3000
```

打开 [http://localhost:3000](http://localhost:3000) 即可看到消费者首页。
商家发布页面：[http://localhost:3000/merchant](http://localhost:3000/merchant)

---

### 3. 配置 Web Push 通知（可选）

生成 VAPID 密钥对：

```bash
cd backend
npx web-push generate-vapid-keys
```

将输出的公钥和私钥分别填入：

- `backend/.env` 的 `VAPID_PUBLIC_KEY` 和 `VAPID_PRIVATE_KEY`
- `frontend/.env.local` 的 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

---

## API 文档

### POST /api/coupons — 发布优惠券

```json
{
  "shopId": "shop-001",
  "shopName": "老李拉面",
  "item": "招牌拉面",
  "discount": "50%",
  "description": "每桌限用一张",
  "durationMinutes": 30,
  "location": { "lat": 31.2304, "lng": 121.4737 },
  "radiusKm": 1,
  "totalQuota": 50
}
```

成功返回 201 + 完整 Coupon 对象，并触发：
- Socket.io `new-coupon` 事件（实时广播）
- Web Push 通知（所有订阅者）

### GET /api/coupons — 获取所有活跃优惠券

返回按发布时间倒序的 Coupon 数组（Redis 中已过期的自动过滤）。

### POST /api/coupons/:id/use — 核销优惠券

使用一张优惠券，超配额返回 409。成功后广播 `coupon-used` 事件。

### POST /api/coupons/push/subscribe — 注册 Web Push 订阅

接收浏览器 PushSubscription 对象，存入 Redis（30 天有效期）。

---

## 核心数据结构

```typescript
interface Coupon {
  id: string;
  shopId: string;
  shopName: string;
  item: string;
  discount: string;        // 例如 "50%"
  description: string;
  publishedAt: number;     // 服务端时间戳（毫秒）
  expiresAt: number;       // publishedAt + durationMinutes * 60000
  durationMinutes: number;
  location: { lat: number; lng: number };
  radiusKm: number;
  totalQuota: number;
  usedCount: number;
}
```

---

## PWA 安装

在 Chrome / Safari（iOS 16.4+）中访问首页，点击浏览器地址栏的"安装"按钮，即可将 App 添加到手机桌面，支持独立模式（无浏览器 UI）启动。

---

## 生产部署建议

- 前端：Vercel / Cloudflare Pages（环境变量设置 `NEXT_PUBLIC_BACKEND_URL`）
- 后端：Railway / Render / 自有服务器（需开放 WebSocket）
- Redis：Upstash Redis（Serverless，按请求计费）
- 数据库扩展：在 `backend/src/services/` 下增加 `postgres.ts`，实现历史优惠券持久化
- HTTPS 是 PWA 与 Web Push 的必要条件

---

## 开发脚本

| 目录 | 命令 | 说明 |
|------|------|------|
| backend | `npm run dev` | ts-node-dev 热重载 |
| backend | `npm run build` | 编译到 dist/ |
| backend | `npm start` | 运行编译产物 |
| frontend | `npm run dev` | Next.js 开发模式 |
| frontend | `npm run build` | 生产构建 |
| frontend | `npm start` | 运行生产构建 |
