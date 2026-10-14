import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages 部署在 <repo> 子路径下，base 需与仓库名一致；本地构建可用 '/'
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/Offerithm/' : '/'),
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
