import { CHUNK_SIZE } from './world'

export interface TrafficCar { id: number; x: number; z: number; heading: number; color: string }
const COLORS = ['#fa3155', '#27d6c5', '#ffd257', '#e8edf4', '#27324d']

export function trafficAt(timeSeconds: number, centerX: number, centerZ: number, count = 18): TrafficCar[] {
  const span = CHUNK_SIZE * 5
  const originX = Math.floor(centerX / CHUNK_SIZE) * CHUNK_SIZE
  const originZ = Math.floor(centerZ / CHUNK_SIZE) * CHUNK_SIZE
  return Array.from({ length: count }, (_, id) => {
    const horizontal = id % 2 === 0
    const speed = 8 + (id % 5) * 1.3
    const progress = ((timeSeconds * speed + id * 37) % span + span) % span - span / 2
    if (horizontal) return { id, x: originX + progress, z: originZ + 10 + (id % 5 - 2) * CHUNK_SIZE, heading: Math.PI / 2, color: COLORS[id % COLORS.length] }
    return { id, x: originX + 10 + (id % 5 - 2) * CHUNK_SIZE, z: originZ + progress, heading: 0, color: COLORS[id % COLORS.length] }
  })
}
