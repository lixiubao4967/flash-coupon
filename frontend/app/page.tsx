'use client';

import { useEffect, useState, useCallback } from 'react';
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

  // 从后端加载现有活跃优惠券
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

  // 添加新优惠券并短暂高亮
  const addNewCoupon = useCallback((coupon: Coupon) => {
    setCoupons((prev) => {
      const exists = prev.some((c) => c.id === coupon.id);
      if (exists) return prev;
      return [coupon, ...prev];
    });
    setNewIds((prev) => new Set(prev).add(coupon.id));
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(coupon.id);
        return next;
      });
    }, 8000);
  }, []);

  // 处理 coupon-used 事件，更新 usedCount
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

    // 初始连接状态
    setConnected(socket.connected);

    return () => {
      socket.off('new-coupon', addNewCoupon);
      socket.off('coupon-used', handleCouponUsed);
    };
  }, [fetchCoupons, addNewCoupon, handleCouponUsed]);

  // 定时清理已过期的卡片（每 30 秒）
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

  const activeCoupons = coupons.filter((c) => c.expiresAt > Date.now());

  return (
    <div className="space-y-5">
      {/* 状态栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={[
              'w-2 h-2 rounded-full',
              connected ? 'bg-green-400 animate-pulse' : 'bg-gray-300',
            ].join(' ')}
          />
          <span className="text-sm text-gray-500">
            {connected ? '实时连接中' : '连接断开'}
          </span>
        </div>

        {!pushEnabled && (
          <button
            onClick={handleEnablePush}
            className="text-xs bg-orange-100 text-orange-600 font-medium px-3 py-1.5 rounded-full hover:bg-orange-200 transition"
          >
            🔔 开启推送通知
          </button>
        )}
        {pushEnabled && (
          <span className="text-xs text-green-600 font-medium">
            ✓ 推送已开启
          </span>
        )}
      </div>

      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">附近限时优惠</h1>
        <p className="text-sm text-gray-500 mt-1">
          实时发现周边商家发布的短时效优惠券
        </p>
      </div>

      {/* 内容区域 */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 mt-3 text-sm">加载中...</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={fetchCoupons}
            className="mt-2 text-xs text-red-500 underline"
          >
            重新加载
          </button>
        </div>
      )}

      {!loading && !error && activeCoupons.length === 0 && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🍜</p>
          <p className="text-gray-400 text-base">暂无活跃优惠券</p>
          <p className="text-gray-300 text-sm mt-1">
            商家发布优惠后将实时出现在这里
          </p>
          <a
            href="/merchant"
            className="inline-block mt-4 text-sm text-orange-500 hover:text-orange-600 font-medium underline"
          >
            我是商家，去发布优惠
          </a>
        </div>
      )}

      {!loading && activeCoupons.length > 0 && (
        <div className="space-y-4 relative">
          {newIds.size > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-sm text-orange-600 font-medium animate-pulse">
              ⚡ 有新优惠券！
            </div>
          )}
          {activeCoupons.map((coupon) => (
            <div key={coupon.id} className="relative">
              <CouponCard coupon={coupon} isNew={newIds.has(coupon.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
