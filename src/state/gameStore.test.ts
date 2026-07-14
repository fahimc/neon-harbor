import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { DEFAULT_VEHICLE_ACCESS, setVehicleAccessTarget } from '../game/vehicleAccess'

describe('vehicle access store actions', () => {
  beforeEach(() => {
    useGameStore.getState().resetSave()
    setVehicleAccessTarget(DEFAULT_VEHICLE_ACCESS)
  })

  it('enters a targeted parked car without raising wanted level', () => {
    setVehicleAccessTarget({ kind: 'parked', x: 12, z: -7, heading: Math.PI / 2, occupied: false, prompt: 'Press E / F or tap DRIVE to enter this car' })
    useGameStore.getState().toggleVehicle()
    const state = useGameStore.getState()
    expect(state.motion.mode).toBe('car')
    expect(state.motion.position).toEqual({ x: 12, y: 0, z: -7 })
    expect(state.motion.heading).toBeCloseTo(Math.PI / 2)
    expect(state.wanted).toBe(0)
  })

  it('pulls a traffic driver out and marks the car as stolen', () => {
    setVehicleAccessTarget({ kind: 'traffic', x: -18, z: 33, heading: Math.PI, occupied: true, prompt: 'Press E / F or tap HIJACK to pull the driver out' })
    useGameStore.getState().toggleVehicle()
    const state = useGameStore.getState()
    expect(state.motion.mode).toBe('car')
    expect(state.motion.position).toEqual({ x: -18, y: 0, z: 33 })
    expect(state.motion.heading).toBeCloseTo(Math.PI)
    expect(state.wanted).toBeGreaterThanOrEqual(1)
    expect(state.mission).toBe('BOOSTED RIDE')
  })
})
