import { describe, expect, it } from 'vitest'
import { CHUNK_SIZE, ChunkCache, chunksAround, coastlineX, districtAt, estimateDrawCalls, generateChunk, getChunkKey } from './world'

describe('procedural world streaming', () => {
  it('uses stable 96 metre chunk coordinates', () => { expect(CHUNK_SIZE).toBe(96); expect(getChunkKey(-2, 4)).toBe('-2:4') })
  it('generates the same chunk from the same seed', () => { expect(generateChunk(3, -7, 42)).toEqual(generateChunk(3, -7, 42)) })
  it('changes placement when the seed changes', () => { expect(generateChunk(3, -7, 42).assets).not.toEqual(generateChunk(3, -7, 43).assets) })
  it('never places city assets in a water chunk', () => { const chunk = generateChunk(-10, 0); expect(chunk.isWater).toBe(true); expect(chunk.assets).toHaveLength(0); expect(chunk.roads).toHaveLength(0) })
  it('puts roads and reusable scenery in land chunks', () => { const chunk = generateChunk(2, 1); expect(chunk.isWater).toBe(false); expect(chunk.roads.length).toBeGreaterThanOrEqual(2); expect(chunk.assets.some((a) => a.kind === 'palm')).toBe(true) })
  it('keeps buildings out of both road corridors', () => { const chunk = generateChunk(0, 0); const buildings = chunk.assets.filter((a) => ['tower','hotel','house','shop'].includes(a.kind)); for (const b of buildings) { expect(Math.abs(b.z - 14)).toBeGreaterThan(12); expect(Math.abs(b.x - 14)).toBeGreaterThan(12) } })
  it('returns a square streaming window around the player', () => { const coords = chunksAround(191, -1, 2); expect(coords).toHaveLength(25); expect(coords).toContainEqual([1, -1]); expect(coords).toContainEqual([3, 1]) })
  it('assigns named districts from world geography', () => { expect(districtAt(coastlineX(0) - 10, 0)).toBe('South Beach'); expect(districtAt(0, 0)).toBe('Downtown'); expect(districtAt(230, 0)).toBe('Little Havana'); expect(districtAt(0, -300)).toBe('Port Harbor') })
  it('bounds cached chunks so an infinite journey has finite memory', () => { const cache = new ChunkCache(1, 9); for (let x = 0; x < 100; x++) cache.get(x, 0); expect(cache.size).toBe(9) })
  it('reuses the cached object for a loaded chunk', () => { const cache = new ChunkCache(); expect(cache.get(2, 2)).toBe(cache.get(2, 2)) })
  it('keeps estimated world draw calls bounded as chunks grow', () => { const small = [generateChunk(0, 0)]; const large = chunksAround(0, 0, 3).map(([x,z]) => generateChunk(x,z)); expect(estimateDrawCalls(large)).toBeLessThanOrEqual(estimateDrawCalls(small) + 8); expect(estimateDrawCalls(large)).toBeLessThan(20) })
})
