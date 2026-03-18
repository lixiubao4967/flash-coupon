import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Coupon } from '../types';
import { saveCoupon, getActiveCoupons } from './redis';

// New Responses API endpoint (old /v1/chat/completions with search_parameters is deprecated, 410 Gone)
const GROK_API_URL = 'https://api.x.ai/v1/responses';
const DURATION_MINUTES = 90;
const DEFAULT_SEARCH_AREAS = ['虎ノ門ヒルズ'];

interface GrokDeal {
  shopName: string;
  item: string;
  discount: string;
  description: string;
  area: string;
  category: string;
  originalUrl: string;
  lat?: number | null;
  lng?: number | null;
}

interface GrokParsedResponse {
  deals: GrokDeal[];
}

export async function fetchGrokSocialCoupons(): Promise<void> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    console.warn('[Grok] GROK_API_KEY not set, skipping fetch');
    return;
  }

  const existing = await getActiveCoupons();
  const existingUrls = new Set(
    existing.map((c) => c.originalUrl).filter(Boolean) as string[]
  );

  const areas = (
    process.env.GROK_SEARCH_AREAS ?? DEFAULT_SEARCH_AREAS.join(',')
  ).split(',');

  for (const area of areas) {
    try {
      const prompt = `Search recent X (Twitter) posts and web pages for PayPay クーポン (PayPay coupon) information at restaurants or shops in ${area}, Japan.

IMPORTANT RULES:
- Only include PayPay クーポン (coupon). Do NOT include: PayPay 還元, キャッシュバック, セール, ポイント, or general discounts that are not coupons.
- A クーポン means a specific coupon that can be used at checkout (e.g. "PayPayクーポンで100円引き", "PayPayクーポン提示で10%OFF").
- Include ALL PayPay coupons regardless of discount amount — even small discounts like 50円引き or 5% off are valid.
- Do NOT filter by minimum discount percentage.

Return a JSON object with a "deals" array. Each deal must have:
- shopName (string, the restaurant or shop name)
- item (string, what food/drink or the coupon target)
- discount (string, the coupon value e.g. "100円引き" or "10%OFF")
- description (string, brief detail about how to use the PayPay coupon)
- area (string, neighborhood or city)
- category (string, cuisine type e.g. ラーメン, 居酒屋, カフェ)
- originalUrl (string, the X post URL or source page URL)
- lat (number or null)
- lng (number or null)

Return at most 10 deals. If no PayPay coupons found, return {"deals":[]}.
IMPORTANT: Reply with ONLY the JSON object, no other text.`;

      const response = await axios.post(
        GROK_API_URL,
        {
          model: 'grok-4-latest',
          input: [{ role: 'user', content: prompt }],
          tools: [
            {
              type: 'web_search',
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        }
      );

      // Extract text content from the Responses API output
      const output = response.data.output ?? [];
      let content = '';
      for (const block of output) {
        if (block.type === 'message') {
          for (const part of block.content ?? []) {
            if (part.type === 'output_text') {
              content += part.text;
            }
          }
        }
      }

      if (!content) {
        console.warn(`[Grok] No content in response for area ${area}`);
        continue;
      }

      // Try to extract JSON from the response (may be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(
          `[Grok] Could not find JSON for area ${area}:`,
          content.slice(0, 100)
        );
        continue;
      }

      let parsed: GrokParsedResponse;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.warn(
          `[Grok] Could not parse JSON for area ${area}:`,
          jsonMatch[0].slice(0, 100)
        );
        continue;
      }

      if (!Array.isArray(parsed.deals)) continue;

      const now = Date.now();
      let inserted = 0;

      for (const deal of parsed.deals) {
        if (!deal.shopName || !deal.originalUrl) continue;
        if (existingUrls.has(deal.originalUrl)) continue;

        const lat = deal.lat ?? null;
        const lng = deal.lng ?? null;

        const coupon: Coupon = {
          id: uuidv4(),
          shopId: `social:${uuidv4()}`,
          shopName: deal.shopName,
          item: deal.item || '限定メニュー',
          discount: deal.discount || 'PayPayクーポン',
          description: deal.description || '',
          publishedAt: now,
          expiresAt: now + DURATION_MINUTES * 60 * 1000,
          durationMinutes: DURATION_MINUTES,
          location: {
            lat: typeof lat === 'number' ? lat : 35.6762,
            lng: typeof lng === 'number' ? lng : 139.6503,
          },
          radiusKm: 2.0,
          totalQuota: 50,
          usedCount: 0,
          source: 'social',
          category: deal.category || '飲食',
          area: deal.area || area,
          originalUrl: deal.originalUrl,
        };

        await saveCoupon(coupon);
        existingUrls.add(deal.originalUrl);
        inserted++;
      }

      console.log(`[Grok] Area ${area}: inserted ${inserted} social coupons`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Grok] Error fetching for area ${area}:`, message);
    }
  }
}
