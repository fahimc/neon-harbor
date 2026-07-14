import { useEffect, useState } from 'react'
import { ArrowLeft, BadgeDollarSign, Car, ChevronRight, Crosshair, Gamepad2, Gauge, Map, Play, RotateCcw, Settings, Shield, Sparkles, Trophy, UserRound, Volume2, VolumeX, X } from 'lucide-react'
import hero from '../assets/neon-harbor-splash.png'
import { useGameStore, type Screen } from '../state/gameStore'
import { Logo } from './Logo'

function IconButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className="icon-button" aria-label={label} onClick={onClick}>{icon}</button>
}

export function SplashScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  return <main className="splash" style={{ backgroundImage: `linear-gradient(180deg,rgba(5,12,32,.02),#050b1c 95%),url(${hero})` }}>
    <div className="splash__top"><span>AN ORIGINAL OPEN-WORLD ADVENTURE</span><span>v1.0</span></div>
    <div className="splash__content"><Logo /><button className="primary primary--hero" onClick={() => setScreen('menu')}><Play fill="currentColor" /> ENTER THE CITY</button><p>TAP TO START</p></div>
  </main>
}

export function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen)
  const cash = useGameStore((s) => s.cash)
  const name = useGameStore((s) => s.playerName)
  return <main className="menu" style={{ backgroundImage: `linear-gradient(90deg,#050b1cee 15%,#050b1c55 65%,#050b1ccc),url(${hero})` }}>
    <header className="menu__header"><Logo compact /><div className="profile-pill"><span className="avatar-dot">AR</span><span><small>WELCOME BACK</small><b>{name}</b></span><span className="money">${cash.toLocaleString()}</span></div></header>
    <section className="menu__content">
      <span className="eyebrow">STORY MODE</span><h1>The city wakes<br /><em>after dark.</em></h1><p>Build your name across six districts in a seamless, constantly streaming coastal city.</p>
      <button className="primary" onClick={() => setScreen('loading')}><Play fill="currentColor" /> CONTINUE <span>32%</span></button>
      <button className="secondary" onClick={() => setScreen('character')}><Sparkles /> NEW STORY</button>
      <div className="save-card"><span className="save-card__art">NH</span><span><small>AUTOSAVE · 12 JUL</small><b>Ocean Drive — First Light</b><small>08:42 · $18,420</small></span><ChevronRight /></div>
    </section>
    <nav className="menu__rail" aria-label="Main sections">
      <button onClick={() => setScreen('map')}><Map /><span>MAP</span></button><button onClick={() => setScreen('garage')}><Car /><span>GARAGE</span></button><button onClick={() => setScreen('stats')}><Trophy /><span>PROGRESS</span></button><button onClick={() => setScreen('settings')}><Settings /><span>SETTINGS</span></button>
    </nav>
    <footer className="menu__footer"><span>OFFLINE STORY</span><span>© 2026 NEON HARBOR · CC0 ASSETS</span></footer>
  </main>
}

const characters = [
  { name: 'ALEX RIVERA', role: 'STREET SMART', perk: '+10% driving focus', color: '#ff4c83' },
  { name: 'MAYA TORRES', role: 'QUICK THINKER', perk: '+10% sprint recovery', color: '#2de0c1' },
]

export function CharacterScreen() {
  const selected = useGameStore((s) => s.character)
  const setCharacter = useGameStore((s) => s.setCharacter)
  const setName = useGameStore((s) => s.setPlayerName)
  const name = useGameStore((s) => s.playerName)
  const setScreen = useGameStore((s) => s.setScreen)
  return <main className="panel-screen character-screen"><ScreenHeader title="CHOOSE YOUR STORY" onBack={() => setScreen('menu')} />
    <section className="character-layout"><div className="character-copy"><span className="eyebrow">NEW GAME</span><h1>Who owns<br />the night?</h1><p>Your choice changes your look and starting perk. Every district and mission stays open.</p>
      <label className="field-label">PLAYER NAME<input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
      <div className="character-cards">{characters.map((c, i) => <button key={c.name} className={`character-card ${selected === i ? 'selected' : ''}`} onClick={() => { setCharacter(i); setName(c.name.split(' ')[0] + ' ' + c.name.split(' ')[1]) }}><span className="character-portrait" style={{ '--accent': c.color } as React.CSSProperties}><UserRound /></span><span><small>{c.role}</small><b>{c.name}</b><em>{c.perk}</em></span>{selected === i && <span className="check">✓</span>}</button>)}</div>
      <button className="primary" onClick={() => setScreen('loading')}>BEGIN STORY <ChevronRight /></button></div>
      <div className="character-showcase"><div className={`silhouette character-${selected}`}><span className="silhouette__head" /><span className="silhouette__body" /><span className="silhouette__legs" /></div><div className="stat-row"><span>STAMINA <i style={{ width: selected ? '92%' : '76%' }} /></span><span>DRIVING <i style={{ width: selected ? '74%' : '94%' }} /></span><span>FOCUS <i style={{ width: '82%' }} /></span></div></div>
    </section>
  </main>
}

export function LoadingScreen() {
  const [progress, setProgress] = useState(4)
  const setScreen = useGameStore((s) => s.setScreen)
  useEffect(() => { const id = window.setInterval(() => setProgress((p) => Math.min(100, p + 3 + Math.random() * 8)), 110); return () => clearInterval(id) }, [])
  useEffect(() => { if (progress >= 100) { const id = window.setTimeout(() => setScreen('game'), 350); return () => clearTimeout(id) } }, [progress, setScreen])
  return <main className="loading" style={{ backgroundImage: `linear-gradient(180deg,#07112633,#071126 92%),url(${hero})` }}><Logo /><div className="loading__bottom"><span className="eyebrow">TRAVEL TIP</span><h2>Vehicles are faster on the causeway.<br />Tap ACTION beside a parked car to drive.</h2><div className="loading__bar"><i style={{ width: `${progress}%` }} /></div><span>STREAMING NEON HARBOR · {Math.floor(progress)}%</span></div></main>
}

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) { return <header className="screen-header"><IconButton label="Back" icon={<ArrowLeft />} onClick={onBack} /><Logo compact /><h2>{title}</h2><div className="screen-header__spacer" /></header> }

export function MapScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const back = useGameStore((s) => s.previousScreen === 'game' ? 'game' : 'menu')
  return <main className="panel-screen"><ScreenHeader title="CITY MAP" onBack={() => setScreen(back)} /><section className="map-layout"><div className="big-map">
    <div className="map-water" /><div className="map-island island-a" /><div className="map-island island-b" />
    {Array.from({ length: 12 }, (_, i) => <i key={`h${i}`} className="map-road h" style={{ top: `${10 + i * 7}%` }} />)}{Array.from({ length: 9 }, (_, i) => <i key={`v${i}`} className="map-road v" style={{ left: `${30 + i * 7}%` }} />)}
    <span className="map-label beach">SOUTH BEACH</span><span className="map-label downtown">DOWNTOWN</span><span className="map-label port">PORT HARBOR</span><span className="map-player">➤</span><span className="mission-pin">★</span>
  </div><aside className="map-sidebar"><span className="eyebrow">ACTIVE MISSION</span><h2>FIRST LIGHT</h2><p>Meet Sofia at the marina before sunrise.</p><div className="distance"><Crosshair /><span><small>DISTANCE</small><b>1.2 KM</b></span></div><button className="primary" onClick={() => setScreen('game')}>SET WAYPOINT</button><h3>LEGEND</h3><ul><li><i className="legend mission" /> Mission</li><li><i className="legend garage" /> Garage</li><li><i className="legend safe" /> Safehouse</li></ul></aside></section></main>
}

export function GarageScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  return <main className="panel-screen garage-screen"><ScreenHeader title="GARAGE" onBack={() => setScreen('menu')} /><section className="garage-layout"><div className="garage-car"><div className="car-art"><span className="car-body" /><span className="wheel one" /><span className="wheel two" /></div><div className="garage-platform" /></div><aside><span className="eyebrow">SPORT · OWNED</span><h1>Comet<br /><em>XR-5</em></h1><p>Lightweight coastal runner. Built for sharp turns and long sunrise drives.</p><div className="vehicle-stats"><Stat label="TOP SPEED" value="214 KM/H" width="88%" /><Stat label="ACCELERATION" value="8.4" width="82%" /><Stat label="HANDLING" value="9.1" width="91%" /></div><div className="paint-row">{['#ef476f','#05c7b2','#f8cc57','#e8edf4','#111827'].map((c) => <button key={c} aria-label={`Paint ${c}`} style={{ background: c }} />)}</div><button className="primary" onClick={() => setScreen('loading')}>DRIVE NOW <ChevronRight /></button></aside></section></main>
}

function Stat({ label, value, width }: { label: string; value: string; width: string }) { return <div className="stat"><span><small>{label}</small><b>{value}</b></span><i><em style={{ width }} /></i></div> }

export function StatsScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  return <main className="panel-screen"><ScreenHeader title="PROGRESS" onBack={() => setScreen('menu')} /><section className="stats-layout"><div className="progress-ring"><span>32<small>%</small></span><p>STORY COMPLETE</p></div><div className="achievement-grid"><ProgressCard icon={<Trophy />} label="Missions" value="8 / 25" progress="32%" /><ProgressCard icon={<Car />} label="Vehicles" value="3 / 18" progress="17%" /><ProgressCard icon={<Map />} label="City discovered" value="41%" progress="41%" /><ProgressCard icon={<BadgeDollarSign />} label="Lifetime earnings" value="$86,240" progress="68%" /><ProgressCard icon={<Gauge />} label="Longest drive" value="12.8 km" progress="55%" /><ProgressCard icon={<Shield />} label="Clean escapes" value="7" progress="78%" /></div></section></main>
}

function ProgressCard({ icon, label, value, progress }: { icon: React.ReactNode; label: string; value: string; progress: string }) { return <div className="progress-card"><span>{icon}</span><small>{label}</small><b>{value}</b><i><em style={{ width: progress }} /></i></div> }

export function SettingsScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const previous = useGameStore((s) => s.previousScreen)
  const settings = useGameStore((s) => s.settings)
  const update = useGameStore((s) => s.updateSettings)
  const reset = useGameStore((s) => s.resetSave)
  return <main className="panel-screen"><ScreenHeader title="SETTINGS" onBack={() => setScreen(previous === 'game' || previous === 'pause' ? 'pause' : 'menu')} /><section className="settings-layout"><nav><button className="active"><Gamepad2 /> GAMEPLAY</button><button><Volume2 /> AUDIO</button><button><Gauge /> GRAPHICS</button></nav><div className="settings-list"><h1>Gameplay</h1><SettingRow label="CAMERA SENSITIVITY" description="Look and follow speed"><input aria-label="Camera sensitivity" type="range" min=".2" max="1" step=".05" value={settings.sensitivity} onChange={(e) => update({ sensitivity: +e.target.value })} /></SettingRow><SettingRow label="VIEW DISTANCE" description="Number of city chunks around the player"><select value={settings.viewDistance} onChange={(e) => update({ viewDistance: +e.target.value })}><option value="1">Near</option><option value="2">Balanced</option><option value="3">Far</option></select></SettingRow><SettingRow label="GRAPHICS QUALITY" description="Shadows, pixel density and effects"><select value={settings.quality} onChange={(e) => update({ quality: e.target.value as typeof settings.quality })}><option>low</option><option>medium</option><option>high</option></select></SettingRow><SettingRow label="MUSIC" description="Dynamic city soundtrack"><Toggle value={settings.music} onChange={(v) => update({ music: v })} /></SettingRow><SettingRow label="SOUND EFFECTS" description="Vehicles, footsteps and ambience"><Toggle value={settings.sfx} onChange={(v) => update({ sfx: v })} /></SettingRow><SettingRow label="HAPTIC FEEDBACK" description="Touch control vibration"><Toggle value={settings.vibration} onChange={(v) => update({ vibration: v })} /></SettingRow><button className="danger" onClick={reset}><RotateCcw /> RESET LOCAL SAVE</button></div></section></main>
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) { return <div className="setting-row"><span><b>{label}</b><small>{description}</small></span>{children}</div> }
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) { return <button aria-pressed={value} aria-label={value ? 'Disable' : 'Enable'} className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)}><i /></button> }

export function PauseScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  return <div className="pause-overlay"><div className="pause-card"><div className="pause-title"><span className="eyebrow">GAME PAUSED</span><Logo /><IconButton label="Resume" icon={<X />} onClick={() => setScreen('game')} /></div><button className="pause-primary" onClick={() => setScreen('game')}><Play /> RESUME</button><button onClick={() => setScreen('map')}><Map /> MAP <ChevronRight /></button><button onClick={() => setScreen('settings')}><Settings /> SETTINGS <ChevronRight /></button><button onClick={() => setScreen('menu')}><ArrowLeft /> EXIT TO MAIN MENU <ChevronRight /></button></div></div>
}
