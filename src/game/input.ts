export const inputState = { x: 0, z: 0, sprint: false, jumpQueued: false, cameraHeading: Math.PI, touchActive: false, handbrake: false, horn: false, headlights: false }

const down = new Set<string>()
export function installKeyboard() {
  const handleDown = (e: KeyboardEvent) => { down.add(e.code); if (e.code === 'Space') inputState.jumpQueued = true; if (e.code === 'KeyL' && !e.repeat) inputState.headlights = !inputState.headlights }
  const handleUp = (e: KeyboardEvent) => down.delete(e.code)
  window.addEventListener('keydown', handleDown)
  window.addEventListener('keyup', handleUp)
  const update = () => {
    if (inputState.touchActive) return
    inputState.x = (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0) - (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0)
    inputState.z = (down.has('KeyW') || down.has('ArrowUp') ? 1 : 0) - (down.has('KeyS') || down.has('ArrowDown') ? 1 : 0)
    inputState.sprint = down.has('ShiftLeft') || down.has('ShiftRight')
    inputState.handbrake = down.has('Space')
    inputState.horn = down.has('KeyH')
  }
  const timer = window.setInterval(update, 16)
  return () => { window.removeEventListener('keydown', handleDown); window.removeEventListener('keyup', handleUp); window.clearInterval(timer); down.clear() }
}
