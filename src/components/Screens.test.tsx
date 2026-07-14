import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useGameStore } from '../state/gameStore'

vi.mock('../game/GameScreen', () => ({ GameScreen: () => <div>GAME WORLD</div> }))

describe('complete screen flow', () => {
  beforeEach(() => useGameStore.setState({ screen: 'splash', previousScreen: 'menu', playerName: 'Alex Rivera' }))
  it('opens from splash into the main menu', () => { render(<App />); fireEvent.click(screen.getByRole('button', { name: /enter the city/i })); expect(screen.getByText(/the city wakes/i)).toBeInTheDocument() })
  it('starts a new story through character choice', () => { render(<App />); fireEvent.click(screen.getByRole('button', { name: /enter the city/i })); fireEvent.click(screen.getByRole('button', { name: /new story/i })); expect(screen.getByText(/choose your story/i)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: /maya torres/i })); expect(useGameStore.getState().character).toBe(1) })
  it.each([['MAP','CITY MAP'],['GARAGE','GARAGE'],['PROGRESS','PROGRESS'],['SETTINGS','SETTINGS']])('opens the %s section', (button, title) => { useGameStore.setState({ screen: 'menu' }); render(<App />); fireEvent.click(screen.getByRole('button', { name: button })); expect(screen.getByText(title, { selector: 'h2' })).toBeInTheDocument() })
  it('preserves a valid non-empty player name', () => { useGameStore.getState().setPlayerName('   '); expect(useGameStore.getState().playerName).toBe('Alex Rivera') })
})
