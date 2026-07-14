import { Car, Crosshair, Heart, Map, Menu, Navigation, Pause, Shield } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'
import { GameScene } from './GameScene'
import { TouchControls } from './TouchControls'
import { inputState } from './input'

export function GameScreen({ frozen = false }: { frozen?: boolean }) {
  const setScreen = useGameStore((s) => s.setScreen)
  const district = useGameStore((s) => s.district)
  const cash = useGameStore((s) => s.cash)
  const health = useGameStore((s) => s.health)
  const wanted = useGameStore((s) => s.wanted)
  const motion = useGameStore((s) => s.motion)
  const sensitivity = useGameStore((s) => s.settings.sensitivity)
  const toggleVehicle = useGameStore((s) => s.toggleVehicle)
  const dragX = useRef<number | null>(null)
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.code === 'KeyE' || event.code === 'KeyF') toggleVehicle() }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [toggleVehicle])
  const speed = Math.round(Math.hypot(motion.velocity.x, motion.velocity.z) * 3.6)
  const startLook = (event: React.PointerEvent<HTMLElement>) => { if ((event.target as HTMLElement).tagName !== 'CANVAS') return; dragX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId) }
  const moveLook = (event: React.PointerEvent<HTMLElement>) => { if (dragX.current == null) return; inputState.cameraHeading -= (event.clientX - dragX.current) * sensitivity * .008; dragX.current = event.clientX }
  const endLook = () => { dragX.current = null }
  return <main className={`game-screen ${motion.mode === 'car' ? 'game-screen--car' : ''} ${frozen ? 'game-screen--frozen' : ''}`} onPointerDown={startLook} onPointerMove={moveLook} onPointerUp={endLook} onPointerCancel={endLook}><GameScene frozen={frozen} />
    <header className="hud-top"><button className="hud-button" aria-label="Pause" onClick={() => setScreen('pause')}><Menu /></button><div className="location"><Navigation /><span><small>NOW ENTERING</small><b>{district}</b></span></div><div className="hud-right"><span className="cash">${cash.toLocaleString()}</span><span className="wanted" aria-label={`${wanted} wanted stars`}>{Array.from({ length: 3 }, (_, i) => <i key={i} className={i < wanted ? 'active' : ''}>★</i>)}</span><span className="health"><Heart fill="currentColor" />{health}</span></div></header>
    <aside className="mission-card"><small>CURRENT MISSION</small><b>FIRST LIGHT</b><span>Reach the marina</span><div><Crosshair /> 1.2 KM</div></aside>
    <button className="minimap" aria-label="Open map" onClick={() => setScreen('map')}><span className="mini-water" /><i className="mini-road a" /><i className="mini-road b" /><i className="mini-road c" /><span className="mini-player">▲</span><span className="mini-north">N</span></button>
    {motion.mode === 'car' && <div className="speedometer"><Car /><strong>{speed}</strong><span>KM/H</span></div>}
    {!frozen && <TouchControls />}<div className="game-hint">{motion.mode === 'car' ? 'STEER LEFT · GAS / BRAKE RIGHT · DRAG TO LOOK · E TO EXIT' : 'WASD / JOYSTICK TO MOVE · DRAG TO LOOK · SPACE TO JUMP · E TO DRIVE'}</div>
  </main>
}
