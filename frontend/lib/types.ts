export type CouponSource = 'manual' | 'hotpepper' | 'social';

export interface Coupon {
  id: string;
  shopId: string;
  shopName: string;
  item: string;
  discount: string;
  description: string;
  publishedAt: number;
  expiresAt: number;
  durationMinutes: number;
  location: { lat: number; lng: number };
  radiusKm: number;
  totalQuota: number;
  usedCount: number;
  source?: CouponSource;
  category?: string;
  area?: string;
  originalUrl?: string;
}

export interface PublishCouponPayload {
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
