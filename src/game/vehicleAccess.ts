export type VehicleAccessKind = 'none' | 'parked' | 'traffic'

export interface VehicleAccessTarget {
  kind: VehicleAccessKind
  x: number
  z: number
  heading: number
  occupied: boolean
  prompt: string
}

export const DEFAULT_VEHICLE_ACCESS: VehicleAccessTarget = {
  kind: 'none',
  x: 0,
  z: 0,
  heading: 0,
  occupied: false,
  prompt: 'Find a car · Press E / F or tap DRIVE near a vehicle',
}

let currentTarget: VehicleAccessTarget = DEFAULT_VEHICLE_ACCESS

export function setVehicleAccessTarget(target: VehicleAccessTarget) {
  currentTarget = target
}

export function getVehicleAccessTarget() {
  return currentTarget
}
