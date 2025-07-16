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
      host: true,
      port: 5173,
      open: false,
      cors: true
    },
    build: {
      outDir: '../../dist',
      assetsDir: 'assets',
      sourcemap: true,
      emptyOutDir: true,
    },
  }
})
