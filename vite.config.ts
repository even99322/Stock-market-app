import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// 開發模式（瀏覽器）下用 proxy 繞過 CORS；打包成 exe / APK 時改走原生 HTTP。
const px = (target: string) => ({
  target,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/px\/[a-z0-9]+/, ''),
  headers: { 'User-Agent': 'Mozilla/5.0' },
});

export default defineConfig({
  test: { environment: 'jsdom' },
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  server: {
    proxy: {
      '/px/yf1': px('https://query1.finance.yahoo.com'),
      '/px/yf2': px('https://query2.finance.yahoo.com'),
      '/px/twse': px('https://openapi.twse.com.tw'),
      '/px/tpex': px('https://www.tpex.org.tw'),
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
