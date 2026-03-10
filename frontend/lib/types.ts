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
}
