// 临时调试脚本：以 HTML link 方式构建 css，复现产物缺失问题（用后即删）
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

await build({
  configFile: false,
  root: process.cwd(),
  build: {
    outDir: '.tw-debug',
    emptyOutDir: true,
    rollupOptions: { input: { page: path.join(process.cwd(), 'dbg-tw.html') } },
  },
  plugins: [tailwindcss()],
});
console.log('done');
