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

export const API_BASE_URL = runtimeApiBaseUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';

export const WS_URL =
  runtimeWsUrl ||
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV ? '/ws/chat' : 'http://127.0.0.1:8080/ws/chat');
