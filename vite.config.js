import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        clientsClaim: true,
        skipWaiting: true
      },
      manifest: {
        name: 'Money Tracker',
        short_name: 'MoneyTracker',
        description: 'Your personal money tracker',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        icons: [
          {
            "src": "favicon.ico",
            "sizes": "64x64 32x32 24x24 16x16",
            "type": "image/svg+xml"
          },
          {
            "src": "logo.svg",
            "type": "image/svg+xml",
            "sizes": "192x192"
          }
        ]
      }
    })
  ],
})