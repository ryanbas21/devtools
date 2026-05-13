import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';

test.describe('theme toggle', () => {
  test('theme toggle button is visible in toolbar', async ({ extensionContext, extensionId }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // The theme toggle is appended by JS after Elm renders the toolbar
    const toggleBtn = panelPage.locator('.theme-toggle');
    await expect(toggleBtn).toBeVisible({ timeout: 3000 });

    await panelPage.close();
  });

  test('clicking toggle switches to light mode and back', async ({
    extensionContext,
    extensionId,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    const toggleBtn = panelPage.locator('.theme-toggle');
    await expect(toggleBtn).toBeVisible({ timeout: 3000 });

    // Get initial theme state
    const initialTheme = await panelPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );

    // Click to switch theme
    await toggleBtn.click();
    const afterFirstClick = await panelPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );

    if (initialTheme === null) {
      expect(afterFirstClick).toBe('light');
    } else {
      expect(afterFirstClick).toBeNull();
    }

    // Click again to toggle back
    await toggleBtn.click();
    const afterSecondClick = await panelPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(afterSecondClick).toBe(initialTheme);

    await panelPage.close();
  });

  test('theme preference persists across page reloads', async ({
    extensionContext,
    extensionId,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    const toggleBtn = panelPage.locator('.theme-toggle');
    await expect(toggleBtn).toBeVisible({ timeout: 3000 });

    // Get initial state
    const initialTheme = await panelPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );

    // Toggle the theme
    await toggleBtn.click();
    const newTheme = await panelPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(newTheme).not.toBe(initialTheme);

    // Verify localStorage was updated
    const storedTheme = await panelPage.evaluate(() => localStorage.getItem('wolfcola:theme'));
    expect(storedTheme).toBe(newTheme === 'light' ? 'light' : 'dark');

    // Reload and verify theme persists
    await panelPage.reload();
    await panelPage.waitForSelector('.toolbar', { state: 'visible' });

    const themeAfterReload = await panelPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(themeAfterReload).toBe(newTheme);

    await panelPage.close();
  });

  test('toggle button survives Elm re-render', async ({ extensionContext, extensionId }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    await expect(panelPage.locator('.theme-toggle')).toBeVisible({ timeout: 3000 });

    // Trigger an Elm re-render by injecting an SDK event
    await panelPage.evaluate(() => {
      chrome.runtime.sendMessage({
        type: 'SDK_EVENT',
        payload: {
          type: 'sdk:node-change',
          id: `theme-test-${Date.now()}`,
          flowId: 'theme-flow',
          timestamp: Date.now(),
          source: 'sdk',
          causedBy: null,
          data: { _tag: 'sdk', nodeStatus: 'continue' },
          flags: { isCors: false, isError: false, isAuthRelated: true },
        },
      });
    });

    // Wait for the event to appear (forces Elm re-render)
    await panelPage.waitForSelector('.tl-row', { state: 'visible', timeout: 5000 });

    // Toggle should still be there after Elm re-rendered
    await expect(panelPage.locator('.theme-toggle')).toBeVisible({ timeout: 3000 });

    await panelPage.close();
  });
});
