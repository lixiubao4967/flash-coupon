'use client';

import { useState, useEffect } from 'react';
import PublishForm from '@/components/PublishForm';
import CouponCard from '@/components/CouponCard';
import { Coupon, MerchantSession } from '@/lib/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
const SESSION_KEY = 'flash_merchant_session';

function loadSession(): MerchantSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as MerchantSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: MerchantSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Auth Form ────────────────────────────────────────────────────────────────
function AuthPanel({ onLogin }: { onLogin: (session: MerchantSession) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = mode === 'login' ? '/api/merchants/login' : '/api/merchants/register';
    const body = mode === 'login'
      ? { email, password }
      : { email, password, shopName };

    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      saveSession(data as MerchantSession);
      onLogin(data as MerchantSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition bg-white hover:border-gray-300';

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-black text-gray-800">
          {mode === 'login' ? '商家登录' : '注册商家账号'}
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          {mode === 'login' ? '登录后可发布优惠券' : '免费版每月可发 3 张券，Pro 版无限制'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'register' && (
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="店铺名称"
            required
            className={inputClass}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          required
          className={inputClass}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'register' ? '密码（至少 8 位）' : '密码'}
          required
          minLength={mode === 'register' ? 8 : undefined}
          className={inputClass}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-95 text-white shadow-brand transition-all disabled:opacity-60"
        >
          {loading ? '处理中…' : mode === 'login' ? '登录' : '注册'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        className="w-full text-xs text-gray-400 hover:text-orange-500 transition-colors"
      >
        {mode === 'login' ? '还没有账号？立即注册' : '已有账号？去登录'}
      </button>
    </div>
  );
}

// ─── Plan Status Bar ──────────────────────────────────────────────────────────
function PlanBar({
  session,
  onUpgrade,
  onManage,
  onRefresh,
}: {
  session: MerchantSession;
  onUpgrade: () => void;
  onManage: () => void;
  onRefresh: () => void;
}) {
  const isPro = session.plan === 'pro';
  const used = session.monthlyCount;
  const limit = session.monthlyLimit;
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nearLimit = limit ? used >= limit - 1 : false;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${isPro ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPro ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {isPro ? 'PRO' : 'FREE'}
          </span>
          <span className="text-xs text-gray-500">{session.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            更新
          </button>
          {isPro ? (
            <button
              onClick={onManage}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
            >
              管理订阅
            </button>
          ) : (
            <button
              onClick={onUpgrade}
              className="text-xs bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1 rounded-full font-bold hover:opacity-90 transition-opacity"
            >
              升级 Pro ¥980/月
            </button>
          )}
        </div>
      </div>

      {!isPro && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>本月已发：{used} / {limit} 张</span>
            {nearLimit && <span className="text-orange-500 font-medium">即将达到上限</span>}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${percent >= 100 ? 'bg-red-500' : percent >= 67 ? 'bg-orange-400' : 'bg-green-400'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
      {isPro && (
        <p className="text-xs text-amber-600">Pro 套餐：无限发券</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MerchantPage() {
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [recentPublished, setRecentPublished] = useState<Coupon[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    setSession(loadSession());

    // Handle return from Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      // Refresh session from server
      const saved = loadSession();
      if (saved) {
        refreshSession(saved.apiKey);
      }
      // Clean URL
      window.history.replaceState({}, '', '/merchant');
    }
  }, []);

  async function refreshSession(apiKey: string) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/merchants/me`, {
        headers: { 'X-API-Key': apiKey },
      });
      if (res.ok) {
        const data = await res.json() as MerchantSession;
        // Preserve apiKey since /me doesn't return it
        const updated = { ...data, apiKey };
        saveSession(updated);
        setSession(updated);
      }
    } catch {
      // ignore refresh errors
    }
  }

  function handleLogin(s: MerchantSession) {
    setSession(s);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setRecentPublished([]);
  }

  function handlePublished(coupon: Coupon) {
    setRecentPublished((prev) => [coupon, ...prev.slice(0, 4)]);
    // Refresh quota
    if (session) refreshSession(session.apiKey);
  }

  async function handleUpgrade() {
    if (!session) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/merchants/checkout`, {
        method: 'POST',
        headers: { 'X-API-Key': session.apiKey },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Checkout 失败');
      setCheckoutLoading(false);
    }
  }

  async function handleManage() {
    if (!session) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/merchants/portal`, {
        method: 'POST',
        headers: { 'X-API-Key': session.apiKey },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Portal 打开失败');
    }
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">商家发布优惠券</h1>
          <p className="text-sm text-gray-400 mt-1">
            发布后立即通过 WebSocket 实时推送给附近所有消费者
          </p>
        </div>
        {session && (
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            退出
          </button>
        )}
      </div>

      {!session ? (
        <AuthPanel onLogin={handleLogin} />
      ) : (
        <>
          {/* 套餐状态栏 */}
          <PlanBar
            session={session}
            onUpgrade={handleUpgrade}
            onManage={handleManage}
            onRefresh={() => refreshSession(session.apiKey)}
          />

          {checkoutLoading && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700 text-center">
              正在跳转到付款页…
            </div>
          )}

          {/* 发布表单 */}
          <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-5 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs flex items-center justify-center">✎</span>
              填写优惠券信息
            </h2>
            <PublishForm
              onPublished={handlePublished}
              apiKey={session.apiKey}
              shopId={session.shopId}
            />
          </div>

          {/* 使用说明 */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-orange-700 flex items-center gap-1.5">
              <span>💡</span> 使用说明
            </h3>
            <ul className="text-xs text-orange-600/90 space-y-1.5 list-none">
              {[
                '优惠券发布后立即向所有在线消费者实时广播',
                '支持 Web Push 通知，即使未开启 App 也能收到提醒',
                'Redis TTL 自动过期，无需手动下架',
                '名额用完后消费者端自动显示「已抢完」',
                '免费版每月 3 张，Pro 版（¥980/月）无限制',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-orange-400">▸</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* 本次发布的优惠券预览 */}
          {recentPublished.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs flex items-center justify-center">✓</span>
                本次发布预览
              </h2>
              {recentPublished.map((coupon) => (
                <CouponCard key={coupon.id} coupon={coupon} isNew />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
