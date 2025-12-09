import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isWidget = mode === 'widget';

  return {
    plugins: [react()],
    define: {
      global: 'globalThis',
    },
    build: {
      outDir: isWidget ? 'dist-widget' : 'dist',
      rollupOptions: isWidget
        ? {
            // Widget 模式：构建为单个可嵌入的文件
            input: path.resolve(__dirname, 'src/widget.tsx'),
            output: {
              entryFileNames: 'chat-widget.js',
              assetFileNames: 'chat-widget.[ext]',
              format: 'iife',
              name: 'AIChatWidget',
            },
          }
        : {
            // 独立页面模式：正常构建
            input: path.resolve(__dirname, 'index.html'),
          },
    },
    server: {
      port: 3001,
      host: '0.0.0.0',
      proxy: {
        // 代理 WebSocket 请求到后端
        '/ws': {
          target: 'http://127.0.0.1:8080',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
