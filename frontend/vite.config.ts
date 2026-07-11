import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const projectRoot = fileURLToPath(new URL('.', import.meta.url))
  const workspaceRoot = fileURLToPath(new URL('..', import.meta.url))
  const env = loadEnv(mode, workspaceRoot, '')
  const publicKey =
    env.MERCADO_PAGO_PUBLIC_KEY || env.VITE_MERCADO_PAGO_PUBLIC_KEY || ''

  return {
    root: projectRoot,
    envDir: workspaceRoot,
    define: {
      __MERCADO_PAGO_PUBLIC_KEY__: JSON.stringify(publicKey),
    },
    build: {
      outDir: fileURLToPath(new URL('../dist', import.meta.url)),
      emptyOutDir: true,
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
