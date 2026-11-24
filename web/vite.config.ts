/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Listen on the LAN too, so phones on the same Wi-Fi can open the dev/preview server.
  server: {
    host: true,
    // Re-read a changed file only once its size has held steady for 100 ms. On Windows a save
    // can empty the file before writing it, and an edit plus the Prettier hook save twice in
    // a row; reading in that gap once cached a blank module and broke every page until restart.
    watch: { awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 } },
  },
  preview: { host: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
