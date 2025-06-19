import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }

  return {
    plugins: [react()],
    root: 'src/frontend',
    css: {
      postcss: './postcss.config.js',
    },
    server: {
      port: 3000,
      open: true,
      cors: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: '../../dist',
      assetsDir: 'assets',
      sourcemap: true,
      emptyOutDir: true,
    },
  }
})
