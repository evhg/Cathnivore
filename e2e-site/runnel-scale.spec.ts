import { expect, test } from '@playwright/test'

// Plan item 389: the board and its valley at one scale. On the lesson and on a daily, a person in the valley stands
// 0.2-0.35 of a tile's edge (a hex's edge is its circumradius, half its drawn height), no tile rim is over 4 px, and
// the horizon band (the sky and hills above the valley's ground) is at most 15% of the board's height.
for (const [name, url] of [['lesson', '/runnel/?lesson'], ['daily', '/runnel/?nohelp']] as const) {
  test(`the ${name} board and its valley share one scale`, async ({ page }) => {
    await page.goto(url)
    await page.waitForSelector('#board polygon.tile')
    await page.waitForTimeout(1200)
    const r = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('#board polygon.tile')].map((e) => e.getBoundingClientRect())
      const edge = tiles[0]!.height / 2
      const people = [...document.querySelectorAll<HTMLElement>('.valley-folk-one:is([data-valley-folk="farmer"], [data-valley-folk="bea"])')]
        .filter((e) => !e.hidden && e.offsetParent)
        // the figure stands from 7 to 46 of its 48-unit box
        .map((e) => (e.querySelector('svg')!.getBoundingClientRect().height * 39) / 48 / edge)
      const rim = getComputedStyle(document.querySelector('#board .cell:not(.stone) polygon.tile')!)
      const ground = document.querySelector('.valley .vl-ground')!.getBoundingClientRect()
      const valley = document.querySelector('svg.valley')!.getBoundingClientRect()
      const board = document.getElementById('board')!.getBoundingClientRect()
      return { people, rim: rim.vectorEffect === 'non-scaling-stroke' ? parseFloat(rim.strokeWidth) : NaN, horizon: (ground.top - valley.top) / board.height }
    })
    expect(r.people.length).toBeGreaterThan(0)
    for (const k of r.people) {
      expect(k).toBeGreaterThanOrEqual(0.2)
      expect(k).toBeLessThanOrEqual(0.35)
    }
    expect(r.rim).toBeLessThanOrEqual(4)
    expect(r.horizon).toBeLessThanOrEqual(0.15)
  })
}
