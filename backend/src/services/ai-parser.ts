import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface VoiceParsedCoupon {
  shopName: string;
  item: string;
  discount: string;
  description: string;
  durationMinutes: number;
  totalQuota: number;
  category: string;
  area: string;
}

export async function parseVoiceTranscript(
  transcript: string
): Promise<VoiceParsedCoupon> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Extract coupon information from this voice transcript. Return ONLY valid JSON, no markdown, no explanation.

Transcript: "${transcript}"

Return JSON with exactly these fields:
- shopName: store or person name (string, infer if unclear)
- item: what is discounted (string)
- discount: discount amount e.g. "50%", "半額", "买一送一", "500円引き" (string)
- description: any extra details (string, empty if none)
- durationMinutes: validity in minutes (number, default 60 if not mentioned)
- totalQuota: max number of uses (number, default 30 if not mentioned)
- category: business type e.g. "拉面", "居酒屋", "カフェ", "咖啡" (string)
- area: location if mentioned (string, empty if not mentioned)

JSON only.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  // Strip any accidental markdown fences
  const raw = content.text.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(raw) as VoiceParsedCoupon;

  // Ensure required fields have fallbacks
  return {
    shopName: parsed.shopName || '未知商家',
    item: parsed.item || '限时优惠',
    discount: parsed.discount || '特惠',
    description: parsed.description || '',
    durationMinutes: Number(parsed.durationMinutes) || 60,
    totalQuota: Number(parsed.totalQuota) || 30,
    category: parsed.category || '',
    area: parsed.area || '',
  };
}
