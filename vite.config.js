import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    watch: {
      ignored: ['**/*.zip', '**/node.zip', '**/*.mp4', '**/*.png', '**/dist/**', '**/node/**']
    },
    proxy: {
      // Dev-only: proxy API requests to the local backend server so the
      // frontend can call relative "/api/..." paths without CORS during
      // `npm run dev`. In production, Express itself serves both the built
      // frontend and the API from the same origin/port, so this proxy is
      // never used there.
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: false,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        }
      }
    }
  },
  preview: {
    host: true,
    allowedHosts: true,
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: false,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  }
})