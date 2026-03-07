import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  publicDir: 'assets',
  server: {
    port: 5173,
    open: true,
    host: '0.0.0.0'
  }
})
