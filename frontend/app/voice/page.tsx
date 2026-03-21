'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import VoicePublisher from '@/components/VoicePublisher';
import { MerchantSession } from '@/lib/types';

const SESSION_KEY = 'flash_merchant_session';

export default function VoicePage() {
  const [session, setSession] = useState<MerchantSession | null | 'loading'>('loading');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      setSession(raw ? (JSON.parse(raw) as MerchantSession) : null);
    } catch {
      setSession(null);
    }
  }, []);

  if (session === 'loading') {
    return (
      <div className="max-w-md mx-auto flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* 页头 */}
      <div>
        <h1 className="text-2xl font-black text-gray-800">语音发布优惠</h1>
        <p className="text-sm text-gray-400 mt-1">
          说出你的优惠，AI 自动解析，一键发布扩散
        </p>
      </div>

      {!session ? (
        /* 未登录时显示登录引导 */
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
            <span className="text-3xl">🔒</span>
          </div>
          <div>
            <p className="font-bold text-gray-800">需要登录才能发布</p>
            <p className="text-sm text-gray-400 mt-1">
              请先登录或注册商家账号，再使用语音发布功能
            </p>
          </div>
          <Link
            href="/merchant"
            className="inline-block w-full py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-brand hover:opacity-90 transition-opacity"
          >
            前往登录 / 注册
          </Link>
        </div>
      ) : (
        /* 已登录，渲染语音发布组件 */
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
          <VoicePublisher apiKey={session.apiKey} shopId={session.shopId} />
        </div>
      )}
    </div>
  );
}
