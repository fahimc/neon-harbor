import { create } from 'zustand'
import type { PlayerMotion } from '../core/movement'
import { getVehicleAccessTarget } from '../game/vehicleAccess'

export type Screen = 'splash' | 'menu' | 'character' | 'loading' | 'game' | 'map' | 'garage' | 'settings' | 'pause' | 'stats'
export interface GameSettings { quality: 'low' | 'medium' | 'high'; music: boolean; sfx: boolean; vibration: boolean; sensitivity: number; viewDistance: number }

interface GameState {
  screen: Screen
  previousScreen: Screen
  playerName: string
  character: number
  cash: number
  health: number
  wanted: number
  mission: string
  district: string
  settings: GameSettings
  motion: PlayerMotion
  setScreen: (screen: Screen) => void
  setPlayerName: (name: string) => void
  setCharacter: (character: number) => void
  setDistrict: (district: string) => void
  setMotion: (motion: PlayerMotion) => void
  toggleVehicle: () => void
  updateSettings: (settings: Partial<GameSettings>) => void
  resetSave: () => void
}

const initialMotion: PlayerMotion = { position: { x: -70, y: 0, z: 20 }, velocity: { x: 0, y: 0, z: 0 }, heading: Math.PI, grounded: true, mode: 'foot', vehicle: { gear: 'P', damage: 0, handbrake: false, headlights: false, horn: false, lastImpact: 0 } }
const initialSettings: GameSettings = { quality: 'medium', music: true, sfx: true, vibration: true, sensitivity: .55, viewDistance: 2 }

export const useGameStore = create<GameState>((set) => ({
  screen: 'splash', previousScreen: 'menu', playerName: 'Alex Rivera', character: 0, cash: 18420, health: 100, wanted: 0,
  mission: 'FIRST LIGHT', district: 'Ocean Drive', settings: initialSettings, motion: initialMotion,
  setScreen: (screen) => set((state) => ({ previousScreen: state.screen, screen })),
  setPlayerName: (playerName) => set({ playerName: playerName.trim() || 'Alex Rivera' }),
  setCharacter: (character) => set({ character }),
  setDistrict: (district) => set({ district }),
  setMotion: (motion) => set({ motion }),
  toggleVehicle: () => set((state) => {
    if (state.motion.mode === 'car') {
      return { motion: { ...state.motion, velocity: { x: 0, y: 0, z: 0 }, mode: 'foot' } }
    }
    const target = getVehicleAccessTarget()
    const takingTrafficCar = target.kind === 'traffic'
    const position = target.kind === 'none' ? state.motion.position : { x: target.x, y: 0, z: target.z }
    const heading = target.kind === 'none' ? state.motion.heading : target.heading
    return {
      wanted: takingTrafficCar ? Math.max(state.wanted, 1) : state.wanted,
      mission: takingTrafficCar ? 'BOOSTED RIDE' : state.mission,
      motion: { ...state.motion, position, heading, velocity: { x: 0, y: 0, z: 0 }, mode: 'car' },
    }
  }),
  updateSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
  resetSave: () => set({ cash: 18420, health: 100, wanted: 0, motion: initialMotion, settings: initialSettings }),
}))
