import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 5173,
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        ws: true  // WebSocket Support!
      },
      '/chat': {
        target: 'http://localhost:4000',
        ws: true
      },
      '/auth': {
        target: 'http://localhost:4000',
      }
    }
  },
  optimizeDeps: {
    exclude: ['@apollo/client', 'graphql-ws']
  }
})