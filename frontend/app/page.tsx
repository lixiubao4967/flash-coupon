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
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-brand-lg">
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
                connected ? 'bg-green-400' : 'bg-gray-300',
              ].join(' ')}
            />
          </span>
          <span className="text-sm text-gray-500">
            {connected ? '实时连接中' : '连接断开'}
          </span>
        </div>

        {!pushEnabled ? (
          <button
            onClick={handleEnablePush}
            className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold px-3 py-1.5 rounded-full border border-orange-200 transition-all"
          >
            🔔 开启推送
          </button>
        ) : (
          <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            推送已开启
          </span>
        )}
      </div>

      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-black text-gradient-brand">附近限时优惠</h1>
        <p className="text-sm text-gray-400 mt-1">
          实时发现周边商家发布的短时效优惠券
          {activeCoupons.length > 0 && (
            <span className="ml-1.5 text-orange-500 font-semibold">{activeCoupons.length} 张可用</span>
          )}
        </p>
      </div>

      {/* 分类筛选 */}
      {allCategories.length > 0 && (
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('')}
              className={[
                'shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
                !selectedCategory
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-500',
              ].join(' ')}
            >
              全分类
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                className={[
                  'shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
                  selectedCategory === cat
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-500',
                ].join(' ')}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 地区筛选 */}
      {allAreas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedArea('')}
            className={[
              'shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
              !selectedArea
                ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-500',
            ].join(' ')}
          >
            全地区
          </button>
          {allAreas.map((area) => (
            <button
              key={area}
              onClick={() => setSelectedArea(area === selectedArea ? '' : area)}
              className={[
                'shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
                selectedArea === area
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-500',
              ].join(' ')}
            >
              {area}
            </button>
          ))}
        </div>
      )}

      {/* 内容区域 */}
      {loading && (
        <div className="space-y-4 pt-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border bg-white shadow-card overflow-hidden animate-pulse">
              <div className="h-24 bg-gradient-to-br from-orange-100 to-red-100" />
              <div className="p-4 space-y-3">
                <div className="h-3 bg-gray-100 rounded-full w-3/4" />
                <div className="h-2 bg-gray-100 rounded-full" />
                <div className="h-10 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center animate-fade-in">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button
            onClick={fetchCoupons}
            className="mt-3 text-xs text-red-500 hover:text-red-700 underline font-medium"
          >
            重新加载
          </button>
        </div>
      )}

      {!loading && !error && activeCoupons.length === 0 && (
        <div className="text-center py-20 animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce">🍜</div>
          <p className="text-gray-500 text-base font-medium">暂无活跃优惠券</p>
          <p className="text-gray-300 text-sm mt-1.5">
            商家发布优惠后将实时出现在这里
          </p>
          <div className="flex justify-center gap-3 mt-5">
            <a
              href="/voice"
              className="inline-flex items-center gap-1.5 text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold px-4 py-2 rounded-full shadow-brand hover:shadow-brand-lg transition-all active:scale-95"
            >
              🎤 语音发布
            </a>
            <a
              href="/merchant"
              className="inline-flex items-center gap-1.5 text-sm bg-white text-orange-600 font-semibold px-4 py-2 rounded-full border border-orange-200 hover:border-orange-400 transition-all"
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
