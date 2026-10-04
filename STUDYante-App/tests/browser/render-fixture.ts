import { test as base, expect } from '@playwright/test';
export type { Page } from '@playwright/test';
export { expect };
// Existing browser specs use synthetic API fixtures. Never allow an unmocked
// request to reach either the test backend or production/provider services.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
    });
    await use(page);
  },
});
