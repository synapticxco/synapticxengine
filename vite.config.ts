        import { defineConfig } from 'vite'
        import react from '@vitejs/plugin-react'

        // https://vitejs.dev/config/
        export default defineConfig({
          plugins: [react()],
          server: {
            proxy: {
              // Proxy API requests starting with /api to your Express backend
              '/api': {
                target: 'http://localhost:5000', // Your Express backend's internal URL
                changeOrigin: true, // Recommended for virtual hosted sites
                // secure: false, // Uncomment if issues with self-signed SSL in dev, unlikely needed here
                // No rewrite needed if your Express routes already include /api
              }
            }
          }
        })
        