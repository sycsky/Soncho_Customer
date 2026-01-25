type RuntimeWidgetConfig = {
  apiBaseUrl?: string;
  wsUrl?: string;
};

const runtimeWidgetConfig: RuntimeWidgetConfig | undefined =
  typeof window !== 'undefined' ? (window as any).AI_CHAT_CONFIG : undefined;

const runtimeApiBaseUrl =
  typeof runtimeWidgetConfig?.apiBaseUrl === 'string' && runtimeWidgetConfig.apiBaseUrl.trim()
    ? runtimeWidgetConfig.apiBaseUrl.trim()
    : undefined;

const runtimeWsUrl =
  typeof runtimeWidgetConfig?.wsUrl === 'string' && runtimeWidgetConfig.wsUrl.trim()
    ? runtimeWidgetConfig.wsUrl.trim()
    : undefined;

// 使用 let 导出，允许运行时修改
export let API_BASE_URL = runtimeApiBaseUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';

export let WS_URL =
  runtimeWsUrl ||
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV ? '/ws/chat' : 'http://127.0.0.1:8080/ws/chat');

// 运行时设置配置的方法
export const setRuntimeConfig = (config: RuntimeWidgetConfig) => {
  if (config.apiBaseUrl) {
    API_BASE_URL = config.apiBaseUrl;
  }
  if (config.wsUrl) {
    WS_URL = config.wsUrl;
  } else if (config.apiBaseUrl) {
    // 如果设置了 API URL 但没设置 WS URL，尝试推断 WS URL
    try {
      const url = new URL(config.apiBaseUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      WS_URL = `${protocol}//${url.host}/ws/chat`;
    } catch (e) {
      // 忽略错误
    }
  }
};
