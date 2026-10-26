/**
 * Một mã nguồn, ba bản build (chọn bằng --mode, xem src/lib/source.ts):
 * - mặc định → dist/            web gọi server trên Mac
 * - extension → dist-extension/ extension Chrome (Load unpacked thư mục này)
 * - static → dist-static/       trang tĩnh cho GitHub Pages, đọc brief.json
 */
import { readFileSync } from 'node:fs'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

import { GOLD_API_URL, PNJ_URL, VCB_URL, WEBGIA_FUEL_URL } from './core/prices.ts'
import { FEEDS, GOOGLE_TRENDS_URL } from './core/sources.ts'
import { VIETSTOCK_EXPERT_URL, VIETSTOCK_OUTLOOK_URL, VND_API } from './core/stocks.ts'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
  description: string
}

/** manifest.json của extension. Quyền truy cập trang lấy thẳng từ danh sách nguồn: thêm báo là tự có quyền */
function extensionManifest(): Plugin {
  const hosts = [
    ...FEEDS.map((f) => f.url),
    GOOGLE_TRENDS_URL,
    PNJ_URL,
    GOLD_API_URL,
    VCB_URL,
    WEBGIA_FUEL_URL,
    VND_API,
    VIETSTOCK_OUTLOOK_URL,
    VIETSTOCK_EXPERT_URL,
  ]
  const icons = { '16': 'icons/icon-16.png', '32': 'icons/icon-32.png', '48': 'icons/icon-48.png', '128': 'icons/icon-128.png' }
  const manifest = {
    manifest_version: 3,
    name: 'Bản Tin Sáng',
    version: pkg.version,
    description: pkg.description,
    icons,
    action: { default_title: 'Bản Tin Sáng', default_icon: icons },
    background: { service_worker: 'background.js', type: 'module' },
    permissions: ['storage', 'unlimitedStorage', 'alarms'],
    host_permissions: [...new Set(hosts.map((u) => `${new URL(u).origin}/*`))].sort(),
  }
  return {
    name: 'ban-tin-sang:extension-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: `${JSON.stringify(manifest, null, 2)}\n` })
    },
  }
}

export default defineConfig(({ mode }) => {
  const extension = mode === 'extension'
  return {
    plugins: [react(), tailwindcss(), extension && extensionManifest()],
    // Đường dẫn tương đối: chạy được ở gốc (server, extension) lẫn /<tên repo>/ trên GitHub Pages
    base: './',
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
        '@shared': new URL('./shared', import.meta.url).pathname,
        '@core': new URL('./core', import.meta.url).pathname,
      },
    },
    build: {
      outDir: extension ? 'dist-extension' : mode === 'static' ? 'dist-static' : 'dist',
      emptyOutDir: true,
      rolldownOptions: extension
        ? {
            input: { index: 'index.html', background: 'src/extension/background.ts' },
            // manifest.json trỏ tới background.js nên tên file này phải cố định, không băm
            output: { entryFileNames: (c) => (c.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js') },
          }
        : undefined,
    },
    server: {
      port: 5200,
      // Mở được từ điện thoại cùng wifi
      host: true,
      proxy: { '/api': { target: 'http://localhost:4600', changeOrigin: true } },
    },
    test: {
      environment: 'node',
      include: ['core/**/*.test.ts', 'src/**/*.test.ts', 'server/**/*.test.ts'],
    },
  }
})
