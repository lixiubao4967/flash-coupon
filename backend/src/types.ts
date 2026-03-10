export type CouponSource = 'manual' | 'hotpepper' | 'social';

export interface Coupon {
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
  source: CouponSource;    // 数据来源
  category: string;        // 分类，如 "ラーメン"、"居酒屋"
  area: string;            // 地区，如 "渋谷"、"新宿"
  originalUrl?: string;    // 外部原文链接（Hot Pepper / X 帖子）
}

export interface PublishCouponBody {
  shopId: string;
  shopName: string;
  item: string;
  discount: string;
  description: string;
  durationMinutes: number;
  location: { lat: number; lng: number };
  radiusKm: number;
  totalQuota: number;
  category?: string;
  area?: string;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
}
