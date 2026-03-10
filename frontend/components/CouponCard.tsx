'use client';

import { useEffect, useState } from 'react';
import { Coupon } from '@/lib/types';

interface CouponCardProps {
  coupon: Coupon;
  isNew?: boolean;
}

function formatCountdown(ms: number): { text: string; urgent: boolean } {
  if (ms <= 0) return { text: '已过期', urgent: true };

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return {
      text: `${hours}小时${mins > 0 ? mins + '分钟' : ''}`,
      urgent: false,
    };
  }

  const urgent = minutes < 5;
  return {
    text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    urgent,
  };
}

export default function CouponCard({ coupon, isNew = false }: CouponCardProps) {
  const [remaining, setRemaining] = useState<number>(
    coupon.expiresAt - Date.now()
  );
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  useEffect(() => {
    if (remaining <= 0) return;

    const interval = setInterval(() => {
      const diff = coupon.expiresAt - Date.now();
      setRemaining(diff);
      if (diff <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [coupon.expiresAt, remaining]);

  const countdown = formatCountdown(remaining);
  const isExpired = remaining <= 0;
  const quotaPercent = Math.min(
    100,
    Math.round((coupon.usedCount / coupon.totalQuota) * 100)
  );
  const isSoldOut = coupon.usedCount >= coupon.totalQuota;

  async function handleClaim() {
    if (claimed || isSoldOut || isExpired || claiming) return;
    setClaiming(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coupons/${coupon.id}/use`, {
        method: 'POST',
      });
      if (res.ok) {
        setClaimed(true);
      } else {
        const data = await res.json();
        alert(data.error || '领取失败，请重试');
      }
    } catch {
      alert('网络错误，请重试');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div
      className={[
        'rounded-2xl shadow-md border overflow-hidden transition-all duration-500',
        isNew ? 'ring-2 ring-orange-400 animate-pulse-fast' : '',
        isExpired ? 'opacity-50 grayscale' : 'bg-white',
      ].join(' ')}
    >
      {/* 顶部色块 */}
      <div
        className={[
          'px-4 py-3 flex items-center justify-between',
          isExpired ? 'bg-gray-400' : 'bg-gradient-to-r from-orange-500 to-red-500',
        ].join(' ')}
      >
        <div>
          <p className="text-white font-bold text-lg leading-tight">
            {coupon.shopName}
          </p>
          <p className="text-orange-100 text-sm">{coupon.item}</p>
        </div>
        <div className="text-right">
          <p className="text-white text-3xl font-black">{coupon.discount}</p>
          <p className="text-orange-100 text-xs">折扣</p>
        </div>
      </div>

      {/* 主体 */}
      <div className="px-4 py-3 space-y-3">
        {coupon.description && (
          <p className="text-gray-600 text-sm">{coupon.description}</p>
        )}

        {/* 倒计时 */}
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">剩余时间</span>
          <span
            className={[
              'font-mono font-bold text-base tabular-nums',
              isExpired
                ? 'text-gray-400'
                : countdown.urgent
                ? 'text-red-500 animate-pulse'
                : 'text-orange-500',
            ].join(' ')}
          >
            {countdown.text}
          </span>
        </div>

        {/* 使用进度 */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>已领取 {coupon.usedCount} / {coupon.totalQuota}</span>
            <span>{quotaPercent}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={[
                'h-2 rounded-full transition-all duration-300',
                quotaPercent >= 80 ? 'bg-red-400' : 'bg-orange-400',
              ].join(' ')}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>

        {/* 领取按钮 */}
        <button
          onClick={handleClaim}
          disabled={isExpired || isSoldOut || claimed || claiming}
          className={[
            'w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200',
            claimed
              ? 'bg-green-500 text-white cursor-default'
              : isSoldOut || isExpired
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : claiming
              ? 'bg-orange-300 text-white cursor-wait'
              : 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white shadow-sm',
          ].join(' ')}
        >
          {claimed
            ? '✓ 已领取，出示给店员'
            : isSoldOut
            ? '已抢完'
            : isExpired
            ? '已过期'
            : claiming
            ? '领取中...'
            : '立即领取'}
        </button>

        {/* 地理信息 */}
        <p className="text-xs text-gray-400 text-center">
          有效范围 {coupon.radiusKm} km · 坐标 ({coupon.location.lat.toFixed(4)},{' '}
          {coupon.location.lng.toFixed(4)})
        </p>
      </div>

      {/* NEW 标签 */}
      {isNew && !isExpired && (
        <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full shadow">
          NEW
        </div>
      )}
    </div>
  );
}
