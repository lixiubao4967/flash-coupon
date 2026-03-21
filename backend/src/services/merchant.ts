import { promisify } from 'util';
import { scrypt, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from './redis';

const scryptAsync = promisify(scrypt);

export type Plan = 'free' | 'pro';

export interface MerchantRecord {
  shopId: string;
  email: string;
  passwordHash: string;
  apiKey: string;
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: number;
}

export interface MerchantPublic {
  shopId: string;
  email: string;
  apiKey: string;
  plan: Plan;
  monthlyCount: number;
  monthlyLimit: number | null; // null = unlimited
}

const FREE_MONTHLY_LIMIT = 3;

// ─── Key helpers ───────────────────────────────────────────────────────────────
function merchantKey(shopId: string) { return `merchant:${shopId}`; }
function apiKeyIndex(apiKey: string) { return `merchant:apikey:${apiKey}`; }
function emailIndex(email: string) { return `merchant:email:${email.toLowerCase()}`; }
function stripeIndex(customerId: string) { return `merchant:stripe:${customerId}`; }
function monthlyKey(shopId: string) {
  const d = new Date();
  return `merchant:monthly:${shopId}:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ─── Password helpers ──────────────────────────────────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, hashed] = hash.split(':');
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return derived.toString('hex') === hashed;
}

// ─── Register ─────────────────────────────────────────────────────────────────
export async function registerMerchant(
  email: string,
  password: string,
  shopName: string
): Promise<MerchantPublic> {
  const client = getRedisClient();
  const normalizedEmail = email.toLowerCase();

  // Check email uniqueness
  const existing = await client.get(emailIndex(normalizedEmail));
  if (existing) {
    throw new Error('この메일アドレスはすでに登録されています');
  }

  const shopId = `shop-${uuidv4().slice(0, 8)}`;
  const apiKey = `ak_${randomBytes(24).toString('hex')}`;
  const passwordHash = await hashPassword(password);

  const record: MerchantRecord = {
    shopId,
    email: normalizedEmail,
    passwordHash,
    apiKey,
    plan: 'free',
    createdAt: Date.now(),
  };

  const pipeline = client.pipeline();
  pipeline.set(merchantKey(shopId), JSON.stringify(record));
  pipeline.set(apiKeyIndex(apiKey), shopId);
  pipeline.set(emailIndex(normalizedEmail), shopId);
  await pipeline.exec();

  return {
    shopId,
    email: normalizedEmail,
    apiKey,
    plan: 'free',
    monthlyCount: 0,
    monthlyLimit: FREE_MONTHLY_LIMIT,
  };
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function loginMerchant(
  email: string,
  password: string
): Promise<MerchantPublic> {
  const client = getRedisClient();
  const normalizedEmail = email.toLowerCase();

  const shopId = await client.get(emailIndex(normalizedEmail));
  if (!shopId) throw new Error('メールアドレスまたはパスワードが正しくありません');

  const raw = await client.get(merchantKey(shopId));
  if (!raw) throw new Error('メールアドレスまたはパスワードが正しくありません');

  const record = JSON.parse(raw) as MerchantRecord;
  const valid = await verifyPassword(password, record.passwordHash);
  if (!valid) throw new Error('メールアドレスまたはパスワードが正しくありません');

  const monthlyCount = await getMonthlyCount(shopId);
  return {
    shopId: record.shopId,
    email: record.email,
    apiKey: record.apiKey,
    plan: record.plan,
    monthlyCount,
    monthlyLimit: record.plan === 'pro' ? null : FREE_MONTHLY_LIMIT,
  };
}

// ─── Lookup by API Key ────────────────────────────────────────────────────────
export async function getMerchantByApiKey(apiKey: string): Promise<MerchantRecord | null> {
  const client = getRedisClient();
  const shopId = await client.get(apiKeyIndex(apiKey));
  if (!shopId) return null;
  const raw = await client.get(merchantKey(shopId));
  if (!raw) return null;
  return JSON.parse(raw) as MerchantRecord;
}

// ─── Lookup by Stripe Customer ID ─────────────────────────────────────────────
export async function getMerchantByStripeCustomerId(customerId: string): Promise<MerchantRecord | null> {
  const client = getRedisClient();
  const shopId = await client.get(stripeIndex(customerId));
  if (!shopId) return null;
  const raw = await client.get(merchantKey(shopId));
  if (!raw) return null;
  return JSON.parse(raw) as MerchantRecord;
}

// ─── Monthly quota ────────────────────────────────────────────────────────────
export async function getMonthlyCount(shopId: string): Promise<number> {
  const client = getRedisClient();
  const val = await client.get(monthlyKey(shopId));
  return val ? parseInt(val, 10) : 0;
}

export async function incrementMonthlyCount(shopId: string): Promise<number> {
  const client = getRedisClient();
  const key = monthlyKey(shopId);
  const count = await client.incr(key);
  if (count === 1) {
    // New key: set TTL to 35 days so it expires well after the month ends
    await client.expire(key, 60 * 60 * 24 * 35);
  }
  return count;
}

export async function checkQuota(shopId: string, plan: Plan): Promise<{ allowed: boolean; count: number; limit: number | null }> {
  if (plan === 'pro') {
    const count = await getMonthlyCount(shopId);
    return { allowed: true, count, limit: null };
  }
  const count = await getMonthlyCount(shopId);
  return {
    allowed: count < FREE_MONTHLY_LIMIT,
    count,
    limit: FREE_MONTHLY_LIMIT,
  };
}

// ─── Update plan (called from Stripe webhook) ─────────────────────────────────
export async function updateMerchantPlan(
  shopId: string,
  plan: Plan,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<void> {
  const client = getRedisClient();
  const raw = await client.get(merchantKey(shopId));
  if (!raw) throw new Error(`Merchant ${shopId} not found`);

  const record = JSON.parse(raw) as MerchantRecord;
  record.plan = plan;
  if (stripeCustomerId) {
    record.stripeCustomerId = stripeCustomerId;
    await client.set(stripeIndex(stripeCustomerId), shopId);
  }
  if (stripeSubscriptionId !== undefined) {
    record.stripeSubscriptionId = stripeSubscriptionId;
  }
  await client.set(merchantKey(shopId), JSON.stringify(record));
}

// ─── Get merchant profile ──────────────────────────────────────────────────────
export async function getMerchantProfile(shopId: string): Promise<MerchantPublic | null> {
  const client = getRedisClient();
  const raw = await client.get(merchantKey(shopId));
  if (!raw) return null;
  const record = JSON.parse(raw) as MerchantRecord;
  const monthlyCount = await getMonthlyCount(shopId);
  return {
    shopId: record.shopId,
    email: record.email,
    apiKey: record.apiKey,
    plan: record.plan,
    monthlyCount,
    monthlyLimit: record.plan === 'pro' ? null : FREE_MONTHLY_LIMIT,
  };
}
