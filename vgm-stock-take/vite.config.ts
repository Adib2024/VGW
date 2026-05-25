import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg'],
      manifest: {
        name: 'VGM CKD',
        short_name: 'VGM CKD',
        description: 'VGM CKD App for efficient warehouse auditing',
        theme_color: '#001e50',
        background_color: '#f0f9ff',
        display: 'standalone',
        icons: [
          {
            src: 'app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ],
})
