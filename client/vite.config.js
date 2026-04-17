import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/process': 'http://localhost:5000',
      '/video': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
    },
  },
})
