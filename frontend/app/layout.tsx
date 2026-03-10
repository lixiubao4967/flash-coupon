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
          <header className="bg-orange-500 text-white shadow-md sticky top-0 z-50">
            <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
              <a href="/" className="text-xl font-bold tracking-tight">
                ⚡ 闪购优惠券
              </a>
              <nav className="flex gap-4 text-sm font-medium">
                <a href="/" className="hover:text-orange-100 transition-colors">
                  发现优惠
                </a>
                <a href="/merchant" className="hover:text-orange-100 transition-colors">
                  商家发布
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
            {children}
          </main>
          <footer className="text-center text-xs text-gray-400 py-4">
            Flash Coupon &copy; {new Date().getFullYear()}
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
