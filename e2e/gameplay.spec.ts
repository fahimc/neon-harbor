import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

type GameDebug = {
  frame: number
  input: { x: number; z: number; cameraHeading: number; handbrake: boolean; horn: boolean; headlights: boolean }
  visuals: {
    rendering: string
    characterAction: string
    legPose: [number, number, number, number]
    carForward: { x: number; z: number }
    vehicle: { gear: 'P' | 'D' | 'R'; damage: number; handbrake: boolean; headlights: boolean; horn: boolean; lastImpact: number }
    traffic: { count: number; braking: number }
  }
  render: { calls: number; triangles: number }
  motion: {
    position: { x: number; y: number; z: number }
    velocity: { x: number; y: number; z: number }
    mode: 'foot' | 'car'
  }
}

function worldLuminance(screenshot: Buffer) {
  const png = PNG.sync.read(screenshot)
  const bounds = {
    left: Math.floor(png.width * .28), right: Math.floor(png.width * .72),
    top: Math.floor(png.height * .3), bottom: Math.floor(png.height * .72),
  }
  let luminance = 0
  let pixels = 0
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const offset = (y * png.width + x) * 4
      luminance += png.data[offset] * .2126 + png.data[offset + 1] * .7152 + png.data[offset + 2] * .0722
      pixels += 1
    }
  }
  return luminance / pixels
}

async function debugState(page: Page) {
  return page.evaluate(() => (window as typeof window & { __NEON_E2E__: GameDebug }).__NEON_E2E__)
}

async function holdButton(page: Page, name: string, ms: number) {
  const button = page.getByRole('button', { name })
  const box = await button.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  const samples: GameDebug[] = []
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    await page.waitForTimeout(50)
    samples.push(await debugState(page))
  }
  await page.mouse.up()
  return samples
}

test.setTimeout(45_000)

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
  expect(scene.visuals.rendering).toBe('bright-day-mobile')
  expect(worldLuminance(await page.screenshot())).toBeGreaterThan(90)

  const controlStart = scene.motion.position
  await page.keyboard.down('KeyA')
  await page.waitForTimeout(350)
  let controlSample = await debugState(page)
  await page.keyboard.up('KeyA')
  expect(controlSample.input.x).toBeGreaterThan(0)
  expect(controlSample.motion.position.x).toBeLessThan(controlStart.x)
  const afterLeft = controlSample.motion.position

  await page.keyboard.down('KeyD')
  await page.waitForTimeout(350)
  controlSample = await debugState(page)
  await page.keyboard.up('KeyD')
  expect(controlSample.input.x).toBeLessThan(0)
  expect(controlSample.motion.position.x).toBeGreaterThan(afterLeft.x)

  const start = (await debugState(page)).motion.position
  const samples: GameDebug['motion']['position'][] = []
  const legSamples: GameDebug['visuals']['legPose'][] = []
  const actionSamples: string[] = []
  await page.keyboard.down('KeyW')
  for (let index = 0; index < 16; index += 1) {
    await page.waitForTimeout(35)
    const sample = await debugState(page)
    samples.push(sample.motion.position)
    legSamples.push(sample.visuals.legPose)
    actionSamples.push(sample.visuals.characterAction)
  }
  await page.keyboard.up('KeyW')

  const end = samples.at(-1)!
  const distance = Math.hypot(end.x - start.x, end.z - start.z)
  const uniquePositions = new Set(samples.map((point) => `${point.x.toFixed(3)},${point.z.toFixed(3)}`))
  expect(distance).toBeGreaterThan(0.5)
  expect(uniquePositions.size).toBeGreaterThanOrEqual(8)
  expect(actionSamples).toContain('walk')
  expect(new Set(legSamples.map((pose) => pose.map((value) => value.toFixed(3)).join(','))).size).toBeGreaterThanOrEqual(5)

  await page.getByRole('button', { name: 'Enter vehicle' }).click()
  await expect(page.getByRole('button', { name: 'Exit vehicle' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Handbrake' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Horn' })).toBeVisible()
  await page.getByRole('button', { name: 'Toggle headlights' }).click()
  await page.waitForTimeout(500)
  expect((await debugState(page)).motion.mode).toBe('car')
  expect((await debugState(page)).visuals.vehicle.headlights).toBe(true)
  expect((await debugState(page)).visuals.traffic.count).toBeGreaterThanOrEqual(20)

  let carStart = (await debugState(page)).motion.position
  let carSamples = await holdButton(page, 'Accelerate', 900)
  let carState = await debugState(page)
  let car = carState.motion
  let carDelta = { x: car.position.x - carStart.x, z: car.position.z - carStart.z }
  let carDistance = Math.hypot(carDelta.x, carDelta.z)
  if (carDistance <= 1) {
    carStart = car.position
    carSamples = await holdButton(page, 'Brake or reverse', 900)
    carState = await debugState(page)
    car = carState.motion
    carDelta = { x: car.position.x - carStart.x, z: car.position.z - carStart.z }
    carDistance = Math.hypot(carDelta.x, carDelta.z)
  }
  expect(car.mode).toBe('car')
  expect(carDistance).toBeGreaterThan(1)
  expect(Math.max(...carSamples.map((sample) => Math.hypot(sample.motion.velocity.x, sample.motion.velocity.z)))).toBeGreaterThan(2)
  expect(carSamples.some((sample) => sample.visuals.vehicle.gear === 'D' || sample.visuals.vehicle.gear === 'R')).toBe(true)
  const forwardAlignment = (carDelta.x * carState.visuals.carForward.x + carDelta.z * carState.visuals.carForward.z) / carDistance
  expect(Math.abs(forwardAlignment)).toBeGreaterThan(.85)

  const handbrakeSamples = await holdButton(page, 'Handbrake', 300)
  expect(handbrakeSamples.some((sample) => sample.visuals.vehicle.handbrake)).toBe(true)
  expect((await debugState(page)).visuals.vehicle.handbrake).toBe(false)
  const hornSamples = await holdButton(page, 'Horn', 200)
  expect(hornSamples.some((sample) => sample.visuals.vehicle.horn)).toBe(true)
  expect((await debugState(page)).visuals.vehicle.horn).toBe(false)
})
