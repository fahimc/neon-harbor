import { describe, expect, it } from 'vitest'
import { vehicleProfileForId, vehicleProfiles } from './vehicles'

describe('procedural vehicle profiles', () => {
  it('generates deterministic profiles from ids', () => {
    expect(vehicleProfileForId('traffic:7')).toEqual(vehicleProfileForId('traffic:7'))
  })

  it('keeps vehicle dimensions in mobile-friendly bounds', () => {
    vehicleProfiles(20).forEach((profile) => {
      expect(profile.body[0]).toBeGreaterThanOrEqual(2)
      expect(profile.body[0]).toBeLessThanOrEqual(2.35)
      expect(profile.body[2]).toBeGreaterThanOrEqual(4.4)
      expect(profile.body[2]).toBeLessThanOrEqual(4.75)
    })
  })

  it('uses liveries and paint variation', () => {
    const profiles = vehicleProfiles(16)
    expect(new Set(profiles.map((profile) => profile.paint)).size).toBeGreaterThan(3)
    expect(new Set(profiles.map((profile) => profile.livery)).size).toBeGreaterThan(2)
  })
})
