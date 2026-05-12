import { test, expect } from '../fixtures/extension.js';
import { openPanelPage } from '../helpers/panel-page.js';
import { injectSdkEvent, reloadAndWaitForEvents } from '../helpers/inject-events.js';

test.describe('flow view and playback', () => {
  test('flow view renders SDK nodes on the rail', async ({ extensionContext, extensionId }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject several SDK events
    const flowId = `fv-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await injectSdkEvent(panelPage, `fv-${i}-${Date.now()}`, flowId);
    }
    await reloadAndWaitForEvents(panelPage, 3);

    // Switch to Flow view
    await panelPage.locator('.tb-mode-btn', { hasText: 'Flow' }).click();

    // Flow view and rail should be visible
    await expect(panelPage.locator('.fv-view')).toBeVisible();
    await expect(panelPage.locator('.fv-rail')).toBeVisible();

    await panelPage.close();
  });

  test('playback controls appear and play button works', async ({
    extensionContext,
    extensionId,
  }) => {
    const panelPage = await extensionContext.newPage();
    await openPanelPage(panelPage, extensionId);

    // Inject SDK events for playback
    const flowId = `pb-${Date.now()}`;
    for (let i = 0; i < 4; i++) {
      await injectSdkEvent(panelPage, `pb-${i}-${Date.now()}`, flowId);
    }
    await reloadAndWaitForEvents(panelPage, 4);

    // Switch to Flow view
    await panelPage.locator('.tb-mode-btn', { hasText: 'Flow' }).click();

    // Playback controls should appear
    const controls = panelPage.locator('.fv-playback-controls');
    await expect(controls).toBeVisible();

    // Play button should be visible
    const playBtn = controls.locator('.tb-btn', { hasText: 'Play' });
    await expect(playBtn).toBeVisible();

    // Click play
    await playBtn.click();

    // Should now show pause button
    const pauseBtn = controls.locator('.tb-btn', { hasText: 'Pause' });
    await expect(pauseBtn).toBeVisible({ timeout: 2000 });

    // Step label should appear
    const stepLabel = controls.locator('.fv-step-label');
    await expect(stepLabel).toBeVisible();
    await expect(stepLabel).toContainText('Step');

    // Click pause
    await pauseBtn.click();
    await expect(controls.locator('.tb-btn', { hasText: 'Resume' })).toBeVisible();

    // Reset button
    const resetBtn = controls.locator('.tb-btn', { hasText: '◀◀' });
    await resetBtn.click();

    // After reset, play button should show again
    await expect(controls.locator('.tb-btn', { hasText: 'Play' })).toBeVisible();

    await panelPage.close();
  });
});
