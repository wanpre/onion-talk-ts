import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // 前端源码根目录（src/client）
  root: resolve(__dirname, 'src/client'),

  build: {
    outDir: resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      // 使用绝对路径指定入口文件（最可靠方式）
      input: resolve(__dirname, 'src/client/index.html')
    }
  },

  server: {
    port: 5173,
    proxy: {
      // HTTP API 代理
      '/create-room': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/join-room': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      // WebSocket 代理
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      }
    }
  }
});
