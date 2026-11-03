import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'maskable-512.png'],
      manifest: {
        name: 'Engramme',
        short_name: 'Engramme',
        description: 'Ton second cerveau : notes, liens, recherche et assistant IA.',
        lang: 'fr',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        background_color: '#1c1c1f',
        theme_color: '#1c1c1f',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
