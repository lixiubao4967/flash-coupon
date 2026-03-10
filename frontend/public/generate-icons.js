/**
 * 图标生成脚本（开发用，需要 Node.js + canvas 或 sharp）
 * 运行: node public/generate-icons.js
 *
 * 生产环境请使用真实设计图标替换 public/icons/ 目录下的文件。
 * 可使用 https://realfavicongenerator.net/ 或 https://maskable.app/ 生成。
 *
 * 此脚本使用纯 Node.js Buffer 生成最小合法 PNG（1x1 橙色像素），
 * 仅用于本地开发测试，不依赖任何外部依赖。
 */

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR);

// 最小合法 PNG（1x1 橙色 #f97316 像素），base64 编码
// 实际项目请替换为真实图标
const ORANGE_1x1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
  'base64'
);

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of SIZES) {
  const filePath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, ORANGE_1x1_PNG);
    console.log(`Created placeholder: icon-${size}x${size}.png`);
  } else {
    console.log(`Skipped (exists): icon-${size}x${size}.png`);
  }
}

console.log('Done. Replace icons in public/icons/ with real artwork before production.');
