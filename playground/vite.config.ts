import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import myPlugin from '../src/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    myPlugin(),
    react(),
  ],

})
