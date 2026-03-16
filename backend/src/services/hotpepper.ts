import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Coupon } from '../types';
import { saveCoupon, getActiveCoupons } from './redis';

const HOTPEPPER_BASE = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';
const DURATION_MINUTES = 120;

interface HotPepperShop {
  id: string;
  name: string;
  genre: { name: string; catch: string };
  sub_genre?: { name: string };
  address: string;
  lat: string;
  lng: string;
  budget: { average: string };
  coupon_urls?: { pc: string; sp: string };
  large_area: { name: string };
  middle_area?: { name: string };
}

interface HotPepperResponse {
  results: {
    shop?: HotPepperShop[];
    error?: Array<{ message: string }>;
  };
}

export async function fetchHotPepperCoupons(): Promise<void> {
  const apiKey = process.env.HOTPEPPER_API_KEY;
  if (!apiKey) {
    console.warn('[HotPepper] HOTPEPPER_API_KEY not set, skipping fetch');
    return;
  }

  try {
    const response = await axios.get<HotPepperResponse>(HOTPEPPER_BASE, {
      params: {
        key: apiKey,
        format: 'json',
        count: 100,
        coupon: 1,
        large_area: 'Z011', // Tokyo area — HotPepper requires an area filter
      },
      timeout: 10_000,
    });

    const shops = response.data.results.shop ?? [];
    if (shops.length === 0) {
      console.log('[HotPepper] No coupon-bearing restaurants returned');
      return;
    }

    const existing = await getActiveCoupons();
    const existingShopIds = new Set(existing.map((c) => c.shopId));

    const now = Date.now();
    let inserted = 0;

    for (const shop of shops) {
      if (!shop.coupon_urls?.sp && !shop.coupon_urls?.pc) continue;

      const shopId = `hotpepper:${shop.id}`;
      if (existingShopIds.has(shopId)) continue;

      const lat = parseFloat(shop.lat);
      const lng = parseFloat(shop.lng);

      const coupon: Coupon = {
        id: uuidv4(),
        shopId,
        shopName: shop.name,
        item: shop.genre.catch || shop.genre.name,
        discount: shop.budget.average || 'クーポンあり',
        description: `${shop.genre.name} — ${shop.address}`,
        publishedAt: now,
        expiresAt: now + DURATION_MINUTES * 60 * 1000,
        durationMinutes: DURATION_MINUTES,
        location: {
          lat: isNaN(lat) ? 35.6762 : lat,
          lng: isNaN(lng) ? 139.6503 : lng,
        },
        radiusKm: 1.0,
        totalQuota: 20,
        usedCount: 0,
        source: 'hotpepper',
        category: shop.genre.name,
        area: shop.middle_area?.name ?? shop.large_area.name,
        originalUrl: shop.coupon_urls?.sp || shop.coupon_urls?.pc,
      };

      await saveCoupon(coupon);
      inserted++;
    }

    console.log(`[HotPepper] Inserted ${inserted} new coupons from ${shops.length} shops`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[HotPepper] Fetch error:', message);
  }
}
