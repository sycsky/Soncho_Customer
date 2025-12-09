// API 配置
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';

// 开发环境使用代理，生产环境使用完整 URL
export const WS_URL = import.meta.env.VITE_WS_URL || (import.meta.env.DEV ? '/ws/chat' : 'http://127.0.0.1:8080/ws/chat');
