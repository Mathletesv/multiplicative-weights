import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
  reporter: 'list',
  projects: [
    { name: 'subpath', use: { baseURL: 'http://127.0.0.1:4373/multiplicative-weights/' } },
    { name: 'root', use: { baseURL: 'http://127.0.0.1:4374/' } },
  ],
  webServer: [
    { command: 'node tests/notes/serve-fixture.ts --port=4373 --base=/multiplicative-weights', url: 'http://127.0.0.1:4373/multiplicative-weights/', timeout: 120_000 },
    { command: 'node tests/notes/serve-fixture.ts --port=4374 --base=/', url: 'http://127.0.0.1:4374/', timeout: 120_000 },
  ],
});
