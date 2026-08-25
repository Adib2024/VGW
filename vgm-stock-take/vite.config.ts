import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg', 'vw-logo.svg', 'car-golf.webp', 'fonts/inter-latin-variable.woff2'],
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
      },
      workbox: {
        // xlsx (Admin upload) and html5-qrcode (Battery scanner) are large
        // and role-gated - most users (Counters) can never reach either
        // route. Precaching them unconditionally at install time would cost
        // every user that download regardless of role; cache them on first
        // actual use instead.
        globIgnores: ['**/xlsx-vendor-*.js', '**/html5-qrcode-vendor-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(xlsx|html5-qrcode)-vendor-.*\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'heavy-vendor-chunks' },
          },
        ],
      },
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // html5-qrcode's dynamic import otherwise gets an unhelpful generic
        // "index-[hash].js" name (Rollup couldn't derive one from the
        // package), making it impossible to target safely in globIgnores
        // above without risking excluding the real main entry chunk too.
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'xlsx-vendor';
          if (id.includes('node_modules/html5-qrcode')) return 'html5-qrcode-vendor';
        },
      },
    },
  },
})
