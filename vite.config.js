import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Game/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        id: '/Game/',
        name: 'Football Life',
        short_name: 'Football Life',
        description: 'Мобільна 2D-кар’єра футболіста з дорослим життям та наслідками рішень.',
        lang: 'uk',
        start_url: '/Game/',
        scope: '/Game/',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        background_color: '#08130e',
        theme_color: '#08130e',
        icons: [{src: '/Game/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable'}]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/Game/index.html',
        globPatterns: ['**/*.{html,js,css,svg,png,ico,webp}']
      }
    })
  ]
});
