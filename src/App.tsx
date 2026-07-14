import { CharacterScreen, GarageScreen, LoadingScreen, MainMenu, MapScreen, PauseScreen, SettingsScreen, SplashScreen, StatsScreen } from './components/Screens'
import { GameScreen } from './game/GameScreen'
import { useGameStore } from './state/gameStore'

export default function App() {
  const screen = useGameStore((s) => s.screen)
  if (screen === 'splash') return <SplashScreen />
  if (screen === 'menu') return <MainMenu />
  if (screen === 'character') return <CharacterScreen />
  if (screen === 'loading') return <LoadingScreen />
  if (screen === 'map') return <MapScreen />
  if (screen === 'garage') return <GarageScreen />
  if (screen === 'stats') return <StatsScreen />
  if (screen === 'settings') return <SettingsScreen />
  if (screen === 'pause') return <><GameScreen frozen /><PauseScreen /></>
  return <GameScreen />
}
