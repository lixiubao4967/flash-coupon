'use client';

import { useEffect, useState } from 'react';
import { Coupon, CouponSource } from '@/lib/types';

const SOURCE_CONFIG: Record<
  CouponSource,
  {
    label: string;
    gradientFrom: string;
    gradientTo: string;
    pillBg: string;
  }
> = {
  manual:    {
    label: '商家発布',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-amber-400',
    pillBg: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  },
  hotpepper: {
    label: 'Hot Pepper',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-rose-400',
    pillBg: 'bg-red-500/20 text-red-400 border border-red-500/30',
  },
  social:    {
    label: '来自 X',
    gradientFrom: 'from-sky-500',
    gradientTo: 'to-blue-400',
    pillBg: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  },
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

  return {
    text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    urgent: minutes < 5,
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
    const rem = coupon.expiresAt - Date.now();
    const mins = Math.max(0, Math.floor(rem / 60000));
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

  const sourceConf =
    coupon.source && SOURCE_CONFIG[coupon.source]
      ? SOURCE_CONFIG[coupon.source]
      : null;

  return (
    <div
      className={[
        'relative rounded-2xl bg-slate-800 overflow-hidden card-lift',
        isNew && !isExpired
          ? 'ring-2 ring-orange-400/60 ring-offset-2 ring-offset-slate-900 shadow-glow-orange animate-slide-up'
          : 'shadow-card hover:shadow-card-hover',
        isExpired ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="p-4 space-y-3">
        {/* Top row: pill tags + share button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Coupon type pill */}
            <span className="shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
              クーポン
            </span>
            {/* Category pill */}
            {coupon.category && (
              <span className="shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                {coupon.category}
              </span>
            )}
            {/* Source pill */}
            {sourceConf && (
              <span className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${sourceConf.pillBg}`}>
                {sourceConf.label}
              </span>
            )}
            {/* NEW badge */}
            {isNew && !isExpired && (
              <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white animate-bounce-in">
                NEW
              </span>
            )}
          </div>

          {/* Share button */}
          {!isExpired && (
            <button
              onClick={handleShare}
              className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 active:scale-95 transition-all"
              title="分享"
            >
              {shareCopied ? (
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

        {/* Shop icon + name + item + discount */}
        <div className="flex gap-3 items-center">
          {/* Left: gradient icon placeholder with first char */}
          <div
            className={[
              'w-16 h-16 rounded-xl shrink-0 flex items-center justify-center shadow-lg',
              `bg-gradient-to-br ${sourceConf?.gradientFrom ?? 'from-slate-600'} ${sourceConf?.gradientTo ?? 'to-slate-500'}`,
            ].join(' ')}
          >
            <span className="text-2xl font-black text-white/90 leading-none">
              {coupon.shopName.charAt(0)}
            </span>
          </div>

          {/* Right: text */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight truncate">
              {coupon.shopName}
            </p>
            <p className="text-orange-400 text-sm mt-0.5 font-medium leading-tight line-clamp-1">
              {coupon.item}
            </p>
            <p className="text-2xl font-black text-white leading-tight mt-0.5">
              {coupon.discount}
            </p>
          </div>
        </div>

        {/* Description */}
        {coupon.description && (
          <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
            {coupon.description}
          </p>
        )}

        {/* Info row: countdown · quota · area */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span
            className={[
              'flex items-center gap-1 font-semibold tabular-nums',
              isExpired
                ? 'text-slate-500'
                : countdown.urgent
                ? 'text-red-400 animate-pulse-fast'
                : 'text-slate-200',
            ].join(' ')}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            {countdown.text}
          </span>

          <span className="text-slate-600">·</span>

          <span className="flex items-center gap-1 text-slate-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>
            {coupon.usedCount}/{coupon.totalQuota}
          </span>

          {coupon.area && (
            <>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1 text-slate-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {coupon.area}
              </span>
            </>
          )}

          {coupon.originalUrl && !claimed && (
            <>
              <span className="text-slate-600">·</span>
              <a
                href={coupon.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-orange-400 transition-colors"
              >
                原页面 →
              </a>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">
              已领 <span className="text-slate-400 font-medium">{coupon.usedCount}</span> / {coupon.totalQuota}
            </span>
            <span className={quotaPercent >= 80 ? 'text-red-400 font-semibold' : 'text-slate-500'}>
              {quotaPercent}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
            <div
              className={[
                'h-1 rounded-full transition-all duration-500',
                quotaPercent >= 80 ? 'bg-red-500' : 'bg-orange-400',
              ].join(' ')}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Full-width CTA button — attached to card bottom */}
      <button
        onClick={handleClaim}
        disabled={isExpired || isSoldOut || claimed || claiming}
        className={[
          'w-full py-3 font-bold text-sm transition-all duration-200',
          claimed
            ? 'bg-emerald-600 text-white cursor-default'
            : isSoldOut || isExpired
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : claiming
            ? 'bg-red-400/70 text-white cursor-wait'
            : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white',
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
          : '立即领取 →'}
      </button>
    </div>
  );
}
