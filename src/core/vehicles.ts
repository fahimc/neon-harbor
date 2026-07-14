export type VehicleClass = 'sport' | 'muscle' | 'suv' | 'taxi'
export type VehicleLivery = 'stripe' | 'offset-stripe' | 'two-tone' | 'checker'

export interface VehicleProfile {
  id: string
  className: VehicleClass
  paint: string
  trim: string
  stripe: string
  livery: VehicleLivery
  body: [number, number, number]
  cabin: { position: [number, number, number]; scale: [number, number, number] }
  spoiler: boolean
}

const PAINTS = ['#ff315d', '#06d6a0', '#118ab2', '#ffd166', '#f8f9fa', '#4b5d86', '#f97316', '#a855f7']
const STRIPES = ['#ffffff', '#111827', '#23e6d0', '#ffd166', '#ff3f7f']
const CLASSES: VehicleClass[] = ['sport', 'muscle', 'suv', 'taxi']
const LIVERIES: VehicleLivery[] = ['stripe', 'offset-stripe', 'two-tone', 'checker']

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pick<T>(items: T[], seed: number, offset: number) {
  return items[(seed + offset) % items.length]
}

export function vehicleProfileForId(id: string, preferredPaint?: string): VehicleProfile {
  const seed = hashText(id)
  const className = pick(CLASSES, seed, 0)
  const livery = className === 'taxi' ? 'checker' : pick(LIVERIES, seed >>> 4, 1)
  const paint = preferredPaint ?? (className === 'taxi' ? '#ffd166' : pick(PAINTS, seed >>> 8, 2))
  const stripe = pick(STRIPES, seed >>> 12, 3)
  const trim = className === 'sport' ? '#111827' : '#263c58'
  const body: [number, number, number] = className === 'suv' ? [2.25, 1.32, 4.55] : className === 'muscle' ? [2.35, 1.12, 4.75] : [2.05, 1.02, 4.45]
  const cabin = className === 'suv'
    ? { position: [0, .78, -.25] as [number, number, number], scale: [1.78, .8, 2.25] as [number, number, number] }
    : { position: [0, .76, -.45] as [number, number, number], scale: [1.55, .68, 1.75] as [number, number, number] }
  return { id, className, paint, trim, stripe, livery, body, cabin, spoiler: className === 'sport' || (seed & 3) === 0 }
}

export function vehicleProfiles(count: number, prefix = 'vehicle') {
  return Array.from({ length: count }, (_, index) => vehicleProfileForId(`${prefix}:${index}`))
}
