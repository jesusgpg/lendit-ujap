import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project from /lendit-ujap/; Vercel serves it from the domain root.
  base: process.env.GH_PAGES ? '/lendit-ujap/' : '/',
  plugins: [vue()],
})
