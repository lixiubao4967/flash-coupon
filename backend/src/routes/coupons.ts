import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import webpush from 'web-push';
import { Server as SocketServer } from 'socket.io';
import { Coupon, PublishCouponBody, WebPushSubscription } from '../types';
import { parseVoiceTranscript } from '../services/ai-parser';
import {
  saveCoupon,
  getActiveCoupons,
  getActiveCouponsByFilter,
  incrementUsedCount,
  saveSubscription,
  getAllSubscriptions,
} from '../services/redis';
import { requireAuth } from '../middleware/auth';
import { checkQuota, incrementMonthlyCount } from '../services/merchant';

export function createCouponRouter(io: SocketServer): Router {
  const router = Router();

  // ─── POST /api/coupons ─────────────────────────────────────────────────────
  // 商家发布优惠券（需要 X-API-Key 认证）
  router.post('/', requireAuth, async (req: Request, res: Response) => {
    const merchant = req.merchant!;
    const body = req.body as PublishCouponBody;

    // 检查月度配额
    const quota = await checkQuota(merchant.shopId, merchant.plan);
    if (!quota.allowed) {
      res.status(403).json({
        error: `月度发券上限已达到（免费版每月 ${quota.limit} 张）。请升级到 Pro 套餐。`,
        code: 'QUOTA_EXCEEDED',
        count: quota.count,
        limit: quota.limit,
      });
      return;
    }

    // 基础参数校验
    const required: (keyof PublishCouponBody)[] = [
      'shopName', 'item', 'discount', 'description',
      'durationMinutes', 'location', 'radiusKm', 'totalQuota',
    ];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        res.status(400).json({ error: `Missing required field: ${field}` });
        return;
      }
    }

    if (body.durationMinutes < 1 || body.durationMinutes > 1440) {
      res.status(400).json({ error: 'durationMinutes must be between 1 and 1440' });
      return;
    }

    const now = Date.now();
    const coupon: Coupon = {
      id: uuidv4(),
      shopId: merchant.shopId,
      shopName: body.shopName,
      item: body.item,
      discount: body.discount,
      description: body.description,
      publishedAt: now,
      expiresAt: now + body.durationMinutes * 60 * 1000,
      durationMinutes: body.durationMinutes,
      location: body.location,
      radiusKm: body.radiusKm,
      totalQuota: body.totalQuota,
      usedCount: 0,
      source: 'manual',
      category: body.category?.trim() || '',
      area: body.area?.trim() || '',
    };

    try {
      await saveCoupon(coupon);
      await incrementMonthlyCount(merchant.shopId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: `Failed to save coupon: ${message}` });
      return;
    }

    // 通过 Socket.io 广播给所有连接的消费者
    io.emit('new-coupon', coupon);

    // 通过 Web Push 通知所有订阅者
    sendWebPushNotification(coupon).catch((err) =>
      console.error('[WebPush] Broadcast error:', err)
    );

    res.status(201).json(coupon);
  });

  // ─── GET /api/coupons ──────────────────────────────────────────────────────
  // 获取活跃优惠券，支持 ?category= 和 ?area= 过滤
  router.get('/', async (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;
    const area = req.query.area as string | undefined;
    try {
      const coupons = category || area
        ? await getActiveCouponsByFilter(category, area)
        : await getActiveCoupons();
      res.json(coupons);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: `Failed to fetch coupons: ${message}` });
    }
  });

  // ─── POST /api/coupons/voice/parse ────────────────────────────────────────
  // 用 Claude AI 将语音转录文本解析为结构化优惠券字段
  router.post('/voice/parse', async (req: Request, res: Response) => {
    const { transcript } = req.body as { transcript?: string };
    if (!transcript?.trim()) {
      res.status(400).json({ error: 'Missing transcript' });
      return;
    }
    try {
      const parsed = await parseVoiceTranscript(transcript.trim());
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parse failed';
      res.status(500).json({ error: message });
    }
  });

  // ─── POST /api/coupons/:id/use ─────────────────────────────────────────────
  // 消费者核销优惠券（演示用，生产需加鉴权）
  router.post('/:id/use', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const usedCount = await incrementUsedCount(id);
      if (usedCount === null) {
        res.status(409).json({ error: 'Coupon not found, expired, or quota exhausted' });
        return;
      }
      // 广播使用数量更新
      io.emit('coupon-used', { id, usedCount });
      res.json({ success: true, usedCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  // ─── POST /api/push/subscribe ──────────────────────────────────────────────
  // 保存浏览器 Web Push 订阅
  router.post('/push/subscribe', async (req: Request, res: Response) => {
    const subscription = req.body as WebPushSubscription;
    if (!subscription?.endpoint) {
      res.status(400).json({ error: 'Invalid subscription object' });
      return;
    }
    try {
      await saveSubscription(subscription);
      res.status(201).json({ message: 'Subscribed successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  return router;
}

// ─── 辅助：发送 Web Push 通知 ──────────────────────────────────────────────
async function sendWebPushNotification(coupon: Coupon): Promise<void> {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@flash-coupon.app';

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[WebPush] VAPID keys not configured, skipping push notifications');
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const subscriptions = await getAllSubscriptions();
  const payload = JSON.stringify({
    title: `${coupon.shopName} 发布了新优惠！`,
    body: `${coupon.item} ${coupon.discount} 折扣，${coupon.durationMinutes} 分钟内有效`,
    icon: '/icons/icon-192x192.png',
    data: { couponId: coupon.id },
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(sub as webpush.PushSubscription, payload)
    )
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) {
    console.warn(`[WebPush] ${failed}/${subscriptions.length} notifications failed`);
  }
}
