'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import CouponCard from '@/components/CouponCard';
import { Coupon } from '@/lib/types';
import { getSocket } from '@/lib/socket';
import { subscribeToPushNotifications } from '@/lib/webpush';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default function HomePage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [showNewToast, setShowNewToast] = useState(false);

  const fetchCoupons = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/coupons`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Coupon[] = await res.json();
      setCoupons(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const addNewCoupon = useCallback((coupon: Coupon) => {
    setCoupons((prev) => {
      const exists = prev.some((c) => c.id === coupon.id);
      if (exists) return prev;
      return [coupon, ...prev];
    });
    setNewIds((prev) => new Set(prev).add(coupon.id));
    setShowNewToast(true);
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(coupon.id);
        return next;
      });
    }, 8000);
    setTimeout(() => setShowNewToast(false), 4000);
  }, []);

  const handleCouponUsed = useCallback(
    ({ id, usedCount }: { id: string; usedCount: number }) => {
      setCoupons((prev) =>
        prev.map((c) => (c.id === id ? { ...c, usedCount } : c))
      );
    },
    []
  );

  useEffect(() => {
    fetchCoupons();

    const socket = getSocket();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('new-coupon', addNewCoupon);
    socket.on('coupon-used', handleCouponUsed);

    setConnected(socket.connected);

    return () => {
      socket.off('new-coupon', addNewCoupon);
      socket.off('coupon-used', handleCouponUsed);
    };
  }, [fetchCoupons, addNewCoupon, handleCouponUsed]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCoupons((prev) => prev.filter((c) => c.expiresAt > now));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function handleEnablePush() {
    const ok = await subscribeToPushNotifications();
    setPushEnabled(ok);
    if (!ok) {
      alert('无法开启推送通知。请确认浏览器权限，或检查 VAPID 配置。');
    }
  }

  const allCategories = useMemo(
    () => [...new Set(coupons.map((c) => c.category).filter(Boolean) as string[])].sort(),
    [coupons]
  );
  const allAreas = useMemo(
    () => [...new Set(coupons.map((c) => c.area).filter(Boolean) as string[])].sort(),
    [coupons]
  );

  const activeCoupons = coupons.filter((c) => {
    if (c.expiresAt <= Date.now()) return false;
    if (selectedCategory && c.category !== selectedCategory) return false;
    if (selectedArea && c.area !== selectedArea) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* 新优惠到达 Toast */}
      {showNewToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-brand">
            <span className="animate-pulse-fast">⚡</span>
            有新优惠券到了！
          </div>
        </div>
      )}

      {/* 状态栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {connected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={[
                'relative inline-flex rounded-full h-2.5 w-2.5',
                connected ? 'bg-green-400' : 'bg-slate-600',
              ].join(' ')}
            />
          </span>
          <span className="text-sm text-slate-400">
            {connected ? '实时连接中' : '连接断开'}
          </span>
        </div>

        {!pushEnabled ? (
          <button
            onClick={handleEnablePush}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-orange-400 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-orange-500/40 transition-all"
          >
            🔔 开启推送
          </button>
        ) : (
          <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            推送已开启
          </span>
        )}
      </div>

      {/* 位置 + 标题区域 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-sm text-slate-400 font-medium">
              <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {selectedArea || '全地区'}
            </span>
            <button
              onClick={fetchCoupons}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="刷新"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <h1 className="text-2xl font-black text-white">附近限时优惠</h1>
          <p className="text-sm text-slate-500 mt-1">
            实时发现周边商家发布的短时效优惠券
            {activeCoupons.length > 0 && (
              <span className="ml-1.5 text-orange-400 font-semibold">{activeCoupons.length} 张可用</span>
            )}
          </p>
        </div>
      </div>

      {/* 分类筛选 */}
      {allCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('')}
            className={[
              'shrink-0 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all',
              !selectedCategory
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-orange-500/50 hover:text-orange-400',
            ].join(' ')}
          >
            全分类
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
              className={[
                'shrink-0 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all',
                selectedCategory === cat
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-orange-500/50 hover:text-orange-400',
              ].join(' ')}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 地区筛选 */}
      {allAreas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedArea('')}
            className={[
              'shrink-0 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all',
              !selectedArea
                ? 'bg-violet-500 text-white border-violet-500'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-violet-500/50 hover:text-violet-400',
            ].join(' ')}
          >
            全地区
          </button>
          {allAreas.map((area) => (
            <button
              key={area}
              onClick={() => setSelectedArea(area === selectedArea ? '' : area)}
              className={[
                'shrink-0 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all',
                selectedArea === area
                  ? 'bg-violet-500 text-white border-violet-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-violet-500/50 hover:text-violet-400',
              ].join(' ')}
            >
              {area}
            </button>
          ))}
        </div>
      )}

      {/* 内容区域 */}
      {loading && (
        <div className="space-y-3 pt-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-slate-800 overflow-hidden animate-pulse">
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-slate-700 rounded-full" />
                  <div className="h-5 w-12 bg-slate-700 rounded-full" />
                </div>
                <div className="flex gap-3 items-center">
                  <div className="w-16 h-16 bg-slate-700 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-700 rounded w-2/3" />
                    <div className="h-3 bg-slate-700 rounded w-1/2" />
                    <div className="h-6 bg-slate-700 rounded w-1/4" />
                  </div>
                </div>
                <div className="h-1 bg-slate-700 rounded-full" />
              </div>
              <div className="h-11 bg-slate-700" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-2xl p-5 text-center animate-fade-in">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-red-400 text-sm font-medium">{error}</p>
          <button
            onClick={fetchCoupons}
            className="mt-3 text-xs text-red-400 hover:text-red-300 underline font-medium"
          >
            重新加载
          </button>
        </div>
      )}

      {!loading && !error && activeCoupons.length === 0 && (
        <div className="text-center py-20 animate-fade-in">
          <div className="mx-auto w-16 h-16 mb-5 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700">
            <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
            </svg>
          </div>
          <p className="text-white text-base font-semibold">附近暂无优惠</p>
          <p className="text-slate-500 text-sm mt-1.5">
            商家发布后将实时出现在这里
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <a
              href="/voice"
              className="inline-flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg transition-all active:scale-95"
            >
              🎤 语音发布
            </a>
            <a
              href="/merchant"
              className="inline-flex items-center gap-1.5 text-sm bg-slate-800 text-slate-300 font-semibold px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 hover:text-white transition-all"
            >
              商家发布
            </a>
          </div>
        </div>
      )}

      {!loading && activeCoupons.length > 0 && (
        <div className="space-y-4">
          {activeCoupons.map((coupon) => (
            <div key={coupon.id}>
              <CouponCard coupon={coupon} isNew={newIds.has(coupon.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
