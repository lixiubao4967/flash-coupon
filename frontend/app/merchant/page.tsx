'use client';

import { useState } from 'react';
import PublishForm from '@/components/PublishForm';
import CouponCard from '@/components/CouponCard';
import { Coupon } from '@/lib/types';

export default function MerchantPage() {
  const [recentPublished, setRecentPublished] = useState<Coupon[]>([]);

  function handlePublished(coupon: Coupon) {
    setRecentPublished((prev) => [coupon, ...prev.slice(0, 4)]);
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div>
        <h1 className="text-2xl font-black text-gray-800">商家发布优惠券</h1>
        <p className="text-sm text-gray-400 mt-1">
          发布后立即通过 WebSocket 实时推送给附近所有消费者
        </p>
      </div>

      {/* 发布表单 */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-5 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs flex items-center justify-center">✎</span>
          填写优惠券信息
        </h2>
        <PublishForm onPublished={handlePublished} />
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
            '地理位置默认使用当前位置，也可手动填写坐标',
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
    </div>
  );
}
