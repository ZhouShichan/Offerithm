import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 15_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: {
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'pages',
      testMatch: ['routing.spec.ts', 'comparison.spec.ts'],
      use: { baseURL: 'http://127.0.0.1:4273/Offerithm/' },
    },
    {
      name: 'root',
      testMatch: 'routing.spec.ts',
      use: { baseURL: 'http://127.0.0.1:4274/' },
    },
    {
      name: 'storage',
      testMatch: 'transactions.spec.ts',
      use: { baseURL: 'http://127.0.0.1:5273/' },
    },
  ],
  webServer: [
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4273 --strictPort --base /Offerithm/',
      url: 'http://127.0.0.1:4273/Offerithm/',
      reuseExistingServer: false,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4274 --strictPort --base / --outDir dist/root',
      url: 'http://127.0.0.1:4274/',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5273 --strictPort --base /',
      url: 'http://127.0.0.1:5273/',
      reuseExistingServer: false,
    },
  ],
});
