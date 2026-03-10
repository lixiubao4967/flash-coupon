/** @type {import('next').NextConfig} */
const nextConfig = {
  // 允许跨域图片（如商家上传的图标）
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // PWA 相关：将 Service Worker 文件不经处理地提供
  // sw.js 放在 public/ 目录下，Next.js 会直接静态服务
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
