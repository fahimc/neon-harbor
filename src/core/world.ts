export const CHUNK_SIZE = 96
export const DEFAULT_SEED = 27031986

export type District = 'South Beach' | 'Ocean Drive' | 'Little Havana' | 'Downtown' | 'Port Harbor' | 'Everglade Edge'
export type WorldAssetKind = 'tower' | 'hotel' | 'house' | 'shop' | 'palm' | 'tree' | 'streetlight' | 'parkedCar'

export interface WorldAsset {
  id: string
  kind: WorldAssetKind
  x: number
  z: number
  rotation: number
  scale: [number, number, number]
  color: string
}

export interface WorldChunk {
  key: string
  cx: number
  cz: number
  district: District
  isWater: boolean
  roads: Array<{ x: number; z: number; width: number; depth: number; rotation: number }>
  assets: WorldAsset[]
}

const BUILDING_COLORS = ['#f7b2c4', '#f6e6c9', '#7fd3c7', '#9ebee8', '#f2a65a', '#d9b8ff']
const CAR_COLORS = ['#ef476f', '#06d6a0', '#118ab2', '#ffd166', '#f8f9fa', '#4b5d86']

export function hash2d(x: number, z: number, seed = DEFAULT_SEED) {
  let h = Math.imul(x ^ seed, 0x45d9f3b) ^ Math.imul(z + seed, 0x119de1f3)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function rngFor(cx: number, cz: number, seed: number) {
  let state = Math.floor(hash2d(cx, cz, seed) * 0xffffffff) || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function coastlineX(z: number) {
  return -175 + Math.sin(z / 210) * 28 + Math.sin(z / 73) * 9
}

export function districtAt(x: number, z: number): District {
  if (x < coastlineX(z) + 35) return 'South Beach'
  if (x < -40) return 'Ocean Drive'
  if (z > 260) return 'Everglade Edge'
  if (z < -230) return 'Port Harbor'
  if (x > 220) return 'Little Havana'
  return 'Downtown'
}

export function getChunkKey(cx: number, cz: number) { return `${cx}:${cz}` }

export function chunksAround(x: number, z: number, radius: number) {
  const cx = Math.floor(x / CHUNK_SIZE)
  const cz = Math.floor(z / CHUNK_SIZE)
  const chunks: Array<[number, number]> = []
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) chunks.push([cx + dx, cz + dz])
  }
  return chunks
}

export function generateChunk(cx: number, cz: number, seed = DEFAULT_SEED): WorldChunk {
  const rand = rngFor(cx, cz, seed)
  const ox = cx * CHUNK_SIZE
  const oz = cz * CHUNK_SIZE
  const centerX = ox + CHUNK_SIZE / 2
  const centerZ = oz + CHUNK_SIZE / 2
  const isWater = centerX < coastlineX(centerZ)
  const district = districtAt(centerX, centerZ)
  const roads = isWater ? [] : [
    { x: centerX, z: oz + 14, width: CHUNK_SIZE, depth: 16, rotation: 0 },
    { x: ox + 14, z: centerZ, width: 16, depth: CHUNK_SIZE, rotation: 0 },
  ]
  const assets: WorldAsset[] = []
  if (!isWater) {
    const lots = [[34, 35], [68, 35], [34, 69], [68, 69]]
    for (let i = 0; i < lots.length; i++) {
      const [lx, lz] = lots[i]
      const x = ox + lx + (rand() - .5) * 7
      const z = oz + lz + (rand() - .5) * 7
      const downtown = district === 'Downtown'
      const kind: WorldAssetKind = downtown && rand() > .35 ? 'tower' : district === 'Ocean Drive' ? 'hotel' : rand() > .63 ? 'shop' : 'house'
      const height = kind === 'tower' ? 24 + rand() * 44 : kind === 'hotel' ? 13 + rand() * 16 : 5 + rand() * 5
      assets.push({ id: `${cx}:${cz}:b${i}`, kind, x, z, rotation: Math.round(rand()) * Math.PI / 2, scale: [18 + rand() * 7, height, 17 + rand() * 7], color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)] })
      if (rand() > .36) assets.push({ id: `${cx}:${cz}:p${i}`, kind: 'palm', x: x + (rand() > .5 ? 14 : -14), z: z + (rand() - .5) * 17, rotation: rand() * Math.PI * 2, scale: [1, 5 + rand() * 2, 1], color: '#54b56b' })
    }
    for (let i = 0; i < 4; i++) assets.push({ id: `${cx}:${cz}:l${i}`, kind: 'streetlight', x: ox + 23 + i * 21, z: oz + 23, rotation: 0, scale: [1, 1, 1], color: '#ddeeff' })
    for (let i = 0; i < 3; i++) assets.push({ id: `${cx}:${cz}:c${i}`, kind: 'parkedCar', x: ox + 32 + i * 21, z: oz + 20, rotation: 0, scale: [1, 1, 1], color: CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)] })
  }
  return { key: getChunkKey(cx, cz), cx, cz, district, isWater, roads, assets }
}

export function estimateDrawCalls(chunks: WorldChunk[]) {
  const kinds = new Set<WorldAssetKind>()
  let roadCount = 0
  for (const chunk of chunks) {
    roadCount += chunk.roads.length
    chunk.assets.forEach((asset) => kinds.add(asset.kind))
  }
  return kinds.size + (roadCount ? 2 : 0) + 4
}

export class ChunkCache {
  private cache = new Map<string, WorldChunk>()
  constructor(private readonly seed = DEFAULT_SEED, private readonly maxChunks = 81) {}
  get(cx: number, cz: number) {
    const key = getChunkKey(cx, cz)
    let chunk = this.cache.get(key)
    if (!chunk) {
      chunk = generateChunk(cx, cz, this.seed)
      this.cache.set(key, chunk)
      while (this.cache.size > this.maxChunks) this.cache.delete(this.cache.keys().next().value!)
    }
    return chunk
  }
  get size() { return this.cache.size }
}
