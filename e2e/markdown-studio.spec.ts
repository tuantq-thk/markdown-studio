import { expect, test } from '@playwright/test'

test('works offline after the service worker caches the app', async ({ page, context }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Chào mừng đến Markdown Studio' })).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker?.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Chào mừng đến Markdown Studio' })).toBeVisible()
  await context.setOffline(false)
})

test('restores a validated workspace backup', async ({ page }) => {
  await page.goto('./')
  page.on('dialog', (dialog) => dialog.accept())
  await page.locator('input[accept*="application/json"]').setInputFiles({
    name: 'workspace.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
      format: 'markdown-studio-workspace', version: 1, exportedAt: new Date().toISOString(),
      documents: [{ id: 'restored', name: 'restored.md', path: 'Docs/restored.md', content: '# Restored workspace', updatedAt: Date.now() }],
      folders: ['Docs'], activeId: 'restored', settings: { theme: 'light', allowRemoteImages: false, sidebarWidth: 300, tocWidth: 240 },
    })),
  })
  await expect(page.getByRole('heading', { name: 'Restored workspace' })).toBeVisible()
})

test('resizes and remembers the sidebar width', async ({ page }) => {
  await page.goto('./')
  const handle = page.getByRole('separator', { name: 'Thay đổi độ rộng thư viện' })
  const box = await handle.boundingBox()
  if (!box) throw new Error('Resize handle is not visible')
  await page.mouse.move(box.x + 2, box.y + 50)
  await page.mouse.down()
  await page.mouse.move(box.x + 70, box.y + 50)
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => Number(localStorage.getItem('sidebarWidth')))).toBeGreaterThan(300)
})

test('production assets use GitHub Pages-safe relative URLs', async ({ page }) => {
  const responses: number[] = []
  page.on('response', (response) => { if (response.status() >= 400) responses.push(response.status()) })
  await page.goto('./')
  await expect(page).toHaveTitle(/Markdown Studio/)
  expect(responses).toEqual([])
  const sources = await page.locator('script[src],link[href]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') || node.getAttribute('href')).filter(Boolean))
  expect(sources.every((source) => source!.startsWith('./') || source!.startsWith('data:'))).toBe(true)
})
