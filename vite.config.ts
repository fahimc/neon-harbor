import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1400 },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
})
