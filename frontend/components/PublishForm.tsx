'use client';

import { useState, FormEvent } from 'react';
import { PublishCouponPayload, Coupon } from '@/lib/types';

interface PublishFormProps {
  onPublished?: (coupon: Coupon) => void;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const DEFAULT_LOCATION = { lat: 31.2304, lng: 121.4737 }; // 上海市中心（演示）

export default function PublishForm({ onPublished }: PublishFormProps) {
  const [form, setForm] = useState<{
    shopId: string;
    shopName: string;
    item: string;
    discount: string;
    description: string;
    durationMinutes: string;
    lat: string;
    lng: string;
    radiusKm: string;
    totalQuota: string;
  }>({
    shopId: 'shop-001',
    shopName: '',
    item: '',
    discount: '50%',
    description: '',
    durationMinutes: '30',
    lat: String(DEFAULT_LOCATION.lat),
    lng: String(DEFAULT_LOCATION.lng),
    radiusKm: '1',
    totalQuota: '50',
  });

  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    let lat = parseFloat(form.lat);
    let lng = parseFloat(form.lng);

    try {
      await new Promise<void>((resolve) => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              setForm((prev) => ({
                ...prev,
                lat: String(lat.toFixed(6)),
                lng: String(lng.toFixed(6)),
              }));
              resolve();
            },
            () => resolve(),
            { timeout: 3000 }
          );
        } else {
          resolve();
        }
      });
    } catch {
      // 忽略
    }

    const payload: PublishCouponPayload = {
      shopId: form.shopId.trim(),
      shopName: form.shopName.trim(),
      item: form.item.trim(),
      discount: form.discount.trim(),
      description: form.description.trim(),
      durationMinutes: parseInt(form.durationMinutes, 10),
      location: { lat, lng },
      radiusKm: parseFloat(form.radiusKm),
      totalQuota: parseInt(form.totalQuota, 10),
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const coupon: Coupon = await res.json();
      setStatus('success');
      onPublished?.(coupon);

      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '发布失败，请重试');
      setStatus('error');
    }
  }

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition bg-white hover:border-gray-300';
  const labelClass = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 商家信息 */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">商家信息</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>商家 ID</label>
            <input
              name="shopId"
              value={form.shopId}
              onChange={handleChange}
              required
              placeholder="shop-001"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>商家名称</label>
            <input
              name="shopName"
              value={form.shopName}
              onChange={handleChange}
              required
              placeholder="例：老李拉面"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* 优惠内容 */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">优惠内容</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>优惠商品</label>
              <input
                name="item"
                value={form.item}
                onChange={handleChange}
                required
                placeholder="例：招牌拉面"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>折扣力度</label>
              <input
                name="discount"
                value={form.discount}
                onChange={handleChange}
                required
                placeholder="例：50% / 买一送一"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>优惠说明（可选）</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              placeholder="例：每桌限用一张，不与其他优惠叠加"
              className={inputClass + ' resize-none'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>有效时长</label>
              <select
                name="durationMinutes"
                value={form.durationMinutes}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="15">15 分钟</option>
                <option value="30">30 分钟</option>
                <option value="60">1 小时</option>
                <option value="120">2 小时</option>
                <option value="240">4 小时</option>
                <option value="480">8 小时</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>总名额</label>
              <input
                name="totalQuota"
                type="number"
                min={1}
                max={9999}
                value={form.totalQuota}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 地理信息 */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">地理范围</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>纬度</label>
            <input
              name="lat"
              type="number"
              step="any"
              value={form.lat}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>经度</label>
            <input
              name="lng"
              type="number"
              step="any"
              value={form.lng}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>半径 (km)</label>
            <input
              name="radiusKm"
              type="number"
              step="0.1"
              min={0.1}
              max={50}
              value={form.radiusKm}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">📍 提交时自动尝试获取当前位置</p>
      </div>

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={status === 'submitting' || status === 'success'}
        className={[
          'w-full py-3.5 rounded-2xl font-bold text-base transition-all duration-200',
          status === 'success'
            ? 'bg-green-500 text-white cursor-default shadow-sm'
            : status === 'submitting'
            ? 'bg-orange-300 text-white cursor-wait'
            : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:scale-95 text-white shadow-brand hover:shadow-brand-lg',
        ].join(' ')}
      >
        {status === 'success'
          ? '✓ 发布成功！已实时推送给消费者'
          : status === 'submitting'
          ? '发布中…'
          : '⚡ 立即发布优惠券'}
      </button>

      {/* 错误提示 */}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 animate-slide-up">
          ⚠️ {errorMsg}
        </div>
      )}
    </form>
  );
}
