import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '闪购优惠券',
  description: '实时发现附近商家的限时优惠，半小时内拉面半价！',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '闪购优惠券',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          {/* Header with glassmorphism on scroll */}
          <header className="sticky top-0 z-50 bg-gradient-to-r from-orange-500 to-red-500 shadow-brand">
            <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
              <a href="/" className="flex items-center gap-1.5 group">
                <span className="text-xl leading-none">⚡</span>
                <span className="text-white font-bold text-lg tracking-tight group-hover:opacity-90 transition-opacity">
                  闪购优惠券
                </span>
              </a>
              <nav className="flex items-center gap-1">
                <a
                  href="/"
                  className="text-sm font-medium text-white/80 hover:text-white hover:bg-white/15 px-3 py-1.5 rounded-full transition-all"
                >
                  发现优惠
                </a>
                <a
                  href="/voice"
                  className="flex items-center gap-1 text-sm font-medium bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition-all"
                >
                  🎤 语音发布
                </a>
                <a
                  href="/merchant"
                  className="text-sm font-medium text-white/80 hover:text-white hover:bg-white/15 px-3 py-1.5 rounded-full transition-all"
                >
                  商家
                </a>
              </nav>
            </div>
          </header>

          <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
            {children}
          </main>

          <footer className="text-center text-xs text-gray-400 py-5 border-t border-gray-100">
            <span className="text-orange-400 font-medium">⚡ Flash Coupon</span>
            <span className="mx-2 text-gray-300">·</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </footer>
        </div>

        {/* 注册 Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('[SW] Registered:', reg.scope);
                    })
                    .catch(function(err) {
                      console.warn('[SW] Registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
