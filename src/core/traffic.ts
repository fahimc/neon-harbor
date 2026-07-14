import { CHUNK_SIZE } from './world'

export interface TrafficCar { id: number; x: number; z: number; heading: number; color: string; speed: number; lane: number; brake: boolean; headlights: boolean }
export interface PedestrianYieldTarget { x: number; z: number; active: boolean }
const COLORS = ['#fa3155', '#27d6c5', '#ffd257', '#e8edf4', '#4b5d86']

export function trafficAt(timeSeconds: number, centerX: number, centerZ: number, count = 24): TrafficCar[] {
  const span = CHUNK_SIZE * 5
  const originX = Math.floor(centerX / CHUNK_SIZE) * CHUNK_SIZE
  const originZ = Math.floor(centerZ / CHUNK_SIZE) * CHUNK_SIZE
  return Array.from({ length: count }, (_, id) => {
    const horizontal = id % 2 === 0
    const direction = id % 4 < 2 ? 1 : -1
    const lane = id % 6
    const baseSpeed = 7.5 + (id % 5) * 1.4
    const rawProgress = ((timeSeconds * baseSpeed + id * 37) % span + span) % span
    const intersectionDistance = Math.abs(rawProgress % CHUNK_SIZE - CHUNK_SIZE / 2)
    const brake = intersectionDistance < 13 && id % 3 === 0
    const speed = baseSpeed * (brake ? .32 : 1)
    const progress = ((timeSeconds * speed + id * 37) % span + span) % span - span / 2
    const roadOffset = 8 + (lane % 2) * 7
    const lineOffset = (Math.floor(lane / 2) - 1) * CHUNK_SIZE
    if (horizontal) return { id, x: originX + progress * direction, z: originZ + roadOffset + lineOffset, heading: direction > 0 ? Math.PI / 2 : -Math.PI / 2, color: COLORS[id % COLORS.length], speed, lane, brake, headlights: true }
    return { id, x: originX + roadOffset + lineOffset, z: originZ + progress * direction, heading: direction > 0 ? 0 : Math.PI, color: COLORS[id % COLORS.length], speed, lane, brake, headlights: true }
  })
}

export function trafficWithPedestrianYield(cars: TrafficCar[], pedestrian: PedestrianYieldTarget, radius = 18): TrafficCar[] {
  if (!pedestrian.active) return cars
  return cars.map((car) => {
    const dx = pedestrian.x - car.x
    const dz = pedestrian.z - car.z
    const distance = Math.hypot(dx, dz)
    const forwardX = Math.sin(car.heading)
    const forwardZ = Math.cos(car.heading)
    const ahead = dx * forwardX + dz * forwardZ
    const laneDistance = Math.abs(dx * forwardZ - dz * forwardX)
    if (distance <= radius && ahead > -4 && ahead < radius + 4 && laneDistance < 7) {
      return { ...car, speed: 0, brake: true }
    }
    return car
  })
}
