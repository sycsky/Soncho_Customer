import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatWindow } from './components/ChatWindow';
import { MessageCircle } from 'lucide-react';
import './index.css';
import './components/ChatWindow.css';

// Widget 配置
interface WidgetConfig {
  userName?: string;
}

class AIChatWidget {
  private root: ReactDOM.Root | null = null;
  private container: HTMLDivElement | null = null;
  private isOpen: boolean = false;
  private config: WidgetConfig = {};

  constructor(config?: WidgetConfig) {
    this.config = config || {};
    this.init();
  }

  private init() {
    // 创建容器
    this.container = document.createElement('div');
    this.container.id = 'ai-chat-widget-container';
    document.body.appendChild(this.container);

    // 创建触发按钮
    this.createTriggerButton();
  }

  private createTriggerButton() {
    const button = document.createElement('div');
    button.id = 'ai-chat-widget-trigger';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      z-index: 9998;
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    button.addEventListener('click', () => {
      this.toggle();
    });

    document.body.appendChild(button);
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    // 隐藏触发按钮
    const trigger = document.getElementById('ai-chat-widget-trigger');
    if (trigger) {
      trigger.style.display = 'none';
    }

    // 渲染聊天窗口
    if (this.container) {
      this.root = ReactDOM.createRoot(this.container);
      this.root.render(
        <React.StrictMode>
          <ChatWindow
            isEmbedded={true}
            onClose={() => this.close()}
            userName={this.config.userName}
          />
        </React.StrictMode>
      );
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    // 卸载组件
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    // 显示触发按钮
    const trigger = document.getElementById('ai-chat-widget-trigger');
    if (trigger) {
      trigger.style.display = 'flex';
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy() {
    this.close();
    
    // 移除容器和按钮
    const trigger = document.getElementById('ai-chat-widget-trigger');
    if (trigger) {
      trigger.remove();
    }
    
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
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

// 自动初始化（如果页面有配置）
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const config = (window as any).AI_CHAT_CONFIG || {};
    window.aiChatWidget = new AIChatWidget(config);
  });
}

export default AIChatWidget;
