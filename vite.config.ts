import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isWidget = mode === 'widget';
  
  // 判断是否使用内网映射
  const useTunnel = env.VITE_USE_TUNNEL === 'true' || mode === 'tunnel';
  
  // HMR 配置
  const hmrConfig = useTunnel ? {
    protocol: (env.VITE_HMR_PROTOCOL as 'ws' | 'wss') || 'ws',
    host: env.VITE_HMR_HOST || undefined,
    clientPort: env.VITE_HMR_PORT ? parseInt(env.VITE_HMR_PORT) : 3001,
    timeout: 60000,
    overlay: true,
  } : {
    protocol: 'ws' as const,
    clientPort: 3001,
    timeout: 60000,
    overlay: true,
  };

  return {
    plugins: [
      react(),
      isWidget && cssInjectedByJsPlugin(),
    ],
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
      // HMR 配置 - 自动适配内网映射
      hmr: env.VITE_DISABLE_HMR === 'true' ? false : hmrConfig,
      // 文件监听配置 - 内网映射时使用轮询模式
      watch: useTunnel ? {
        usePolling: true,
        interval: 1000,
      } : undefined,
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
