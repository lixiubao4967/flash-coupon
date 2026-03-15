'use client';

import { useState, useRef, useCallback } from 'react';
import { Coupon } from '@/lib/types';

type Stage = 'idle' | 'recording' | 'processing' | 'confirming' | 'publishing' | 'done';
type RecogLang = 'ja-JP' | 'zh-CN' | 'en-US';

interface Draft {
  shopName: string;
  item: string;
  discount: string;
  description: string;
  durationMinutes: number;
  totalQuota: number;
  category: string;
  area: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const LANG_LABELS: Record<RecogLang, string> = {
  'ja-JP': '日本語',
  'zh-CN': '中文',
  'en-US': 'EN',
};

const DURATION_OPTIONS = [
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 120, label: '2 小时' },
  { value: 240, label: '4 小时' },
];

export default function VoicePublisher() {
  const [stage, setStage] = useState<Stage>('idle');
  const [lang, setLang] = useState<RecogLang>(() => {
    if (typeof navigator === 'undefined') return 'ja-JP';
    if (navigator.language.startsWith('zh')) return 'zh-CN';
    if (navigator.language.startsWith('en')) return 'en-US';
    return 'ja-JP';
  });
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [publishedCoupon, setPublishedCoupon] = useState<Coupon | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ─── Recording ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SR) {
      setError('浏览器不支持语音识别，请使用 Chrome 或 Safari');
      return;
    }

    setError('');
    setTranscript('');

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      setTranscript(full);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError(`语音识别错误：${e.error}`);
        setStage('idle');
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setStage('recording');
  }, [lang]);

  const stopRecording = useCallback(async () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    if (!transcript.trim()) {
      setStage('idle');
      return;
    }

    setStage('processing');
    try {
      const res = await fetch(`${BACKEND_URL}/api/coupons/voice/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '解析失败');
      const data = (await res.json()) as Draft;
      setDraft(data);
      setStage('confirming');
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败，请重试');
      setStage('idle');
    }
  }, [transcript]);

  // ─── Publish ─────────────────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!draft) return;
    setStage('publishing');

    let lat = 35.6762;
    let lng = 139.6503;
    await new Promise<void>((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            resolve();
          },
          () => resolve(),
          { timeout: 3000 }
        );
      } else {
        resolve();
      }
    });

    try {
      const res = await fetch(`${BACKEND_URL}/api/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: `voice-${Date.now()}`,
          shopName: draft.shopName,
          item: draft.item,
          discount: draft.discount,
          description: draft.description,
          durationMinutes: draft.durationMinutes,
          location: { lat, lng },
          radiusKm: 1.5,
          totalQuota: draft.totalQuota,
          category: draft.category,
          area: draft.area,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '发布失败');
      const coupon = (await res.json()) as Coupon;
      setPublishedCoupon(coupon);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败，请重试');
      setStage('confirming');
    }
  }, [draft]);

  // ─── Share ───────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!publishedCoupon) return;
    const text = `【限时优惠】${publishedCoupon.shopName}\n${publishedCoupon.item} ${publishedCoupon.discount}\n仅剩 ${publishedCoupon.durationMinutes} 分钟，限 ${publishedCoupon.totalQuota} 人领取！`;
    const url = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${publishedCoupon.shopName} 限时优惠`, text, url });
      } catch {
        // user cancelled, ignore
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [publishedCoupon]);

  const reset = () => {
    setStage('idle');
    setTranscript('');
    setDraft(null);
    setPublishedCoupon(null);
    setError('');
    setCopied(false);
  };

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition bg-white hover:border-gray-300';

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* 语言切换 */}
      {stage === 'idle' && (
        <div className="flex justify-center gap-2">
          {(Object.keys(LANG_LABELS) as RecogLang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={[
                'text-xs px-4 py-1.5 rounded-full border font-medium transition-all',
                lang === l
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-500',
              ].join(' ')}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      )}

      {/* ── IDLE ── */}
      {stage === 'idle' && (
        <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
          <button
            onClick={startRecording}
            className="relative w-28 h-28 rounded-full bg-gradient-to-br from-orange-500 to-red-500 shadow-brand hover:shadow-brand-lg active:scale-95 transition-all duration-200 flex items-center justify-center"
          >
            <span className="text-5xl select-none">🎤</span>
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-700 text-base">点击开始录音</p>
            <p className="text-sm text-gray-400 mt-1">说出你的优惠信息，AI 自动解析</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-500 w-full space-y-2">
            <p className="font-semibold text-gray-600 text-xs uppercase tracking-wide">示例话术</p>
            <p className="text-gray-600 leading-relaxed">「今日限定，招牌拉面半价，仅限 30 分钟，20 个名额」</p>
            <p className="text-gray-500 leading-relaxed">「老王烤串今晚买二送一，晚 9 点截止」</p>
          </div>
        </div>
      )}

      {/* ── RECORDING ── */}
      {stage === 'recording' && (
        <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
          {/* 脉冲环 + 麦克风按钮 */}
          <div className="relative flex items-center justify-center">
            {/* 外圈脉冲 */}
            <span className="absolute w-36 h-36 rounded-full bg-red-400/20 animate-ripple" />
            <span className="absolute w-32 h-32 rounded-full bg-red-400/15 animate-ripple [animation-delay:0.5s]" />
            <button
              onClick={stopRecording}
              className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg active:scale-95 transition-all flex items-center justify-center"
            >
              <span className="text-4xl select-none">⏹</span>
            </button>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-red-500 flex items-center gap-1.5 justify-center">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-fast" />
              录音中…点击停止
            </p>
          </div>
          {transcript && (
            <div className="w-full bg-orange-50 border border-orange-100 rounded-2xl p-4 text-sm text-gray-700 min-h-[60px] animate-fade-in">
              <p className="text-xs text-orange-400 font-medium mb-1.5">识别结果</p>
              {transcript}
            </div>
          )}
        </div>
      )}

      {/* ── PROCESSING ── */}
      {stage === 'processing' && (
        <div className="flex flex-col items-center gap-5 py-16 animate-fade-in">
          <div className="relative">
            <div className="w-14 h-14 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-gray-700 font-semibold text-sm">AI 解析中…</p>
            <p className="text-xs text-gray-400 mt-1">正在理解你说的优惠内容</p>
          </div>
          {transcript && (
            <p className="text-xs text-gray-400 max-w-xs text-center bg-gray-50 rounded-xl px-3 py-2">
              「{transcript}」
            </p>
          )}
        </div>
      )}

      {/* ── CONFIRMING ── */}
      {stage === 'confirming' && draft && (
        <div className="space-y-5 animate-scale-in">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs flex items-center justify-center font-bold">✦</span>
            <p className="font-bold text-gray-800">AI 理解了以下内容，请确认：</p>
          </div>

          {/* 预览卡片 */}
          <div className="rounded-2xl overflow-hidden shadow-card border">
            <div className="bg-gradient-to-br from-orange-500 to-red-500 px-4 py-4 flex justify-between items-start relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
              <div className="relative">
                <p className="text-white font-bold text-lg">{draft.shopName}</p>
                <p className="text-orange-100 text-sm">{draft.item}</p>
              </div>
              <p className="text-white text-4xl font-black relative">{draft.discount}</p>
            </div>
            <div className="px-4 py-2.5 bg-orange-50 border-t border-orange-100 text-xs text-orange-700 flex flex-wrap gap-3">
              <span className="flex items-center gap-1">⏱ {draft.durationMinutes} 分钟</span>
              <span className="flex items-center gap-1">👥 {draft.totalQuota} 名额</span>
              {draft.area && <span className="flex items-center gap-1">📍 {draft.area}</span>}
              {draft.category && <span className="flex items-center gap-1">🍽 {draft.category}</span>}
            </div>
          </div>

          {/* 可编辑字段 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">商家名</label>
                <input
                  value={draft.shopName}
                  onChange={(e) => setDraft({ ...draft, shopName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">优惠商品</label>
                <input
                  value={draft.item}
                  onChange={(e) => setDraft({ ...draft, item: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">折扣</label>
                <input
                  value={draft.discount}
                  onChange={(e) => setDraft({ ...draft, discount: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">总名额</label>
                <input
                  type="number"
                  min={1}
                  value={draft.totalQuota}
                  onChange={(e) =>
                    setDraft({ ...draft, totalQuota: parseInt(e.target.value) || 30 })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">有效时长</label>
              <select
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, durationMinutes: parseInt(e.target.value) })
                }
                className={inputClass}
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {draft.description && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">补充说明</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  className={inputClass + ' resize-none'}
                />
              </div>
            )}
          </div>

          <button
            onClick={handlePublish}
            className="w-full py-3.5 rounded-2xl font-bold text-base bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-95 text-white shadow-brand hover:shadow-brand-lg transition-all"
          >
            ⚡ 发布并通知周边用户
          </button>
          <button
            onClick={reset}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            重新录音
          </button>
        </div>
      )}

      {/* ── PUBLISHING ── */}
      {stage === 'publishing' && (
        <div className="flex flex-col items-center gap-5 py-16 animate-fade-in">
          <div className="relative">
            <div className="w-14 h-14 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
          </div>
          <p className="text-gray-600 font-medium text-sm">发布中，正在通知周边用户…</p>
        </div>
      )}

      {/* ── DONE ── */}
      {stage === 'done' && publishedCoupon && (
        <div className="flex flex-col items-center gap-6 py-8 animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
            <span className="text-white text-3xl font-black">✓</span>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-gray-800">发布成功！</p>
            <p className="text-sm text-gray-500 mt-1">
              已实时推送给 {publishedCoupon.radiusKm} km 内的用户
            </p>
          </div>

          <button
            onClick={handleShare}
            className="w-full py-3.5 rounded-2xl font-bold text-base bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 active:scale-95 text-white shadow-md transition-all"
          >
            {copied ? '✓ 已复制到剪贴板' : '📤 分享给朋友'}
          </button>

          <button
            onClick={reset}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            再发一个优惠
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600 text-center animate-slide-up">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
