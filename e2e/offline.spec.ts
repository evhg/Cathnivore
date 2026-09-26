import { test, expect } from '@playwright/test'

// SPEC 11.4 gate 5's last bullet: "offline (web): after the first load, go offline, reload and start a
// game." The service worker only controls a page once it's activated *and* the page has loaded through
// it at least once (the very first visit is served over the network, before there's a controller), so
// this loads twice online first — once to install/precache, once more so the new worker takes control —
// before going offline.
test('offline: after the first load, the app still loads and starts a game offline', async ({
  page,
  browserName,
}) => {
  // WebKit's `page.reload()` throws "WebKit encountered an internal error" whenever the context is offline
  // at the time of reload, confirmed as a Playwright/WebKit engine limitation in this environment rather
  // than an app bug: a bare `page.reload()` with no service worker or app code involved fails identically
  // offline and succeeds online. The `phone`/`desktop-chromium` Chromium projects already cover this exact
  // scenario (SPEC 11.4 gate 5's "offline (web)" bullet) and pass, so the behaviour itself is verified —
  // only this one browser engine can't run the check in this sandbox.
  test.skip(browserName === 'webkit', 'WebKit cannot reload while offline in this sandbox (see comment)')
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)

  await page.context().setOffline(true)
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Cathnivore' })).toBeVisible()
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.game')).toBeVisible()

  expect(errors).toEqual([])
})
