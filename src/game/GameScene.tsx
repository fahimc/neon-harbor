import { useEffect, useMemo, useRef } from 'react'
import { Clone, useAnimations, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ChunkCache, chunksAround, districtAt, type WorldAsset, type WorldChunk } from '../core/world'
import { stepMotion, type Obstacle, type PlayerMotion } from '../core/movement'
import { trafficAt } from '../core/traffic'
import type { TrafficCar } from '../core/traffic'
import { vehicleProfileForId, type VehicleProfile } from '../core/vehicles'
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

function createVehiclePaintTexture(profile: VehicleProfile) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 256, 128)
  gradient.addColorStop(0, profile.paint)
  gradient.addColorStop(.58, profile.paint)
  gradient.addColorStop(1, '#111827')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = 'rgba(255,255,255,.16)'
  ctx.fillRect(0, 10, 256, 9)
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  ctx.fillRect(0, 108, 256, 9)
  ctx.strokeStyle = 'rgba(10,18,32,.55)'
  ctx.lineWidth = 3
  for (const x of [42, 128, 214]) {
    ctx.beginPath()
    ctx.moveTo(x, 6)
    ctx.lineTo(x - 11, 122)
    ctx.stroke()
  }
  ctx.fillStyle = profile.stripe
  if (profile.livery === 'two-tone') {
    ctx.fillRect(0, 72, 256, 34)
  } else if (profile.livery === 'offset-stripe') {
    ctx.fillRect(78, 0, 16, 128)
    ctx.fillRect(104, 0, 7, 128)
  } else if (profile.livery === 'checker') {
    for (let x = 0; x < 256; x += 16) for (let y = 50; y < 78; y += 14) {
      ctx.fillStyle = ((x + y) / 14) % 2 < 1 ? '#111827' : '#f8fafc'
      ctx.fillRect(x, y, 16, 14)
    }
  } else {
    ctx.fillRect(118, 0, 20, 128)
  }
  ctx.fillStyle = 'rgba(255,255,255,.2)'
  ctx.fillRect(26, 24, 58, 16)
  ctx.fillRect(164, 24, 58, 16)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(profile.className.toUpperCase().slice(0, 3), 94, 96)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

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
  vehicleArt: { textured: true, playerLayers: 18, parkedParts: 7, trafficParts: 5 },
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

function setVehiclePart(mesh: THREE.InstancedMesh | null, items: Array<{ x: number; z: number; rotation?: number; id?: string | number }>, offset: [number, number, number], scale: [number, number, number], color?: string) {
  if (!mesh) return
  const dummy = new THREE.Object3D()
  const local = new THREE.Vector3()
  items.forEach((item, index) => {
    const rotation = item.rotation ?? 0
    local.set(offset[0], offset[1], offset[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
    dummy.position.set(item.x + local.x, local.y, item.z + local.z)
    dummy.rotation.y = rotation
    dummy.scale.set(scale[0], scale[1], scale[2])
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    if (color) mesh.setColorAt(index, new THREE.Color(color))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach((material) => { material.needsUpdate = true })
}

function setVehicleWheels(mesh: THREE.InstancedMesh | null, items: Array<{ x: number; z: number; rotation?: number }>) {
  if (!mesh) return
  const dummy = new THREE.Object3D()
  const local = new THREE.Vector3()
  let index = 0
  for (const item of items) {
    const rotation = item.rotation ?? 0
    for (const x of [-1.1, 1.1]) for (const z of [-1.45, 1.45]) {
      local.set(x, .36, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
      dummy.position.set(item.x + local.x, local.y, item.z + local.z)
      dummy.rotation.set(0, rotation, Math.PI / 2)
      dummy.scale.set(.48, .48, .35)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      index += 1
    }
  }
  mesh.instanceMatrix.needsUpdate = true
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
  const lightRef = useRef<THREE.InstancedMesh>(null); const carRef = useRef<THREE.InstancedMesh>(null); const carCabinRef = useRef<THREE.InstancedMesh>(null); const carStripeRef = useRef<THREE.InstancedMesh>(null); const carHeadlightRef = useRef<THREE.InstancedMesh>(null); const carTaillightRef = useRef<THREE.InstancedMesh>(null); const carWheelRef = useRef<THREE.InstancedMesh>(null); const roadRef = useRef<THREE.InstancedMesh>(null); const landRef = useRef<THREE.InstancedMesh>(null)
  const parkedTexture = useMemo(() => createVehiclePaintTexture(vehicleProfileForId('parked-city-fleet', '#ef476f')), [])
  useEffect(() => { setInstances(buildingRef.current, buildings); setInstances(palmTrunks.current, palms, [.45, 1, .45]); setInstances(palmLeaves.current, palms, [2.4, .18, 2.4]); setInstances(lightRef.current, lights, [.18, 6, .18]); setInstances(carRef.current, cars, [1.9, 1.05, 4.1]); setVehiclePart(carCabinRef.current, cars, [0, 1.12, -.35], [1.45, .55, 1.5]); setVehiclePart(carStripeRef.current, cars, [0, 1.23, .1], [.28, .08, 3.65]); setVehiclePart(carHeadlightRef.current, cars, [0, .88, 2.1], [1.3, .2, .12]); setVehiclePart(carTaillightRef.current, cars, [0, .88, -2.1], [1.35, .2, .12]); setVehicleWheels(carWheelRef.current, cars); setInstances(roadRef.current, roads, [1, 1, 1], .12); setInstances(landRef.current, land, [1, 1, 1], -.06) }, [buildings, palms, lights, cars, roads, land])
  return <>
    <instancedMesh ref={landRef} args={[undefined, undefined, land.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={VISUALS.grass} toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={roadRef} args={[undefined, undefined, roads.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={VISUALS.road} toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={buildingRef} args={[undefined, undefined, buildings.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#f4d7b1" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={palmTrunks} args={[undefined, undefined, palms.length]}><cylinderGeometry args={[.5, .75, 1, 6]} /><meshBasicMaterial color="#c8955e" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={palmLeaves} args={[undefined, undefined, palms.length]}><sphereGeometry args={[1, 7, 4]} /><meshBasicMaterial color="#54b56b" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={lightRef} args={[undefined, undefined, lights.length]}><cylinderGeometry args={[.5, .5, 1, 6]} /><meshBasicMaterial color="#f5fbff" toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={carRef} args={[undefined, undefined, cars.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial map={parkedTexture} toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={carCabinRef} args={[undefined, undefined, cars.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#263c58" toneMapped={false} /></instancedMesh>
    <instancedMesh ref={carStripeRef} args={[undefined, undefined, cars.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#f8fafc" toneMapped={false} /></instancedMesh>
    <instancedMesh ref={carHeadlightRef} args={[undefined, undefined, cars.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#fff3a3" toneMapped={false} /></instancedMesh>
    <instancedMesh ref={carTaillightRef} args={[undefined, undefined, cars.length]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#ff1744" toneMapped={false} /></instancedMesh>
    <instancedMesh ref={carWheelRef} args={[undefined, undefined, cars.length * 4]}><cylinderGeometry args={[1, 1, 1, 12]} /><meshBasicMaterial color="#111827" toneMapped={false} /></instancedMesh>
  </>
}

function Traffic({ position }: { position: { x: number; z: number } }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const cabinMesh = useRef<THREE.InstancedMesh>(null)
  const stripeMesh = useRef<THREE.InstancedMesh>(null)
  const wheelMesh = useRef<THREE.InstancedMesh>(null)
  const lightMesh = useRef<THREE.InstancedMesh>(null)
  const trafficTexture = useMemo(() => createVehiclePaintTexture(vehicleProfileForId('traffic-fleet', '#f97316')), [])
  useFrame(({ clock }) => {
    if (!mesh.current) return
    const dummy = new THREE.Object3D()
    const traffic = trafficAt(clock.elapsedTime, position.x, position.z)
    runtimeVisual.traffic.count = traffic.length
    runtimeVisual.traffic.braking = traffic.filter((car) => car.brake).length
    setVehiclePart(cabinMesh.current, traffic, [0, 1.17, -.3], [1.5, .58, 1.5], '#263c58')
    setVehiclePart(stripeMesh.current, traffic, [0, 1.28, .05], [.3, .08, 3.7], '#f8fafc')
    setVehicleWheels(wheelMesh.current, traffic)
    traffic.forEach((car, i) => {
      dummy.position.set(car.x, .8, car.z); dummy.rotation.y = car.heading; dummy.scale.set(1.9, 1.15, 4.05); dummy.updateMatrix(); mesh.current!.setMatrixAt(i, dummy.matrix); mesh.current!.setColorAt(i, new THREE.Color(car.color))
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
    <instancedMesh ref={mesh} args={[undefined, undefined, 24]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial map={trafficTexture} toneMapped={false} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={cabinMesh} args={[undefined, undefined, 24]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#263c58" toneMapped={false} /></instancedMesh>
    <instancedMesh ref={stripeMesh} args={[undefined, undefined, 24]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#f8fafc" toneMapped={false} /></instancedMesh>
    <instancedMesh ref={wheelMesh} args={[undefined, undefined, 96]}><cylinderGeometry args={[1, 1, 1, 12]} /><meshBasicMaterial color="#111827" toneMapped={false} /></instancedMesh>
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
  const profile = useMemo(() => vehicleProfileForId('player-comet-xr5', '#ff315d'), [])
  const paintTexture = useMemo(() => createVehiclePaintTexture(profile), [profile])
  useFrame(() => {
    if (!group.current) return
    group.current.getWorldQuaternion(rotation)
    forward.set(0, 0, 1).applyQuaternion(rotation).normalize()
    runtimeVisual.carForward.x = forward.x
    runtimeVisual.carForward.z = forward.z
  })
  return <group ref={group} position={[0, .72, 0]}>
    <mesh scale={profile.body}><boxGeometry /><meshBasicMaterial map={paintTexture} toneMapped={false} /></mesh>
    <mesh position={[0, .3, 1.62]} scale={[1.82, .45, 1.35]}><boxGeometry /><meshBasicMaterial map={paintTexture} toneMapped={false} /></mesh>
    <mesh position={[0, .34, -1.55]} scale={[1.9, .42, 1.18]}><boxGeometry /><meshBasicMaterial map={paintTexture} toneMapped={false} /></mesh>
    <mesh position={profile.cabin.position} scale={profile.cabin.scale}><boxGeometry /><meshBasicMaterial color={profile.trim} toneMapped={false} /></mesh>
    <mesh position={[0, 1.18, .55]} scale={[1.32, .08, .62]}><boxGeometry /><meshBasicMaterial color="#91d5ff" toneMapped={false} /></mesh>
    <mesh position={[0, 1.18, -1.23]} scale={[1.28, .08, .46]}><boxGeometry /><meshBasicMaterial color="#67b7e8" toneMapped={false} /></mesh>
    <mesh position={[0, 1.23, -.24]} scale={[.36, .09, 3.45]}><boxGeometry /><meshBasicMaterial color={profile.stripe} toneMapped={false} /></mesh>
    <mesh position={[0, .08, 2.38]} scale={[2.08, .28, .18]}><boxGeometry /><meshBasicMaterial color="#111827" toneMapped={false} /></mesh>
    <mesh position={[0, .1, -2.38]} scale={[2.08, .28, .18]}><boxGeometry /><meshBasicMaterial color="#111827" toneMapped={false} /></mesh>
    <mesh position={[0, .34, 2.48]} scale={[1.1, .2, .08]}><boxGeometry /><meshBasicMaterial color="#0f172a" toneMapped={false} /></mesh>
    <mesh position={[0, .18, 2.17]} scale={[1.7, .34, .12]}><boxGeometry /><meshBasicMaterial color={inputState.headlights ? '#fff3a3' : '#ffe88a'} toneMapped={false} /></mesh>
    <mesh position={[0, .2, -2.17]} scale={[1.7, .28, .12]}><boxGeometry /><meshBasicMaterial color={inputState.z < -.05 || inputState.handbrake ? '#ff1744' : '#7f1d1d'} toneMapped={false} /></mesh>
    {profile.spoiler && <mesh position={[0, .76, -2.2]} scale={[1.86, .15, .22]}><boxGeometry /><meshBasicMaterial color="#111827" toneMapped={false} /></mesh>}
    {([-1.22, 1.22] as const).map((x) => <mesh key={`mirror-${x}`} position={[x, .93, .55]} scale={[.18, .14, .38]}><boxGeometry /><meshBasicMaterial color="#111827" toneMapped={false} /></mesh>)}
    {([-1.08, 1.08] as const).flatMap((x) => [-1.48, 1.48].map((z) => <group key={`${x}:${z}`} position={[x, -.32, z]} rotation={[0, 0, Math.PI / 2]}><mesh><cylinderGeometry args={[.48, .48, .35, 14]} /><meshBasicMaterial color="#111827" toneMapped={false} /></mesh><mesh scale={[.56, .56, 1.05]}><cylinderGeometry args={[.34, .34, .38, 10]} /><meshBasicMaterial color="#94a3b8" toneMapped={false} /></mesh></group>))}
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
      debugWindow.__NEON_E2E__ = { frame: frames.current, input: { x: inputState.x, z: inputState.z, cameraHeading: inputState.cameraHeading, handbrake: inputState.handbrake, horn: inputState.horn, headlights: inputState.headlights }, motion: cloneMotion(runtimeMotion), visuals: { ...VISUALS, characterAction: runtimeVisual.characterAction, legPose: [...runtimeVisual.legPose], carForward: { ...runtimeVisual.carForward }, vehicle: { ...runtimeVisual.vehicle }, traffic: { ...runtimeVisual.traffic }, vehicleArt: { ...runtimeVisual.vehicleArt } }, render: renderStats }
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
