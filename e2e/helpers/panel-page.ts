import type { Page } from '@playwright/test';

export async function openPanelPage(page: Page, extensionId: string): Promise<Page> {
  await page.goto(`chrome-extension://${extensionId}/panel/panel.html`);
  // Elm replaces the #app mount point with rendered content on init,
  // so wait for the toolbar that Elm renders.
  await page.waitForSelector('.toolbar', { state: 'visible' });
  return page;
}

export async function waitForEvents(
  page: Page,
  minCount: number,
  timeoutMs = 10_000,
): Promise<void> {
  await page.waitForFunction(
    (count) => document.querySelectorAll('.tl-row').length >= count,
    minCount,
    { timeout: timeoutMs },
  );
}

export async function getEventCount(page: Page): Promise<number> {
  return page.locator('.tl-row').count();
}

export async function hasOidcBadge(page: Page, phase: string): Promise<boolean> {
  const badges = page.locator('.tag-oidc');
  const count = await badges.count();
  for (let i = 0; i < count; i++) {
    const text = await badges.nth(i).textContent();
    if (text?.toLowerCase().includes(phase.toLowerCase())) return true;
  }
  return false;
}
