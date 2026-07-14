import { describe, expect, it } from 'vitest'
import { trafficAt } from './traffic'

describe('pooled traffic simulation', () => {
  it('creates the requested fixed fleet', () => { expect(trafficAt(0, 0, 0, 24)).toHaveLength(24) })
  it('is deterministic at a given time and origin', () => { expect(trafficAt(12.5, 20, -40)).toEqual(trafficAt(12.5, 20, -40)) })
  it('moves every car forward over time', () => { const before = trafficAt(0, 0, 0); const after = trafficAt(1, 0, 0); after.forEach((car, i) => expect(car.x !== before[i].x || car.z !== before[i].z).toBe(true)) })
  it('uses valid lane headings', () => { trafficAt(4, 0, 0).forEach((car) => expect([0, Math.PI, Math.PI / 2, -Math.PI / 2]).toContain(car.heading)) })
  it('marks traffic lights, lanes, speeds and braking state', () => { const traffic = trafficAt(4, 0, 0); expect(traffic.every((car) => car.headlights && car.speed > 0 && car.lane >= 0)).toBe(true); expect(traffic.some((car) => car.brake)).toBe(true) })
  it('wraps within the streamed five-chunk area', () => { trafficAt(99999, 0, 0).forEach((car) => { expect(Math.abs(car.x)).toBeLessThanOrEqual(250); expect(Math.abs(car.z)).toBeLessThanOrEqual(250) }) })
})
