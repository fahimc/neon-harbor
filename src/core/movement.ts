export interface Vec3 { x: number; y: number; z: number }
export interface PlayerMotion { position: Vec3; velocity: Vec3; heading: number; grounded: boolean; mode: 'foot' | 'car' }
export interface MoveInput { x: number; z: number; sprint: boolean; jump: boolean; cameraHeading: number }
export interface Obstacle { x: number; z: number; halfX: number; halfZ: number }

export function normalizeInput(x: number, z: number) {
  const length = Math.hypot(x, z)
  return length > 1 ? { x: x / length, z: z / length } : { x, z }
}

export function collides(x: number, z: number, radius: number, obstacles: Obstacle[]) {
  return obstacles.some((o) => Math.abs(x - o.x) < o.halfX + radius && Math.abs(z - o.z) < o.halfZ + radius)
}

export function stepMotion(state: PlayerMotion, input: MoveInput, dt: number, obstacles: Obstacle[] = []): PlayerMotion {
  const safeDt = Math.min(Math.max(dt, 0), .05)
  const desired = normalizeInput(input.x, input.z)
  const sin = Math.sin(input.cameraHeading)
  const cos = Math.cos(input.cameraHeading)
  const wx = desired.x * cos + desired.z * sin
  const wz = desired.z * cos - desired.x * sin
  const moving = Math.hypot(wx, wz) > .03
  const maxSpeed = state.mode === 'car' ? 24 : input.sprint ? 8.6 : 5.2
  const velocity = { ...state.velocity }
  const response = moving ? state.mode === 'car' ? 2.8 : input.sprint ? 7 : 10 : state.mode === 'car' ? 1.8 : 14
  const blend = 1 - Math.exp(-response * safeDt)
  const targetX = moving ? wx * maxSpeed : 0
  const targetZ = moving ? wz * maxSpeed : 0
  velocity.x += (targetX - velocity.x) * blend
  velocity.z += (targetZ - velocity.z) * blend
  const planar = Math.hypot(velocity.x, velocity.z)
  if (planar > maxSpeed) { velocity.x *= maxSpeed / planar; velocity.z *= maxSpeed / planar }
  if (input.jump && state.grounded && state.mode === 'foot') velocity.y = 8.2
  velocity.y -= 22 * safeDt
  const position = { ...state.position }
  const radius = state.mode === 'car' ? 1.8 : .45
  const nextX = position.x + velocity.x * safeDt
  const nextZ = position.z + velocity.z * safeDt
  if (!collides(nextX, position.z, radius, obstacles)) position.x = nextX; else velocity.x = 0
  if (!collides(position.x, nextZ, radius, obstacles)) position.z = nextZ; else velocity.z = 0
  position.y += velocity.y * safeDt
  let grounded = false
  if (position.y <= 0) { position.y = 0; velocity.y = 0; grounded = true }
  const heading = moving ? Math.atan2(wx, wz) : state.heading
  return { ...state, position, velocity, grounded, heading }
}
