import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

type GameDebug = {
  frame: number
  visuals: { rendering: string }
  render: { calls: number; triangles: number }
}

type Region = { left: number; top: number; right: number; bottom: number }

test.setTimeout(90_000)

async function openGame(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /enter the city/i }).click()
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByText('CURRENT MISSION')).toBeVisible({ timeout: 15_000 })
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __NEON_E2E__?: GameDebug }).__NEON_E2E__
    return Boolean(debug && debug.frame > 4 && debug.render.calls > 0 && debug.render.triangles > 0)
  })
}

function decode(image: Buffer) {
  return PNG.sync.read(image)
}

function regionFromRatios(png: PNG, ratios: Region): Region {
  return {
    left: Math.floor(png.width * ratios.left),
    top: Math.floor(png.height * ratios.top),
    right: Math.floor(png.width * ratios.right),
    bottom: Math.floor(png.height * ratios.bottom),
  }
}

function regionFromBox(png: PNG, box: { x: number; y: number; width: number; height: number }): Region {
  return {
    left: Math.max(0, Math.floor(box.x)),
    top: Math.max(0, Math.floor(box.y)),
    right: Math.min(png.width, Math.ceil(box.x + box.width)),
    bottom: Math.min(png.height, Math.ceil(box.y + box.height)),
  }
}

function inspectRegion(png: PNG, region: Region) {
  let luminance = 0
  let dark = 0
  let pink = 0
  let cyan = 0
  let tan = 0
  let pixels = 0

  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1) {
      const offset = (y * png.width + x) * 4
      const r = png.data[offset]
      const g = png.data[offset + 1]
      const b = png.data[offset + 2]
      const luma = r * .2126 + g * .7152 + b * .0722
      luminance += luma
      if (luma < 25) dark += 1
      if (r > 180 && g < 100 && b > 90) pink += 1
      if (g > 120 && b > 130 && r < 120) cyan += 1
      if (r > 150 && g > 125 && b < 170) tan += 1
      pixels += 1
    }
  }

  return {
    luminance: luminance / pixels,
    darkRatio: dark / pixels,
    pinkRatio: pink / pixels,
    cyanRatio: cyan / pixels,
    tanRatio: tan / pixels,
  }
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

test.describe('gameplay visual rendering', () => {
  test('desktop scene is bright and the HUD controls are visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await openGame(page)

    const screen = decode(await page.screenshot())
    const canvas = decode(await page.locator('canvas').screenshot())
    const world = inspectRegion(canvas, regionFromRatios(canvas, { left: .22, top: .2, right: .82, bottom: .82 }))
    const driveButton = inspectRegion(screen, regionFromRatios(screen, { left: .78, top: .78, right: .88, bottom: .98 }))
    const minimapBox = await page.getByRole('button', { name: 'Open map' }).boundingBox()
    expect(minimapBox).toBeTruthy()
    const minimap = inspectRegion(screen, regionFromBox(screen, minimapBox!))

    const debug = await page.evaluate(() => (window as typeof window & { __NEON_E2E__: GameDebug }).__NEON_E2E__)
    expect(debug.visuals.rendering).toBe('bright-day-mobile')
    expect(world.luminance).toBeGreaterThan(90)
    expect(world.darkRatio).toBeLessThan(.38)
    expect(driveButton.pinkRatio).toBeGreaterThan(.05)
    expect(minimap.cyanRatio + minimap.tanRatio).toBeGreaterThan(.05)
  })

  test('mobile landscape keeps the scene readable behind the touch UI', async ({ page }) => {
    await page.setViewportSize({ width: 896, height: 414 })
    await openGame(page)

    const screen = decode(await page.screenshot())
    const canvas = decode(await page.locator('canvas').screenshot())
    const centerWorld = inspectRegion(canvas, regionFromRatios(canvas, { left: .25, top: .24, right: .78, bottom: .78 }))
    const joystick = inspectRegion(screen, regionFromRatios(screen, { left: .02, top: .62, right: .22, bottom: .98 }))
    const actionButtons = inspectRegion(screen, regionFromRatios(screen, { left: .68, top: .62, right: .98, bottom: .99 }))

    expect(centerWorld.luminance).toBeGreaterThan(85)
    expect(centerWorld.darkRatio).toBeLessThan(.42)
    expect(joystick.luminance).toBeGreaterThan(18)
    expect(actionButtons.pinkRatio).toBeGreaterThan(.025)
  })

  test('mobile car mode uses separated driving controls', async ({ page }) => {
    await page.setViewportSize({ width: 896, height: 414 })
    await openGame(page)
    await page.getByRole('button', { name: 'Enter vehicle' }).click()

    await expect(page.getByRole('button', { name: 'Accelerate' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Brake or reverse' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Handbrake' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Horn' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Toggle headlights' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exit vehicle' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jump' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sprint' })).toHaveCount(0)

    const minimap = await page.getByRole('button', { name: 'Open map' }).boundingBox()
    const speedometer = await page.locator('.speedometer').boundingBox()
    const accelerate = await page.getByRole('button', { name: 'Accelerate' }).boundingBox()
    const brake = await page.getByRole('button', { name: 'Brake or reverse' }).boundingBox()
    const handbrake = await page.getByRole('button', { name: 'Handbrake' }).boundingBox()
    const horn = await page.getByRole('button', { name: 'Horn' }).boundingBox()
    const headlights = await page.getByRole('button', { name: 'Toggle headlights' }).boundingBox()
    const exit = await page.getByRole('button', { name: 'Exit vehicle' }).boundingBox()
    expect(minimap && speedometer && accelerate && brake && handbrake && horn && headlights && exit).toBeTruthy()

    for (const control of [accelerate!, brake!, handbrake!, horn!, headlights!, exit!]) {
      expect(overlaps(control, minimap!)).toBe(false)
      expect(overlaps(control, speedometer!)).toBe(false)
    }

    const screen = decode(await page.screenshot())
    const pedals = inspectRegion(screen, regionFromRatios(screen, { left: .78, top: .66, right: .99, bottom: .99 }))
    expect(pedals.pinkRatio).toBeGreaterThan(.035)
  })
})
