import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config';
import { ChatWindow } from './components/ChatWindow';
import { WidgetLauncher } from './components/WidgetLauncher';
import { Toaster } from 'sonner';
import './index.css';
import './components/ChatWindow.css';

// Widget 配置
interface WidgetConfig {
  userName?: string;
  mode?: 'bubble' | 'search';
  apiBaseUrl?: string;
  wsUrl?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  welcomeMessage?: string;
  shop?: string;
}

const WidgetApp: React.FC<{ config: WidgetConfig }> = ({ config }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined);

  const handleOpen = (msg?: string) => {
    if (!hasOpened) {
      setHasOpened(true);
    }
    setInitialMessage(msg);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // 稍微延迟清除 initialMessage，以免动画过程中内容变化
    setTimeout(() => setInitialMessage(undefined), 300);
  };

  return (
    <>
      <Toaster position="top-center" richColors expand style={{ zIndex: 2147483647 }} />
      <WidgetLauncher 
        mode={config.mode || 'bubble'} 
        isOpen={isOpen} 
        onOpen={handleOpen}
        primaryColor={config.primaryColor}
        position={config.position}
      />
      <div style={{ display: isOpen ? 'block' : 'none' }}>
        {hasOpened && (
          <ChatWindow
            isEmbedded={true}
            onClose={handleClose}
            userName={config.userName}
            initialMessage={initialMessage}
            primaryColor={config.primaryColor}
            welcomeMessage={config.welcomeMessage}
            shop={config.shop}
            position={config.position}
          />
        )}
      </div>
    </>
  );
};

class AIChatWidget {
  private root: ReactDOM.Root | null = null;
  private container: HTMLDivElement | null = null;
  private config: WidgetConfig = {};

  constructor(config?: WidgetConfig) {
    this.config = config || {};
    this.init();
  }

  private init() {
    // 检查是否已经存在容器
    if (document.getElementById('ai-chat-widget-root')) return;

    // 创建容器
    this.container = document.createElement('div');
    this.container.id = 'ai-chat-widget-root';
    document.body.appendChild(this.container);

    // 渲染 React 组件
    this.root = ReactDOM.createRoot(this.container);
    this.root.render(
      <React.StrictMode>
        <WidgetApp config={this.config} />
      </React.StrictMode>
    );
  }

  destroy() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  static init(config?: WidgetConfig) {
    if (typeof window === 'undefined') return null;
    const mergedConfig = Object.assign({}, (window as any).AI_CHAT_CONFIG || {}, config || {});
    if (window.aiChatWidget) {
      window.aiChatWidget.destroy();
    }
    window.aiChatWidget = new AIChatWidget(mergedConfig);
    return window.aiChatWidget;
  }
}

// 全局暴露
declare global {
  interface Window {
    AIChatWidget: typeof AIChatWidget;
    aiChatWidget?: AIChatWidget;
  }
}

window.AIChatWidget = AIChatWidget;

if (typeof window !== 'undefined') {
  const init = () => {
    AIChatWidget.init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

export default AIChatWidget;
