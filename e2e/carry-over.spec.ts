import { test, expect } from '@playwright/test'

// SPEC 8.2 ch3 carry-over: "each contract not torn up by the end of the chapter adds 1 Outlet to Oakvale
// in chapter 4 (maximum 2), with a rueful line from Tomas." tests/chapters.test.ts/tests/storage.test.ts
// cover the pure logic (survivingWholesomeHollowContracts/chapter4Config/recordGrowingSeasonCarryOver);
// this is the missing end-to-end link — that App.tsx actually reads campaign storage and routes to the
// right scene before chapter 4's opening.
for (const [surviving, expectedLine] of [
  [1, /Never did tear up that last contract/],
  [2, /Kept both contracts too long/],
] as const) {
  test(`chapter 4 shows the rueful Tomas scene when ${surviving} contract(s) survived chapter 3`, async ({ page }) => {
    await page.goto('/')
    await page.evaluate((n) => {
      localStorage.setItem(
        'cathnivore:campaign:v1',
        JSON.stringify({
          version: 1,
          completed: ['fresh-meat', 'word-of-mouth', 'growing-season'],
          growingSeasonContractsSurviving: n,
        }),
      )
    }, surviving)
    await page.goto('/')
    await page.getByRole('button', { name: 'Campaign' }).click()
    await page.getByRole('button', { name: /^The Plan/ }).click()
    await page.getByRole('button', { name: /solo/i }).click()
    await expect(page.getByText(expectedLine)).toBeVisible()
  })
}

test('chapter 4 skips straight to its normal opening when no contract survived', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'cathnivore:campaign:v1',
      JSON.stringify({ version: 1, completed: ['fresh-meat', 'word-of-mouth', 'growing-season'], growingSeasonContractsSurviving: 0 }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Campaign' }).click()
  await page.getByRole('button', { name: /^The Plan/ }).click()
  await page.getByRole('button', { name: /solo/i }).click()
  await expect(page.getByText('Two farms, one plan.')).toBeVisible()
})
