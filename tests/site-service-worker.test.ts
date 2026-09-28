import { describe, expect, it } from 'vitest'
import { siteServiceWorkerSource } from '../scripts/siteServiceWorker'

// Runs the generated sw.js source against fake `self`/`caches` globals to prove its cache-cleanup logic
// actually preserves the live /cathnivore/ and /runnel/ workbox precaches and only deletes everything else
// (SPEC 15: the self-removing root worker must not break offline play for either game).
async function runActivate(cacheKeys: string[]) {
  const deleted: string[] = []
  const listeners: Record<string, (event: unknown) => void> = {}
  const fakeSelf = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners[type] = handler
    },
    skipWaiting: () => {},
    registration: { unregister: async () => {} },
    clients: { matchAll: async () => [] },
  }
  const fakeCaches = {
    keys: async () => cacheKeys,
    delete: async (key: string) => {
      deleted.push(key)
    },
  }

  new Function('self', 'caches', siteServiceWorkerSource())(fakeSelf, fakeCaches)
  let waited: Promise<unknown> = Promise.resolve()
  const activate = listeners.activate
  if (!activate) throw new Error('sw.js never registered an activate listener')
  activate({ waitUntil: (p: Promise<unknown>) => (waited = p) })
  await waited

  return deleted
}

describe('the self-removing root sw.js (SPEC 15)', () => {
  it('preserves cache keys naming the live /cathnivore/ or /runnel/ apps', async () => {
    const deleted = await runActivate([
      'workbox-precache-v2-https://cathnivore.com/cathnivore/',
      'workbox-runtime-https://cathnivore.com/cathnivore/',
      'workbox-precache-v2-https://cathnivore.com/runnel/',
      'workbox-precache-v2-https://cathnivore.com/',
    ])

    expect(deleted).toEqual(['workbox-precache-v2-https://cathnivore.com/'])
  })

  it('deletes every cache when none belong to the current apps', async () => {
    const deleted = await runActivate(['some-old-cache', 'another-old-one'])

    expect(deleted).toEqual(['some-old-cache', 'another-old-one'])
  })
})
