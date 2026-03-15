'use client';

import { useEffect, useState } from 'react';
import { Coupon, CouponSource } from '@/lib/types';

const SOURCE_CONFIG: Record<CouponSource, { label: string; bg: string; text: string; dot: string }> = {
  manual:    { label: '商家发布', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  hotpepper: { label: 'Hot Pepper', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
  social:    { label: '来自 X',    bg: 'bg-sky-100',  text: 'text-sky-700',  dot: 'bg-sky-400'  },
};

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
      text: `${hours}h ${mins > 0 ? mins + 'm' : ''}`,
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
  const [shareCopied, setShareCopied] = useState(false);

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

  async function handleShare() {
    const remaining = coupon.expiresAt - Date.now();
    const mins = Math.max(0, Math.floor(remaining / 60000));
    const text = `【限时优惠】${coupon.shopName}\n${coupon.item} ${coupon.discount}，还剩 ${mins} 分钟，限 ${coupon.totalQuota} 人！`;
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${coupon.shopName} 限时优惠`, text, url });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  }

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

  const sourceConf = coupon.source && SOURCE_CONFIG[coupon.source] ? SOURCE_CONFIG[coupon.source] : null;

  return (
    <div
      className={[
        'relative rounded-2xl border overflow-hidden card-lift',
        isNew
          ? 'ring-2 ring-orange-400 ring-offset-1 animate-slide-up shadow-brand'
          : 'shadow-card hover:shadow-card-hover',
        isExpired ? 'opacity-50 grayscale' : 'bg-white',
      ].join(' ')}
    >
      {/* NEW 标签 */}
      {isNew && !isExpired && (
        <div className="absolute top-3 right-3 z-10 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm animate-bounce-in">
          NEW
        </div>
      )}

      {/* 顶部渐变色块 */}
      <div
        className={[
          'px-4 pt-4 pb-5 relative overflow-hidden',
          isExpired
            ? 'bg-gray-400'
            : 'bg-gradient-to-br from-orange-500 via-orange-500 to-red-500',
        ].join(' ')}
      >
        {/* 背景装饰圆 */}
        {!isExpired && (
          <>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -right-2 top-8 w-16 h-16 rounded-full bg-white/5" />
          </>
        )}

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-white font-bold text-lg leading-tight drop-shadow-sm">
                {coupon.shopName}
              </p>
              {sourceConf && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${sourceConf.bg} ${sourceConf.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${sourceConf.dot}`} />
                  {sourceConf.label}
                </span>
              )}
            </div>
            <p className="text-orange-100 text-sm font-medium">{coupon.item}</p>
          </div>

          {/* 折扣大字 */}
          <div className="text-right shrink-0">
            <p className="text-white text-4xl font-black leading-none drop-shadow-sm">
              {coupon.discount}
            </p>
            <p className="text-orange-200 text-xs mt-0.5 font-medium">折扣</p>
          </div>
        </div>

        {/* 倒计时 + 名额摘要 — 悬浮在 header 底部 */}
        <div className="absolute -bottom-4 left-4 right-4 flex gap-2">
          <div
            className={[
              'flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-sm text-sm font-bold tabular-nums',
              isExpired
                ? 'text-gray-400'
                : countdown.urgent
                ? 'text-red-500 animate-pulse-fast'
                : 'text-orange-600',
            ].join(' ')}
          >
            <span className="text-xs">⏱</span>
            {countdown.text}
          </div>
          <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 shadow-sm text-sm text-gray-600 font-medium">
            <span className="text-xs">👥</span>
            {coupon.usedCount}/{coupon.totalQuota}
          </div>
          {coupon.area && (
            <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 shadow-sm text-xs text-gray-500 font-medium">
              📍 {coupon.area}
            </div>
          )}
        </div>
      </div>

      {/* 主体 — 留出 header 下沉区域的空间 */}
      <div className="px-4 pt-7 pb-4 space-y-3">
        {coupon.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{coupon.description}</p>
        )}

        {/* 使用进度条 */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">
              已领 <span className="font-semibold text-gray-600">{coupon.usedCount}</span> / {coupon.totalQuota}
            </span>
            <span className={quotaPercent >= 80 ? 'text-red-500 font-semibold' : 'text-gray-400'}>
              {quotaPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={[
                'h-2 rounded-full transition-all duration-500',
                quotaPercent >= 80
                  ? 'bg-gradient-to-r from-red-400 to-red-500'
                  : 'bg-gradient-to-r from-orange-400 to-orange-500',
              ].join(' ')}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>

        {/* 领取 + 分享 */}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={handleClaim}
            disabled={isExpired || isSoldOut || claimed || claiming}
            className={[
              'flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200',
              claimed
                ? 'bg-green-500 text-white cursor-default shadow-sm'
                : isSoldOut || isExpired
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : claiming
                ? 'bg-orange-300 text-white cursor-wait'
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-95 text-white shadow-brand hover:shadow-brand-lg',
            ].join(' ')}
          >
            {claimed
              ? '✓ 已领取，出示给店员'
              : isSoldOut
              ? '已抢完'
              : isExpired
              ? '已过期'
              : claiming
              ? '领取中…'
              : '立即领取'}
          </button>
          {!isExpired && (
            <button
              onClick={handleShare}
              className="px-3.5 py-2.5 rounded-xl text-sm border border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-500 hover:text-orange-500 active:scale-95"
              title="分享"
            >
              {shareCopied ? '✓' : '📤'}
            </button>
          )}
        </div>

        {/* 分类 + 外链 */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex gap-2">
            {coupon.category && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                🍽 {coupon.category}
              </span>
            )}
          </div>
          {coupon.originalUrl && !claimed && (
            <a
              href={coupon.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-600 transition-colors"
            >
              查看原页面 →
            </a>
          )}
        </div>

        {/* 地理范围 */}
        <p className="text-xs text-gray-300 text-center pt-0.5">
          有效 {coupon.radiusKm} km · {coupon.location.lat.toFixed(4)}, {coupon.location.lng.toFixed(4)}
        </p>
      </div>
    </div>
  );
}
