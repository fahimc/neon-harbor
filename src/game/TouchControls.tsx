import { useRef, useState } from 'react'
import { Car, Footprints, Gauge, LogOut, MoveDown, MoveUp } from 'lucide-react'
import { useGameStore } from '../state/gameStore'
import { inputState } from './input'

export function TouchControls() {
  const origin = useRef({ x: 0, y: 0 })
  const steeringActive = useRef(false)
  const pedalActive = useRef(false)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const mode = useGameStore((s) => s.motion.mode)
  const toggleVehicle = useGameStore((s) => s.toggleVehicle)
  const isDriving = mode === 'car'
  const syncTouchActive = () => { inputState.touchActive = steeringActive.current || pedalActive.current }
  const begin = (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); origin.current = { x: e.clientX, y: e.clientY }; steeringActive.current = true; syncTouchActive() }
  const move = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const dx = e.clientX - origin.current.x
    const dy = e.clientY - origin.current.y
    const len = Math.max(1, Math.hypot(dx, dy))
    const limit = Math.min(42, len)
    const x = dx / len * limit
    const y = isDriving ? 0 : dy / len * limit
    setKnob({ x, y })
    inputState.x = -x / 42
    if (!isDriving) {
      inputState.z = -y / 42
      inputState.sprint = len > 37
    }
  }
  const end = () => {
    setKnob({ x: 0, y: 0 })
    steeringActive.current = false
    inputState.x = 0
    if (!isDriving) {
      inputState.z = 0
      inputState.sprint = false
    }
    syncTouchActive()
  }
  const pressPedal = (z: number) => { pedalActive.current = true; syncTouchActive(); inputState.z = z; inputState.sprint = true }
  const releasePedal = () => { pedalActive.current = false; inputState.z = 0; inputState.sprint = false; syncTouchActive() }
  const exitVehicle = () => { steeringActive.current = false; pedalActive.current = false; inputState.touchActive = false; inputState.x = 0; inputState.z = 0; inputState.sprint = false; toggleVehicle() }

  return <div className={`touch-controls ${isDriving ? 'touch-controls--car' : ''}`}>
    <div className={`joystick ${isDriving ? 'joystick--steer' : ''}`} aria-label={isDriving ? 'Steer vehicle' : 'Move'} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><span style={{ transform: `translate(${knob.x}px,${knob.y}px)` }}>{isDriving ? <Car /> : <Footprints />}</span></div>
    {isDriving ? <div className="drive-controls">
      <button className="vehicle-exit" aria-label="Exit vehicle" onClick={exitVehicle}><LogOut /><small>EXIT</small></button>
      <button className="pedal pedal--brake" aria-label="Brake or reverse" onPointerDown={() => pressPedal(-1)} onPointerUp={releasePedal} onPointerCancel={releasePedal}><MoveDown /><small>BRAKE</small></button>
      <button className="pedal pedal--accelerate" aria-label="Accelerate" onPointerDown={() => pressPedal(1)} onPointerUp={releasePedal} onPointerCancel={releasePedal}><MoveUp /><small>GAS</small></button>
    </div> : <div className="action-buttons">
      <button aria-label="Jump" onPointerDown={() => { inputState.jumpQueued = true }}><MoveUp /><small>JUMP</small></button>
      <button aria-label="Sprint" onPointerDown={() => { inputState.sprint = true }} onPointerUp={() => { inputState.sprint = false }}><Gauge /><small>SPRINT</small></button>
      <button className="action" aria-label="Enter vehicle" onClick={toggleVehicle}><Car /><small>DRIVE</small></button>
    </div>}
  </div>
}
