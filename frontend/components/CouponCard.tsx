'use client';

import { useEffect, useState } from 'react';
import { Coupon, CouponSource } from '@/lib/types';

const SOURCE_CONFIG: Record<CouponSource, { label: string; stripe: string; badge: string; text: string }> = {
  manual:    { label: '商家发布', stripe: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-600',  text: 'text-orange-600' },
  hotpepper: { label: 'Hot Pepper', stripe: 'bg-red-400',  badge: 'bg-red-50 text-red-600',       text: 'text-red-600'    },
  social:    { label: '来自 X',    stripe: 'bg-sky-400',   badge: 'bg-sky-50 text-sky-600',        text: 'text-sky-600'   },
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
  const stripeColor = sourceConf?.stripe ?? 'bg-gray-300';

  return (
    <div
      className={[
        'relative rounded-2xl bg-white overflow-hidden card-lift flex',
        isNew
          ? 'ring-2 ring-indigo-400 ring-offset-1 animate-slide-up shadow-brand'
          : 'shadow-card hover:shadow-card-hover',
        isExpired ? 'opacity-50 grayscale' : '',
      ].join(' ')}
    >
      {/* 左侧色条 */}
      <div className={`w-1 shrink-0 ${stripeColor}`} />

      {/* NEW 标签 */}
      {isNew && !isExpired && (
        <div className="absolute top-3 right-3 z-10 bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce-in">
          NEW
        </div>
      )}

      {/* 卡片主体 */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {/* 顶部：店名 + 折扣 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* 来源标签 */}
            {sourceConf && (
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 ${sourceConf.badge}`}>
                {sourceConf.label}
              </span>
            )}
            <p className="text-gray-900 font-bold text-base leading-tight">{coupon.shopName}</p>
            <p className="text-gray-500 text-sm mt-0.5">{coupon.item}</p>
          </div>

          {/* 折扣大字 */}
          <div className="shrink-0 text-right">
            <p className="text-3xl font-black text-gray-900 leading-none">{coupon.discount}</p>
            <p className="text-xs text-gray-400 mt-0.5">折扣</p>
          </div>
        </div>

        {/* 标签行：倒计时 + 名额 + 地区 */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className={[
              'inline-flex items-center gap-1 text-xs font-semibold tabular-nums px-2.5 py-1 rounded-lg',
              isExpired
                ? 'bg-gray-100 text-gray-400'
                : countdown.urgent
                ? 'bg-red-50 text-red-500 animate-pulse-fast'
                : 'bg-indigo-50 text-indigo-600',
            ].join(' ')}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            {countdown.text}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>
            {coupon.usedCount}/{coupon.totalQuota}
          </span>
          {coupon.area && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {coupon.area}
            </span>
          )}
          {coupon.category && (
            <span className="inline-flex items-center text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
              {coupon.category}
            </span>
          )}
        </div>

        {coupon.description && (
          <p className="text-gray-500 text-sm leading-relaxed">{coupon.description}</p>
        )}

        {/* 使用进度条 */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">
              已领 <span className="font-medium text-gray-600">{coupon.usedCount}</span> / {coupon.totalQuota}
            </span>
            <span className={quotaPercent >= 80 ? 'text-red-500 font-medium' : 'text-gray-400'}>
              {quotaPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={[
                'h-1.5 rounded-full transition-all duration-500',
                quotaPercent >= 80 ? 'bg-red-400' : 'bg-indigo-400',
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
                ? 'bg-green-500 text-white cursor-default'
                : isSoldOut || isExpired
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : claiming
                ? 'bg-indigo-300 text-white cursor-wait'
                : 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white',
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
              className="px-3.5 py-2.5 rounded-xl text-sm border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600 active:scale-95 transition-all"
              title="分享"
            >
              {shareCopied ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* 外链 + 地理范围 */}
        <div className="flex items-center justify-between pt-0.5">
          {coupon.originalUrl && !claimed ? (
            <a
              href={coupon.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              查看原页面 →
            </a>
          ) : <span />}
          <p className="text-xs text-gray-300">
            {coupon.radiusKm} km · {coupon.location.lat.toFixed(4)}, {coupon.location.lng.toFixed(4)}
          </p>
        </div>
      </div>
    </div>
  );
}
