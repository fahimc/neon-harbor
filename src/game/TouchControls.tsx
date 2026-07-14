import { useRef, useState } from 'react'
import { Car, Footprints, Gauge, Hand, MoveUp } from 'lucide-react'
import { useGameStore } from '../state/gameStore'
import { inputState } from './input'

export function TouchControls() {
  const origin = useRef({ x: 0, y: 0 })
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const mode = useGameStore((s) => s.motion.mode)
  const toggleVehicle = useGameStore((s) => s.toggleVehicle)
  const begin = (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); origin.current = { x: e.clientX, y: e.clientY } }
  const move = (e: React.PointerEvent) => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; const dx = e.clientX - origin.current.x; const dy = e.clientY - origin.current.y; const len = Math.max(1, Math.hypot(dx, dy)); const limit = Math.min(42, len); const x = dx / len * limit; const y = dy / len * limit; setKnob({ x, y }); inputState.x = -x / 42; inputState.z = -y / 42; inputState.sprint = len > 37 }
  const end = () => { setKnob({ x: 0, y: 0 }); inputState.x = 0; inputState.z = 0; inputState.sprint = false }
  return <div className="touch-controls"><div className="joystick" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><span style={{ transform: `translate(${knob.x}px,${knob.y}px)` }}><Footprints /></span></div><div className="action-buttons"><button aria-label="Jump" onPointerDown={() => { inputState.jumpQueued = true }}><MoveUp /><small>JUMP</small></button><button aria-label="Sprint" onPointerDown={() => { inputState.sprint = true }} onPointerUp={() => { inputState.sprint = false }}><Gauge /><small>SPRINT</small></button><button className="action" aria-label={mode === 'car' ? 'Exit vehicle' : 'Enter vehicle'} onClick={toggleVehicle}>{mode === 'car' ? <Footprints /> : <Car />}<small>{mode === 'car' ? 'EXIT' : 'DRIVE'}</small></button></div></div>
}
