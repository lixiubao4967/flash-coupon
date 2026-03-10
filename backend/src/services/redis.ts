import Redis from 'ioredis';
import { Coupon } from '../types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const COUPON_KEY_PREFIX = 'coupon:';
const COUPON_INDEX_KEY = 'coupons:active';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected to Redis at', REDIS_URL);
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }
  return redisClient;
}

/**
 * 将优惠券写入 Redis，并设置与过期时间同步的 TTL
 */
export async function saveCoupon(coupon: Coupon): Promise<void> {
  const client = getRedisClient();
  const key = `${COUPON_KEY_PREFIX}${coupon.id}`;
  const ttlSeconds = Math.ceil((coupon.expiresAt - Date.now()) / 1000);

  if (ttlSeconds <= 0) {
    throw new Error('Coupon is already expired');
  }

  const pipeline = client.pipeline();
  // 存储优惠券 JSON，设置 TTL
  pipeline.set(key, JSON.stringify(coupon), 'EX', ttlSeconds);
  // 维护活跃优惠券 ID 集合（score = expiresAt，方便按时间排序和清理）
  pipeline.zadd(COUPON_INDEX_KEY, coupon.expiresAt, coupon.id);
  await pipeline.exec();
}

/**
 * 获取活跃优惠券，支持按分类和地区过滤
 */
export async function getActiveCouponsByFilter(
  category?: string,
  area?: string
): Promise<Coupon[]> {
  const all = await getActiveCoupons();
  return all.filter((c) => {
    if (category && c.category !== category) return false;
    if (area && c.area !== area) return false;
    return true;
  });
}

/**
 * 获取所有活跃优惠券（未过期）
 */
export async function getActiveCoupons(): Promise<Coupon[]> {
  const client = getRedisClient();
  const now = Date.now();

  // 清理已过期的索引条目
  await client.zremrangebyscore(COUPON_INDEX_KEY, '-inf', now);

  // 获取当前有效的 ID 列表
  const ids = await client.zrangebyscore(COUPON_INDEX_KEY, now, '+inf');
  if (ids.length === 0) return [];

  const keys = ids.map((id) => `${COUPON_KEY_PREFIX}${id}`);
  const values = await client.mget(...keys);

  const coupons: Coupon[] = [];
  for (const val of values) {
    if (val) {
      try {
        coupons.push(JSON.parse(val) as Coupon);
      } catch {
        // 跳过损坏的数据
      }
    }
  }

  // 按发布时间倒序排列（最新的在前）
  return coupons.sort((a, b) => b.publishedAt - a.publishedAt);
}

/**
 * 将优惠券已使用数量加 1，并检查配额
 * 返回更新后的 usedCount，若超出配额则返回 null
 */
export async function incrementUsedCount(couponId: string): Promise<number | null> {
  const client = getRedisClient();
  const key = `${COUPON_KEY_PREFIX}${couponId}`;

  const raw = await client.get(key);
  if (!raw) return null;

  const coupon = JSON.parse(raw) as Coupon;
  if (coupon.usedCount >= coupon.totalQuota) return null;

  coupon.usedCount += 1;
  const ttl = await client.ttl(key);
  if (ttl > 0) {
    await client.set(key, JSON.stringify(coupon), 'EX', ttl);
  }
  return coupon.usedCount;
}

/**
 * 保存 Web Push 订阅
 */
export async function saveSubscription(subscription: object): Promise<void> {
  const client = getRedisClient();
  const key = `push:sub:${Date.now()}`;
  await client.set(key, JSON.stringify(subscription), 'EX', 60 * 60 * 24 * 30); // 30 天
  await client.sadd('push:subscriptions', key);
}

/**
 * 获取所有 Web Push 订阅
 */
export async function getAllSubscriptions(): Promise<object[]> {
  const client = getRedisClient();
  const keys = await client.smembers('push:subscriptions');
  if (keys.length === 0) return [];

  const values = await client.mget(...keys);
  const subs: object[] = [];
  for (const val of values) {
    if (val) {
      try {
        subs.push(JSON.parse(val));
      } catch {
        // 跳过
      }
    }
  }
  return subs;
}
