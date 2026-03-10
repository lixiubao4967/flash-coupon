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
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
}
