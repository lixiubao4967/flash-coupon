import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Coupon } from '../types';
import { saveCoupon, getActiveCoupons } from './redis';

const GROK_API_URL = 'https://api.x.ai/v1/responses';
const DURATION_MINUTES = 720; // 12 小时，匹配每天两次抓取频率

interface PayPayDeal {
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
  deals: PayPayDeal[];
}

// 東京23区 一次查全部，控制费用
const TOKYO_QUERY = '東京23区（千代田・中央・港・新宿・渋谷・豊島・台東・墨田・江東・品川・目黒・大田・世田谷・中野・杉並・北・荒川・板橋・練馬・足立・葛飾・江戸川・文京）';

export async function fetchPayPayCoupons(): Promise<void> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    console.warn('[PayPay] GROK_API_KEY not set, skipping fetch');
    return;
  }

  const existing = await getActiveCoupons();
  const existingUrls = new Set(
    existing.map((c) => c.originalUrl).filter(Boolean) as string[]
  );

  const prompt = `東京のPayPayクーポン・PayPay割引情報を検索してください。レストラン、カフェ、コンビニ、居酒屋など飲食店・小売店のPayPay関連お得情報を幅広く収集してください。

対象エリア：東京（新宿、渋谷、池袋、銀座、秋葉原、上野、浅草、品川、六本木、恵比寿、中目黒、吉祥寺など）

対象情報：
- PayPayクーポン（提示・利用で割引）
- PayPay加盟店の現在のキャンペーン・お得情報
- PayPay支払いでお得になる店舗情報

最低でも10件以上見つけてください。見つかった情報をJSON形式で返してください。

Return a JSON object with a "deals" array. Each deal:
- shopName (string, 店舗名)
- item (string, 対象商品・サービス、不明なら"全品")
- discount (string, 割引内容 e.g. "100円引き", "10%OFF", "PayPay利用可")
- description (string, 詳細・利用条件)
- area (string, エリア e.g. "新宿", "渋谷")
- category (string, e.g. ラーメン, カフェ, コンビニ, 居酒屋)
- originalUrl (string or null, ソースURL)
- lat (number or null)
- lng (number or null)

情報が見つからない場合のみ {"deals":[]} を返す。
IMPORTANT: Reply with ONLY the JSON object, no other text.`;

  console.log('[PayPay] Fetching PayPay coupons for 東京23区 via Grok...');

  let response;
  try {
    response = await axios.post(
      GROK_API_URL,
      {
        model: 'grok-4-latest',
        input: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search' }],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 180_000, // Grok web search takes time (up to 3 min)
      }
    );
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response) {
      console.error(
        `[PayPay] API error: HTTP ${err.response.status}`,
        JSON.stringify(err.response.data).slice(0, 300)
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PayPay] Request failed:', msg);
    }
    return;
  }

  // Parse Grok Responses API output
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
    console.warn('[PayPay] No text content in Grok response');
    return;
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[PayPay] Could not find JSON in response:', content.slice(0, 100));
    return;
  }

  let parsed: GrokParsedResponse;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn('[PayPay] Could not parse JSON:', jsonMatch[0].slice(0, 100));
    return;
  }

  if (!Array.isArray(parsed.deals)) return;

  const now = Date.now();
  let inserted = 0;

  console.log(`[PayPay] Grok returned ${parsed.deals.length} deals`);

  for (const deal of parsed.deals) {
    if (!deal.shopName) continue;
    if (deal.originalUrl && existingUrls.has(deal.originalUrl)) continue;

    const lat = typeof deal.lat === 'number' ? deal.lat : 35.6762;
    const lng = typeof deal.lng === 'number' ? deal.lng : 139.6503;

    const coupon: Coupon = {
      id: uuidv4(),
      shopId: `paypay:${uuidv4()}`,
      shopName: deal.shopName,
      item: deal.item || 'PayPayクーポン対象',
      discount: deal.discount || 'PayPayクーポン',
      description: deal.description || '',
      publishedAt: now,
      expiresAt: now + DURATION_MINUTES * 60 * 1000,
      durationMinutes: DURATION_MINUTES,
      location: { lat, lng },
      radiusKm: 2.0,
      totalQuota: 50,
      usedCount: 0,
      source: 'paypay',
      category: deal.category || '飲食',
      area: deal.area || '東京',
      originalUrl: deal.originalUrl,
    };

    await saveCoupon(coupon);
    existingUrls.add(deal.originalUrl);
    inserted++;
  }

  console.log(`[PayPay] Inserted ${inserted} PayPay coupons for 東京23区`);
}
