import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['github']] : 'html',
  use: {
    baseURL: 'http://localhost:3006',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/setup/storage-state.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'next dev --port 3006',
    url: 'http://localhost:3006',
    // Never reuse an existing server: the e2e orchestrator starts a fresh Neon
    // branch per run and the server must connect to that branch's DATABASE_URL.
    // Reusing a local dev server would use the wrong database.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
