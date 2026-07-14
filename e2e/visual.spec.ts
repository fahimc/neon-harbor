import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

type GameDebug = {
  frame: number
  visuals: { rendering: string }
  render: { calls: number; triangles: number }
}

type Region = { left: number; top: number; right: number; bottom: number }

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
      if (g > 145 && b > 145 && r < 120) cyan += 1
      if (r > 170 && g > 145 && b < 120) tan += 1
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

test.describe('gameplay visual rendering', () => {
  test('desktop scene is bright and the HUD controls are visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await openGame(page)

    const screen = decode(await page.screenshot())
    const canvas = decode(await page.locator('canvas').screenshot())
    const world = inspectRegion(canvas, regionFromRatios(canvas, { left: .22, top: .2, right: .82, bottom: .82 }))
    const driveButton = inspectRegion(screen, regionFromRatios(screen, { left: .78, top: .78, right: .88, bottom: .98 }))
    const minimap = inspectRegion(screen, regionFromRatios(screen, { left: .86, top: .76, right: .99, bottom: .99 }))

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
})
