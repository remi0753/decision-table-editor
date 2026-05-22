import { defineConfig, devices } from '@playwright/test';

const editorPort = Number(process.env.E2E_EDITOR_PORT ?? 5173);
const apiPort = Number(process.env.E2E_API_PORT ?? 8787);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${editorPort}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `pnpm --dir apps/api dev --port ${apiPort}`,
      url: `http://localhost:${apiPort}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm --dir apps/editor dev --host 127.0.0.1 --port ${editorPort}`,
      url: `http://localhost:${editorPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_BASE_URL: `http://localhost:${apiPort}`,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
