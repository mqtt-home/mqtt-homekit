import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the same build works at / (bridge) and under a
  // GitHub Pages sub-path.
  base: './',
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        showcase: path.resolve(import.meta.dirname, 'showcase.html'),
      },
    },
  },
})
