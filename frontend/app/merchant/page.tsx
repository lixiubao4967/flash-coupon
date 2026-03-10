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
        <h1 className="text-2xl font-bold text-gray-800">商家发布优惠券</h1>
        <p className="text-sm text-gray-500 mt-1">
          发布后立即通过 WebSocket 推送给附近所有消费者
        </p>
      </div>

      {/* 发布表单 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">
          填写优惠券信息
        </h2>
        <PublishForm onPublished={handlePublished} />
      </div>

      {/* 操作说明 */}
      <div className="bg-orange-50 rounded-xl p-4 space-y-1.5">
        <h3 className="text-sm font-semibold text-orange-700">使用说明</h3>
        <ul className="text-xs text-orange-600 space-y-1 list-disc list-inside">
          <li>优惠券发布后立即向所有在线消费者实时广播</li>
          <li>支持 Web Push 通知，即使未开启 App 也能收到提醒</li>
          <li>Redis TTL 自动过期，无需手动下架</li>
          <li>名额用完后消费者端自动显示"已抢完"</li>
          <li>地理位置默认使用当前位置，也可手动填写坐标</li>
        </ul>
      </div>

      {/* 本次会话已发布的优惠券预览 */}
      {recentPublished.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-700">
            本次发布的优惠券（实时预览）
          </h2>
          {recentPublished.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} isNew />
          ))}
        </div>
      )}
    </div>
  );
}
