// The self-removing root `sw.js` (SPEC 15): before the portfolio, Cathnivore lived at / with a service
// worker scoped to the whole site. Anyone who played then still has it registered; it would keep serving
// the old cached game at /. This worker clears its own caches, unregisters itself and reloads open tabs
// so they land on the new games portfolio page.
//
// `caches.keys()`/`caches.delete()` are origin-wide, not scoped to this worker, so a blind wipe would also
// delete the live /cathnivore/, /runnel/ and /hedgerow/ workbox precaches (Cache Storage is shared per origin). Cache
// names include the owning service worker's registration scope, which always contains that app's base
// path, so skipping any key naming one of the current apps leaves only genuinely old, unscoped caches to
// delete.
export function siteServiceWorkerSource(): string {
  return `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.includes('/cathnivore/') || key.includes('/runnel/') || key.includes('/hedgerow/')) continue
      await caches.delete(key)
    }
    await self.registration.unregister()
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
  })())
})
`
}
