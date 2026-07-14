import { describe, expect, it } from 'vitest'
import { collides, normalizeInput, stepMotion, type PlayerMotion } from './movement'

const state = (mode: 'foot' | 'car' = 'foot'): PlayerMotion => ({ position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, heading: 0, grounded: true, mode })
const input = { x: 0, z: 0, sprint: false, jump: false, cameraHeading: 0 }

describe('character and vehicle controls', () => {
  it('normalizes diagonal input to prevent a speed advantage', () => { const value = normalizeInput(1, 1); expect(Math.hypot(value.x, value.z)).toBeCloseTo(1) })
  it('keeps analogue input magnitude below one', () => { expect(normalizeInput(.25, -.4)).toEqual({ x: .25, z: -.4 }) })
  it('moves forward relative to the camera', () => { const next = stepMotion(state(), { ...input, z: 1 }, 1 / 60); expect(next.position.z).toBeGreaterThan(0); expect(next.heading).toBeCloseTo(0) })
  it('rotates movement with the camera heading', () => { const next = stepMotion(state(), { ...input, z: 1, cameraHeading: Math.PI / 2 }, 1 / 30); expect(next.position.x).toBeGreaterThan(0); expect(Math.abs(next.position.z)).toBeLessThan(next.position.x) })
  it('accelerates smoothly rather than teleporting to full speed', () => { const first = stepMotion(state(), { ...input, z: 1 }, 1 / 60); expect(first.velocity.z).toBeGreaterThan(0); expect(first.velocity.z).toBeLessThan(5.2) })
  it('caps walk speed', () => { let current = state(); for (let i = 0; i < 300; i++) current = stepMotion(current, { ...input, z: 1 }, 1 / 60); expect(Math.hypot(current.velocity.x, current.velocity.z)).toBeLessThanOrEqual(5.21) })
  it('gives sprinting a higher maximum speed', () => { let walk = state(), run = state(); for (let i = 0; i < 240; i++) { walk = stepMotion(walk, { ...input, z: 1 }, 1 / 60); run = stepMotion(run, { ...input, z: 1, sprint: true }, 1 / 60) } expect(run.velocity.z).toBeGreaterThan(walk.velocity.z) })
  it('jumps only while grounded and returns to ground', () => { let current = stepMotion(state(), { ...input, jump: true }, 1 / 60); expect(current.position.y).toBeGreaterThan(0); const airborneVelocity = current.velocity.y; current = stepMotion(current, { ...input, jump: true }, 1 / 60); expect(current.velocity.y).toBeLessThan(airborneVelocity); for (let i = 0; i < 180; i++) current = stepMotion(current, input, 1 / 60); expect(current.grounded).toBe(true); expect(current.position.y).toBe(0) })
  it('slides along obstacles on an unblocked axis', () => { const current = { ...state(), position: { x: 0, y: 0, z: 0 }, velocity: { x: 5, y: 0, z: 2 } }; const next = stepMotion(current, input, .05, [{ x: .7, z: 0, halfX: .2, halfZ: 1 }]); expect(next.position.x).toBe(0); expect(next.position.z).toBeGreaterThan(0) })
  it('detects a circular player against expanded AABBs', () => { expect(collides(1.4, 0, .5, [{ x: 0, z: 0, halfX: 1, halfZ: 1 }])).toBe(true); expect(collides(2, 0, .5, [{ x: 0, z: 0, halfX: 1, halfZ: 1 }])).toBe(false) })
  it('clamps large frame gaps to keep physics stable', () => { const a = stepMotion(state(), { ...input, z: 1 }, 2); const b = stepMotion(state(), { ...input, z: 1 }, .05); expect(a).toEqual(b) })
  it('makes cars faster and prevents car jumping', () => { let car = state('car'); for (let i = 0; i < 300; i++) car = stepMotion(car, { ...input, z: 1, jump: true }, 1 / 60); expect(car.velocity.z).toBeGreaterThan(8.6); expect(car.position.y).toBe(0) })
  it('drives cars along their own heading instead of the camera heading', () => { let car = state('car'); for (let i = 0; i < 90; i++) car = stepMotion(car, { ...input, z: 1, cameraHeading: Math.PI / 2 }, 1 / 60); expect(car.position.z).toBeGreaterThan(Math.abs(car.position.x) * 4); expect(car.heading).toBeCloseTo(0) })
  it('uses left and right as steering without lateral car strafing', () => { let car = state('car'); for (let i = 0; i < 120; i++) car = stepMotion(car, { ...input, x: 1, z: 1 }, 1 / 60); const speed = Math.hypot(car.velocity.x, car.velocity.z); const sideSlip = Math.abs(car.velocity.x * Math.cos(car.heading) - car.velocity.z * Math.sin(car.heading)); expect(car.heading).toBeGreaterThan(.2); expect(speed).toBeGreaterThan(2); expect(sideSlip / speed).toBeLessThan(.18) })
})
