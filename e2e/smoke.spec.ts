import { expect, test } from '@playwright/test';

test('serves the login shell with security headers', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  await expect(page.getByText('AI TASK', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});
