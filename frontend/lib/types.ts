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

export type MerchantPlan = 'free' | 'pro';

export interface MerchantSession {
  shopId: string;
  email: string;
  apiKey: string;
  plan: MerchantPlan;
  monthlyCount: number;
  monthlyLimit: number | null; // null = unlimited (Pro)
}

export interface PublishCouponPayload {
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
