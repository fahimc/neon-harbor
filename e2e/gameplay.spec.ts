import { expect, test, type Page } from '@playwright/test'

type GameDebug = {
  frame: number
  lighting: { ambient: number; hemisphere: number; sun: number; exposure: number }
  render: { calls: number; triangles: number }
  motion: {
    position: { x: number; y: number; z: number }
    velocity: { x: number; y: number; z: number }
    mode: 'foot' | 'car'
  }
}

async function debugState(page: Page) {
  return page.evaluate(() => (window as typeof window & { __NEON_E2E__: GameDebug }).__NEON_E2E__)
}

test('world is lit, character moves smoothly, and Drive enters a working car', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /enter the city/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()

  await expect(page.getByText('CURRENT MISSION')).toBeVisible({ timeout: 15_000 })
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __NEON_E2E__?: GameDebug }).__NEON_E2E__
    return Boolean(debug && debug.frame > 2 && debug.render.calls > 0 && debug.render.triangles > 0)
  })

  const scene = await debugState(page)
  expect(scene.lighting.ambient).toBeGreaterThanOrEqual(1.5)
  expect(scene.lighting.hemisphere).toBeGreaterThanOrEqual(2)
  expect(scene.lighting.sun).toBeGreaterThanOrEqual(2.5)
  expect(scene.lighting.exposure).toBeGreaterThanOrEqual(1.2)

  const start = scene.motion.position
  const samples: GameDebug['motion']['position'][] = []
  await page.keyboard.down('KeyW')
  for (let index = 0; index < 16; index += 1) {
    await page.waitForTimeout(35)
    samples.push((await debugState(page)).motion.position)
  }
  await page.keyboard.up('KeyW')

  const end = samples.at(-1)!
  const distance = Math.hypot(end.x - start.x, end.z - start.z)
  const uniquePositions = new Set(samples.map((point) => `${point.x.toFixed(3)},${point.z.toFixed(3)}`))
  expect(distance).toBeGreaterThan(0.5)
  expect(uniquePositions.size).toBeGreaterThanOrEqual(8)

  await page.getByRole('button', { name: 'Enter vehicle' }).click()
  await expect(page.getByRole('button', { name: 'Exit vehicle' })).toBeVisible()
  await page.waitForTimeout(500)
  expect((await debugState(page)).motion.mode).toBe('car')

  const carStart = (await debugState(page)).motion.position
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(900)
  const car = (await debugState(page)).motion
  await page.keyboard.up('KeyW')
  expect(car.mode).toBe('car')
  expect(Math.hypot(car.position.x - carStart.x, car.position.z - carStart.z)).toBeGreaterThan(1)
  expect(Math.hypot(car.velocity.x, car.velocity.z)).toBeGreaterThan(2)
})
