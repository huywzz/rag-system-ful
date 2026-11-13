import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  // same-origin /api in dev, so Better Auth cookies just work (no CORS)
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
