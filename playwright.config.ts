import { defineConfig, devices } from '@playwright/test';

// e2e 对生产形态（vite preview + /Offerithm/ 子路径）冒烟，测的就是 GitHub Pages 部署形态。
// 方案与版本来源见 #2 / docs/research/test-infra-stack.md（research/test-infra-stack 分支）。
export default defineConfig({
  testDir: 'e2e',
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/Offerithm/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // 本地一条命令完成 build + preview；CI 上由 e2e job 显式调用 npm run test:e2e。
    command: 'npm run build && npm run preview',
    // 轮询带子路径的地址：能返回 2xx 才算真正就绪。
    url: 'http://127.0.0.1:4173/Offerithm/',
    reuseExistingServer: !process.env.CI,
    // 预算需覆盖 webServer 内嵌的完整 vite build 冷启动。
    timeout: 180_000,
    // vite preview 默认绑 'localhost'：部分系统（如 Windows）DNS 优先 IPv6 会绑到 ::1，
    // 导致轮询 127.0.0.1 失败；强制 ipv4first 让两种环境都一致绑 127.0.0.1（CI 上无副作用）。
    env: {
      NODE_OPTIONS: '--dns-result-order=ipv4first',
    },
  },
});
