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
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
