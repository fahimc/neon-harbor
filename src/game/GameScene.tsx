import { useEffect, useMemo, useRef } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ChunkCache, chunksAround, districtAt, type WorldAsset, type WorldChunk } from '../core/world'
import { stepMotion, type Obstacle, type PlayerMotion } from '../core/movement'
import { trafficAt } from '../core/traffic'
import { useGameStore } from '../state/gameStore'
import { inputState, installKeyboard } from './input'

const cache = new ChunkCache()
const LIGHTING = { ambient: 1.65, hemisphere: 2.2, sun: 3, exposure: 1.3 } as const

function cloneMotion(motion: PlayerMotion): PlayerMotion {
  return { ...motion, position: { ...motion.position }, velocity: { ...motion.velocity } }
}

// Rendering and the camera use this per-frame value. Zustand is intentionally
// updated less often so the HUD stays cheap without making the world stutter.
let runtimeMotion = cloneMotion(useGameStore.getState().motion)

function setInstances(mesh: THREE.InstancedMesh | null, items: WorldAsset[], scaleMultiplier: [number, number, number] = [1, 1, 1]) {
  if (!mesh) return
  const dummy = new THREE.Object3D()
  items.forEach((item, index) => {
    dummy.position.set(item.x, item.kind === 'parkedCar' ? .65 : item.scale[1] / 2, item.z)
    dummy.rotation.y = item.rotation
    dummy.scale.set(item.scale[0] * scaleMultiplier[0], item.scale[1] * scaleMultiplier[1], item.scale[2] * scaleMultiplier[2])
    dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix); mesh.setColorAt(index, new THREE.Color(item.color))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

function InstancedWorld({ chunks }: { chunks: WorldChunk[] }) {
  const buildings = chunks.flatMap((c) => c.assets.filter((a) => ['tower', 'hotel', 'house', 'shop'].includes(a.kind)))
  const palms = chunks.flatMap((c) => c.assets.filter((a) => a.kind === 'palm'))
  const lights = chunks.flatMap((c) => c.assets.filter((a) => a.kind === 'streetlight'))
  const cars = chunks.flatMap((c) => c.assets.filter((a) => a.kind === 'parkedCar'))
  const roads = chunks.flatMap((c) => c.roads.map((r, i) => ({ ...r, id: `${c.key}:r${i}`, kind: 'shop' as const, scale: [r.width, .08, r.depth] as [number, number, number], color: '#232938' })))
  const land = chunks.filter((c) => !c.isWater).map((c) => ({ id: c.key, kind: 'shop' as const, x: c.cx * 96 + 48, z: c.cz * 96 + 48, rotation: 0, scale: [96, .1, 96] as [number, number, number], color: c.district === 'South Beach' ? '#e8d7a9' : '#4f7659' }))
  const buildingRef = useRef<THREE.InstancedMesh>(null); const palmTrunks = useRef<THREE.InstancedMesh>(null); const palmLeaves = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null); const carRef = useRef<THREE.InstancedMesh>(null); const roadRef = useRef<THREE.InstancedMesh>(null); const landRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => { setInstances(buildingRef.current, buildings); setInstances(palmTrunks.current, palms, [.45, 1, .45]); setInstances(palmLeaves.current, palms, [2.4, .18, 2.4]); setInstances(lightRef.current, lights, [.18, 6, .18]); setInstances(carRef.current, cars, [3.7, 1.2, 1.8]); setInstances(roadRef.current, roads); setInstances(landRef.current, land) }, [buildings, palms, lights, cars, roads, land])
  return <>
    <instancedMesh ref={landRef} args={[undefined, undefined, land.length]} receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial vertexColors roughness={1} /></instancedMesh>
    <instancedMesh ref={roadRef} args={[undefined, undefined, roads.length]} receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial vertexColors roughness={.95} /></instancedMesh>
    <instancedMesh ref={buildingRef} args={[undefined, undefined, buildings.length]} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial vertexColors roughness={.78} /></instancedMesh>
    <instancedMesh ref={palmTrunks} args={[undefined, undefined, palms.length]} castShadow><cylinderGeometry args={[.5, .75, 1, 6]} /><meshStandardMaterial color="#835f3b" /></instancedMesh>
    <instancedMesh ref={palmLeaves} args={[undefined, undefined, palms.length]} castShadow><sphereGeometry args={[1, 7, 4]} /><meshStandardMaterial vertexColors roughness={.9} /></instancedMesh>
    <instancedMesh ref={lightRef} args={[undefined, undefined, lights.length]}><cylinderGeometry args={[.5, .5, 1, 6]} /><meshStandardMaterial color="#8790a1" metalness={.8} /></instancedMesh>
    <instancedMesh ref={carRef} args={[undefined, undefined, cars.length]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial vertexColors metalness={.55} roughness={.34} /></instancedMesh>
  </>
}

function Traffic({ position }: { position: { x: number; z: number } }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useFrame(({ clock }) => {
    if (!mesh.current) return
    const dummy = new THREE.Object3D()
    trafficAt(clock.elapsedTime, position.x, position.z).forEach((car, i) => { dummy.position.set(car.x, .8, car.z); dummy.rotation.y = car.heading; dummy.scale.set(3.8, 1.25, 1.9); dummy.updateMatrix(); mesh.current!.setMatrixAt(i, dummy.matrix); mesh.current!.setColorAt(i, new THREE.Color(car.color)) })
    mesh.current.instanceMatrix.needsUpdate = true; if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[undefined, undefined, 18]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial vertexColors metalness={.6} roughness={.3} /></instancedMesh>
}

function Character({ selected, mode }: { selected: number; mode: 'foot' | 'car' }) {
  const model = useGLTF(selected ? '/assets/kenney/character-d.glb' : '/assets/kenney/character-a.glb')
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!group.current) return
    const moving = Math.hypot(runtimeMotion.velocity.x, runtimeMotion.velocity.z) > .25
    const pace = moving ? Math.sin(clock.elapsedTime * 11) : 0
    group.current.position.y = mode === 'car' ? -10 : Math.abs(pace) * .045
    group.current.rotation.z = pace * .025
  })
  if (mode === 'car') return null
  return <group ref={group} scale={.72}><Clone object={model.scene} castShadow /></group>
}

function PlayerController({ chunks, frozen }: { chunks: WorldChunk[]; frozen: boolean }) {
  const mode = useGameStore((s) => s.motion.mode)
  const selected = useGameStore((s) => s.character)
  const setMotion = useGameStore((s) => s.setMotion)
  const setDistrict = useGameStore((s) => s.setDistrict)
  const group = useRef<THREE.Group>(null)
  const internal = useRef<PlayerMotion>(cloneMotion(useGameStore.getState().motion))
  const syncClock = useRef(0)
  const obstacles = useMemo<Obstacle[]>(() => chunks.flatMap((c) => c.assets.filter((a) => ['tower','hotel','house','shop'].includes(a.kind)).map((a) => ({ x: a.x, z: a.z, halfX: a.scale[0] / 2, halfZ: a.scale[2] / 2 }))), [chunks])
  useEffect(() => installKeyboard(), [])
  useEffect(() => {
    if (internal.current.mode === mode) return
    internal.current = { ...internal.current, mode, velocity: { x: 0, y: 0, z: 0 } }
    runtimeMotion = cloneMotion(internal.current)
  }, [mode])
  useFrame((_, delta) => {
    if (frozen) return
    const requestedMode = useGameStore.getState().motion.mode
    if (internal.current.mode !== requestedMode) {
      internal.current = { ...internal.current, mode: requestedMode, velocity: { x: 0, y: 0, z: 0 } }
    }
    internal.current = stepMotion(internal.current, { x: inputState.x, z: inputState.z, sprint: inputState.sprint, jump: inputState.jumpQueued, cameraHeading: inputState.cameraHeading }, delta, obstacles)
    runtimeMotion = internal.current
    inputState.jumpQueued = false
    if (group.current) { group.current.position.set(internal.current.position.x, internal.current.position.y, internal.current.position.z); group.current.rotation.y = internal.current.heading }
    syncClock.current += delta
    if (syncClock.current > .1) { syncClock.current = 0; setMotion(cloneMotion(internal.current)); setDistrict(districtAt(internal.current.position.x, internal.current.position.z)) }
  })
  return <group ref={group}>
    <Character selected={selected} mode={mode} />
    {mode === 'car' && <group position={[0, .7, 0]}><mesh castShadow scale={[4.2, 1.2, 2]}><boxGeometry /><meshStandardMaterial color="#ff315d" metalness={.72} roughness={.25} /></mesh><mesh position={[0, .75, 0]} scale={[2, .65, 1.65]}><boxGeometry /><meshStandardMaterial color="#18283d" metalness={.5} roughness={.2} /></mesh></group>}
  </group>
}

function CameraRig({ frozen }: { frozen: boolean }) {
  const { camera } = useThree()
  useFrame((_, delta) => {
    if (frozen) return
    const motion = runtimeMotion
    const offset = motion.mode === 'car' ? 11 : 7.5
    const height = motion.mode === 'car' ? 5.4 : 4.1
    const target = new THREE.Vector3(motion.position.x - Math.sin(inputState.cameraHeading) * offset, motion.position.y + height, motion.position.z - Math.cos(inputState.cameraHeading) * offset)
    camera.position.lerp(target, 1 - Math.exp(-delta * 7)); camera.lookAt(motion.position.x, motion.position.y + 1.3, motion.position.z)
  })
  return null
}

function RenderProbe() {
  const { gl } = useThree()
  const frames = useRef(0)
  useFrame(() => {
    ++frames.current
    const render = gl.info.render
    const debugWindow = window as unknown as { __NEON_RENDER__: object; __NEON_E2E__: object }
    if (import.meta.env.DEV) {
      const renderStats = { calls: render.calls, triangles: render.triangles, points: render.points, lines: render.lines, frame: render.frame }
      debugWindow.__NEON_E2E__ = { frame: frames.current, motion: cloneMotion(runtimeMotion), lighting: LIGHTING, render: renderStats }
      if (frames.current % 60 === 0) debugWindow.__NEON_RENDER__ = renderStats
    } else if (frames.current % 60 === 0) {
      debugWindow.__NEON_RENDER__ = { calls: render.calls, triangles: render.triangles, points: render.points, lines: render.lines, frame: render.frame }
    }
  })
  return null
}

function World({ frozen }: { frozen: boolean }) {
  const position = useGameStore((s) => s.motion.position)
  const radius = useGameStore((s) => s.settings.viewDistance)
  const quality = useGameStore((s) => s.settings.quality)
  const chunkCoords = useMemo(() => chunksAround(position.x, position.z, radius), [Math.floor(position.x / 96), Math.floor(position.z / 96), radius])
  const chunks = useMemo(() => chunkCoords.map(([x, z]) => cache.get(x, z)), [chunkCoords])
  return <>
    <color attach="background" args={['#72c9df']} /><fog attach="fog" args={['#82cbd9', 80, radius * 105 + 115]} />
    <ambientLight intensity={LIGHTING.ambient} color="#d9efff" />
    <hemisphereLight intensity={LIGHTING.hemisphere} color="#fff4dd" groundColor="#6b8294" />
    <directionalLight position={[-70, 100, -40]} intensity={LIGHTING.sun} color="#ffd29a" castShadow={quality !== 'low'} shadow-mapSize={[quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024]} shadow-normalBias={.035} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position.x, -.25, position.z]}><planeGeometry args={[1500, 1500]} /><meshStandardMaterial color="#1686a1" roughness={.18} metalness={.12} /></mesh>
    <InstancedWorld chunks={chunks} /><Traffic position={position} /><PlayerController chunks={chunks} frozen={frozen} /><CameraRig frozen={frozen} /><RenderProbe />
  </>
}

export function GameScene({ frozen = false }: { frozen?: boolean }) {
  const quality = useGameStore((s) => s.settings.quality)
  return <Canvas shadows={quality !== 'low'} dpr={quality === 'high' ? [1, 1.7] : quality === 'medium' ? [1, 1.35] : 1} camera={{ fov: 58, near: .1, far: 900, position: [-70, 5, 10] }} gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = LIGHTING.exposure; gl.outputColorSpace = THREE.SRGBColorSpace }}><World frozen={frozen} /></Canvas>
}

useGLTF.preload('/assets/kenney/character-a.glb'); useGLTF.preload('/assets/kenney/character-d.glb')
