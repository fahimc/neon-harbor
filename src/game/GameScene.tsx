import { useEffect, useMemo, useRef } from 'react'
import { Clone, useAnimations, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ChunkCache, chunksAround, districtAt, type WorldAsset, type WorldChunk } from '../core/world'
import { stepMotion, type Obstacle, type PlayerMotion } from '../core/movement'
import { trafficAt } from '../core/traffic'
import type { TrafficCar } from '../core/traffic'
import { useGameStore } from '../state/gameStore'
import { inputState, installKeyboard } from './input'

const cache = new ChunkCache()
const VISUALS = {
  rendering: 'bright-day-mobile',
  road: '#d7bf8a',
  water: '#32c4df',
  grass: '#93c879',
  sand: '#ffe3aa',
  sky: '#a7ecf5',
  fog: '#d7f9ff',
} as const

function cloneMotion(motion: PlayerMotion): PlayerMotion {
  return { ...motion, position: { ...motion.position }, velocity: { ...motion.velocity } }
}

// Rendering and the camera use this per-frame value. Zustand is intentionally
// updated less often so the HUD stays cheap without making the world stutter.
let runtimeMotion = cloneMotion(useGameStore.getState().motion)
const runtimeVisual = {
  characterAction: 'idle',
  legPose: [0, 0, 0, 1] as [number, number, number, number],
  carForward: { x: 0, z: 1 },
  vehicle: { gear: 'P', damage: 0, handbrake: false, headlights: false, horn: false, lastImpact: 0 },
  traffic: { count: 0, braking: 0 },
}

function setInstances(mesh: THREE.InstancedMesh | null, items: WorldAsset[], scaleMultiplier: [number, number, number] = [1, 1, 1], yOffset = 0) {
  if (!mesh) return
  const dummy = new THREE.Object3D()
  items.forEach((item, index) => {
    dummy.position.set(item.x, (item.kind === 'parkedCar' ? .65 : item.scale[1] / 2) + yOffset, item.z)
    dummy.rotation.y = item.rotation
    dummy.scale.set(item.scale[0] * scaleMultiplier[0], item.scale[1] * scaleMultiplier[1], item.scale[2] * scaleMultiplier[2])
    dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix); mesh.setColorAt(index, new THREE.Color(item.color))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach((material) => { material.needsUpdate = true })
}

function InstancedWorld({ chunks }: { chunks: WorldChunk[] }) {
  const { buildings, palms, lights, cars, roads, land } = useMemo(() => ({
    buildings: chunks.flatMap((c) => c.assets.filter((a) => ['tower', 'hotel', 'house', 'shop'].includes(a.kind))),
    palms: chunks.flatMap((c) => c.assets.filter((a) => a.kind === 'palm')),
    lights: chunks.flatMap((c) => c.assets.filter((a) => a.kind === 'streetlight')),
    cars: chunks.flatMap((c) => c.assets.filter((a) => a.kind === 'parkedCar')),
    roads: chunks.flatMap((c) => c.roads.map((r, i) => ({ ...r, id: `${c.key}:r${i}`, kind: 'shop' as const, scale: [r.width, .08, r.depth] as [number, number, number], color: VISUALS.road }))),
    land: chunks.filter((c) => !c.isWater).map((c) => ({ id: c.key, kind: 'shop' as const, x: c.cx * 96 + 48, z: c.cz * 96 + 48, rotation: 0, scale: [96, .1, 96] as [number, number, number], color: c.district === 'South Beach' ? VISUALS.sand : VISUALS.grass })),
  }), [chunks])
  const buildingRef = useRef<THREE.InstancedMesh>(null); const palmTrunks = useRef<THREE.InstancedMesh>(null); const palmLeaves = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null); const carRef = useRef<THREE.InstancedMesh>(null); const roadRef = useRef<THREE.InstancedMesh>(null); const landRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => { setInstances(buildingRef.current, buildings); setInstances(palmTrunks.current, palms, [.45, 1, .45]); setInstances(palmLeaves.current, palms, [2.4, .18, 2.4]); setInstances(lightRef.current, lights, [.18, 6, .18]); setInstances(carRef.current, cars, [1.8, 1.2, 3.7]); setInstances(roadRef.current, roads, [1, 1, 1], .12); setInstances(landRef.current, land, [1, 1, 1], -.06) }, [buildings, palms, lights, cars, roads, land])
  return <>
    <instancedMesh ref={landRef} args={[undefined, undefined, land.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={VISUALS.grass} toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={roadRef} args={[undefined, undefined, roads.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={VISUALS.road} toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={buildingRef} args={[undefined, undefined, buildings.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#f4d7b1" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={palmTrunks} args={[undefined, undefined, palms.length]}><cylinderGeometry args={[.5, .75, 1, 6]} /><meshBasicMaterial color="#c8955e" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={palmLeaves} args={[undefined, undefined, palms.length]}><sphereGeometry args={[1, 7, 4]} /><meshBasicMaterial color="#54b56b" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={lightRef} args={[undefined, undefined, lights.length]}><cylinderGeometry args={[.5, .5, 1, 6]} /><meshBasicMaterial color="#f5fbff" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={carRef} args={[undefined, undefined, cars.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ef476f" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
  </>
}

function Traffic({ position }: { position: { x: number; z: number } }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const lightMesh = useRef<THREE.InstancedMesh>(null)
  useFrame(({ clock }) => {
    if (!mesh.current) return
    const dummy = new THREE.Object3D()
    const traffic = trafficAt(clock.elapsedTime, position.x, position.z)
    runtimeVisual.traffic.count = traffic.length
    runtimeVisual.traffic.braking = traffic.filter((car) => car.brake).length
    traffic.forEach((car, i) => {
      dummy.position.set(car.x, .8, car.z); dummy.rotation.y = car.heading; dummy.scale.set(1.9, 1.25, 3.8); dummy.updateMatrix(); mesh.current!.setMatrixAt(i, dummy.matrix); mesh.current!.setColorAt(i, new THREE.Color(car.color))
      if (lightMesh.current) {
        dummy.position.set(car.x + Math.sin(car.heading) * 2.1, 1.03, car.z + Math.cos(car.heading) * 2.1)
        dummy.rotation.y = car.heading
        dummy.scale.set(.9, .22, .18)
        dummy.updateMatrix()
        lightMesh.current.setMatrixAt(i * 2, dummy.matrix)
        lightMesh.current.setColorAt(i * 2, new THREE.Color(car.headlights ? '#fff3a3' : '#6b7280'))
        dummy.position.set(car.x - Math.sin(car.heading) * 2.1, 1.03, car.z - Math.cos(car.heading) * 2.1)
        dummy.updateMatrix()
        lightMesh.current.setMatrixAt(i * 2 + 1, dummy.matrix)
        lightMesh.current.setColorAt(i * 2 + 1, new THREE.Color(car.brake ? '#ff1744' : '#8b1026'))
      }
    })
    mesh.current.instanceMatrix.needsUpdate = true; if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    if (lightMesh.current) {
      lightMesh.current.instanceMatrix.needsUpdate = true
      if (lightMesh.current.instanceColor) lightMesh.current.instanceColor.needsUpdate = true
      const materials = Array.isArray(lightMesh.current.material) ? lightMesh.current.material : [lightMesh.current.material]
      materials.forEach((material) => { material.needsUpdate = true })
    }
  })
  return <>
    <instancedMesh ref={mesh} args={[undefined, undefined, 24]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#fa3155" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={lightMesh} args={[undefined, undefined, 48]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial vertexColors toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
  </>
}

function Character({ selected }: { selected: number }) {
  const model = useGLTF(selected ? '/assets/kenney/character-d.glb' : '/assets/kenney/character-a.glb')
  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(model.animations, group)
  const activeAction = useRef('idle')
  useEffect(() => {
    activeAction.current = 'idle'
    actions.idle?.reset().fadeIn(.12).play()
    return () => { Object.values(actions).forEach((action) => action?.stop()) }
  }, [actions, selected])
  useFrame(() => {
    if (!group.current) return
    const speed = Math.hypot(runtimeMotion.velocity.x, runtimeMotion.velocity.z)
    const desiredAction = speed > 6.2 ? 'sprint' : speed > .25 ? 'walk' : 'idle'
    if (activeAction.current !== desiredAction) {
      actions[activeAction.current]?.fadeOut(.12)
      actions[desiredAction]?.reset().fadeIn(.12).play()
      activeAction.current = desiredAction
    }
    runtimeVisual.characterAction = desiredAction
    const leg = group.current.getObjectByName('leg-left')
    if (leg) runtimeVisual.legPose = [leg.quaternion.x, leg.quaternion.y, leg.quaternion.z, leg.quaternion.w]
  })
  return <group ref={group} scale={.72}><Clone object={model.scene} /></group>
}

function Vehicle() {
  const group = useRef<THREE.Group>(null)
  const rotation = useMemo(() => new THREE.Quaternion(), [])
  const forward = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!group.current) return
    group.current.getWorldQuaternion(rotation)
    forward.set(0, 0, 1).applyQuaternion(rotation).normalize()
    runtimeVisual.carForward.x = forward.x
    runtimeVisual.carForward.z = forward.z
  })
  return <group ref={group} position={[0, .72, 0]}>
    <mesh scale={[2, 1.15, 4.3]}><boxGeometry /><meshBasicMaterial color="#ff315d" toneMapped={false} /></mesh>
    <mesh position={[0, .78, -.3]} scale={[1.66, .72, 2]}><boxGeometry /><meshBasicMaterial color="#263c58" toneMapped={false} /></mesh>
    <mesh position={[0, .18, 2.17]} scale={[1.7, .34, .12]}><boxGeometry /><meshBasicMaterial color={inputState.headlights ? '#fff3a3' : '#ffe88a'} toneMapped={false} /></mesh>
    <mesh position={[0, .2, -2.17]} scale={[1.7, .28, .12]}><boxGeometry /><meshBasicMaterial color={inputState.z < -.05 || inputState.handbrake ? '#ff1744' : '#7f1d1d'} toneMapped={false} /></mesh>
    {([-1.03, 1.03] as const).flatMap((x) => [-1.42, 1.42].map((z) => <mesh key={`${x}:${z}`} position={[x, -.32, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.46, .46, .34, 10]} /><meshBasicMaterial color="#111827" toneMapped={false} /></mesh>))}
  </group>
}

function PlayerController({ chunks, frozen }: { chunks: WorldChunk[]; frozen: boolean }) {
  const mode = useGameStore((s) => s.motion.mode)
  const selected = useGameStore((s) => s.character)
  const setMotion = useGameStore((s) => s.setMotion)
  const setDistrict = useGameStore((s) => s.setDistrict)
  const group = useRef<THREE.Group>(null)
  const internal = useRef<PlayerMotion>(cloneMotion(useGameStore.getState().motion))
  const syncClock = useRef(0)
  const obstacles = useMemo<Obstacle[]>(() => chunks.flatMap((c) => c.assets.filter((a) => ['tower','hotel','house','shop','parkedCar'].includes(a.kind)).map((a) => ({ x: a.x, z: a.z, halfX: a.kind === 'parkedCar' ? 2 : a.scale[0] / 2, halfZ: a.kind === 'parkedCar' ? 4 : a.scale[2] / 2 }))), [chunks])
  useEffect(() => installKeyboard(), [])
  useEffect(() => {
    if (internal.current.mode === mode) return
    internal.current = { ...internal.current, mode, velocity: { x: 0, y: 0, z: 0 } }
    runtimeMotion = cloneMotion(internal.current)
  }, [mode])
  useFrame(({ clock }, delta) => {
    if (frozen) return
    const requestedMode = useGameStore.getState().motion.mode
    if (internal.current.mode !== requestedMode) {
      internal.current = { ...internal.current, mode: requestedMode, velocity: { x: 0, y: 0, z: 0 } }
    }
    const trafficObstacles: Obstacle[] = internal.current.mode === 'car' ? trafficAt(clock.elapsedTime, internal.current.position.x, internal.current.position.z).map((car: TrafficCar) => ({ x: car.x, z: car.z, halfX: 2.2, halfZ: 4.2 })) : []
    internal.current = stepMotion(internal.current, { x: inputState.x, z: inputState.z, sprint: inputState.sprint, jump: inputState.jumpQueued, cameraHeading: inputState.cameraHeading, handbrake: inputState.handbrake, headlights: inputState.headlights, horn: inputState.horn }, delta, [...obstacles, ...trafficObstacles])
    runtimeMotion = internal.current
    runtimeVisual.vehicle = { ...internal.current.vehicle }
    inputState.jumpQueued = false
    if (group.current) { group.current.position.set(internal.current.position.x, internal.current.position.y, internal.current.position.z); group.current.rotation.y = internal.current.heading }
    syncClock.current += delta
    if (syncClock.current > .1) { syncClock.current = 0; setMotion(cloneMotion(internal.current)); setDistrict(districtAt(internal.current.position.x, internal.current.position.z)) }
  })
  return <group ref={group}>
    {mode === 'foot' && <Character selected={selected} />}
    {mode === 'car' && <Vehicle />}
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
      debugWindow.__NEON_E2E__ = { frame: frames.current, input: { x: inputState.x, z: inputState.z, cameraHeading: inputState.cameraHeading, handbrake: inputState.handbrake, horn: inputState.horn, headlights: inputState.headlights }, motion: cloneMotion(runtimeMotion), visuals: { ...VISUALS, characterAction: runtimeVisual.characterAction, legPose: [...runtimeVisual.legPose], carForward: { ...runtimeVisual.carForward }, vehicle: { ...runtimeVisual.vehicle }, traffic: { ...runtimeVisual.traffic } }, render: renderStats }
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
  const chunkCoords = useMemo(() => chunksAround(position.x, position.z, radius), [Math.floor(position.x / 96), Math.floor(position.z / 96), radius])
  const chunks = useMemo(() => chunkCoords.map(([x, z]) => cache.get(x, z)), [chunkCoords])
  return <>
    <color attach="background" args={[VISUALS.sky]} /><fog attach="fog" args={[VISUALS.fog, 120, radius * 120 + 160]} />
    <ambientLight intensity={4.2} />
    <hemisphereLight args={['#ffffff', '#b4d79a', 2.8]} />
    <directionalLight position={[80, 160, 60]} intensity={2.4} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position.x, -.38, position.z]}><planeGeometry args={[1500, 1500]} /><meshBasicMaterial color={VISUALS.water} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    <InstancedWorld chunks={chunks} /><Traffic position={position} /><PlayerController chunks={chunks} frozen={frozen} /><CameraRig frozen={frozen} /><RenderProbe />
  </>
}

export function GameScene({ frozen = false }: { frozen?: boolean }) {
  const quality = useGameStore((s) => s.settings.quality)
  return <Canvas shadows={false} dpr={quality === 'high' ? [1, 1.7] : quality === 'medium' ? [1, 1.35] : 1} camera={{ fov: 58, near: .1, far: 900, position: [-70, 5, 10] }} gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = THREE.SRGBColorSpace }}><World frozen={frozen} /></Canvas>
}

useGLTF.preload('/assets/kenney/character-a.glb'); useGLTF.preload('/assets/kenney/character-d.glb')
