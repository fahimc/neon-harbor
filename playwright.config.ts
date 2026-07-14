import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:42817',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--enable-webgl', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 42817 --strictPort',
    url: 'http://127.0.0.1:42817',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
