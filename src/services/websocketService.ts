import SockJS from 'sockjs-client';
import { WS_URL, API_BASE_URL } from '../config';

// 附件接口
export interface MessageAttachment {
  type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO';
  url: string;
  name: string;
  sizeKb?: number;
}

// 发送消息的 payload（不包含 eventId 和 timestamp）
export interface SendMessagePayload {
  sessionId: string;
  text: string;
  isInternal?: boolean;
  attachments?: MessageAttachment[];
  mentions?: string[];
}

// 发送消息的完整结构（包含外层的 eventId 和 timestamp）
export interface SendMessageRequest {
  event: string;
  payload: SendMessagePayload;
  eventId: string;
  timestamp: number; // Unix 时间戳（毫秒）
}

// 接收到的消息对象
export interface ReceivedMessage {
  id: string;
  sessionId: string;
  senderType: 'AGENT' | 'CUSTOMER' | 'SYSTEM';
  agentId?: string;
  customerId?: string;
  text: string;
  internal: boolean;
  translationData?: Record<string, any>;
  mentions?: string[];
  attachments?: MessageAttachment[];
  createdAt: string;
}

// 服务器消息（事件包装）
export interface ServerMessage {
  event: string;
  payload: {
    sessionId?: string;
    message?: ReceivedMessage;
    [key: string]: any;
  };
}

// 保持向后兼容的旧接口
export interface ChatMessage {
  conversationId?: string;
  senderId: string;
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandler: ((message: ServerMessage) => void) | null = null;
  private reconnectInterval: number = 2000;
  private token: string | null = null;
  private sessionId: string | null = null; // 改为 sessionId
  private shouldReconnect: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private onConnectedCallback: (() => void) | null = null;
  private onDisconnectedCallback: (() => void) | null = null;
  private onTokenExpiredCallback: (() => Promise<string | null>) | null = null;
  private onStatusChangeCallback: ((status: ConnectionStatus) => void) | null = null;
  private onHttpErrorCallback: ((statusCode: number, message: string) => void) | null = null;
  private heartbeatInterval: any = null;

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ event: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      console.log('🔌 Manually disconnected WebSocket.');
    }
  }

  connect(
    token: string, 
    sessionId: string, 
    onMessage: (message: ServerMessage) => void,
    onConnected?: () => void,
    onDisconnected?: () => void,
    onTokenExpired?: () => Promise<string | null>,
    onStatusChange?: (status: ConnectionStatus) => void,
    onHttpError?: (statusCode: number, message: string) => void
  ) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected.');
      return;
    }

    this.token = token;
    this.sessionId = sessionId;
    this.messageHandler = onMessage;
    this.onConnectedCallback = onConnected || null;
    this.onDisconnectedCallback = onDisconnected || null;
    this.onTokenExpiredCallback = onTokenExpired || null;
    this.onStatusChangeCallback = onStatusChange || null;
    this.onHttpErrorCallback = onHttpError || null;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.validateAndConnect();
  }

  /**
   * 验证 Token 后再连接（可以获取 HTTP 状态码）
   */
  private async validateAndConnect() {
    if (!this.token) {
      console.error('❌ 无法建立连接：缺少 token');
      this.updateStatus('error');
      return;
    }

    try {
      console.log('🔍 验证 Token 有效性...');
      
      // 使用专门的验证接口
      const response = await fetch(`${API_BASE_URL}/api/v1/public/validate-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      console.log('📡 HTTP 响应状态码:', response.status);

      // 解析响应体
      let responseData: any = null;
      try {
        responseData = await response.json();
        console.log('📦 响应数据:', responseData);
      } catch (e) {
        console.error('❌ 解析响应失败');
      }

      // 检查 HTTP 状态码或响应体中的验证结果
      const isTokenValid = response.ok && responseData?.data?.valid !== false;
      const tokenError = responseData?.data?.error;

      if (!isTokenValid) {
        const errorMsg = responseData?.data?.message || response.statusText;
        console.error(`❌ Token 验证失败: ${response.status} - ${errorMsg}`);
        
        // 调用 HTTP 错误回调
        if (this.onHttpErrorCallback) {
          this.onHttpErrorCallback(response.status, errorMsg);
        }

        // 检查是否是 Token 过期（HTTP 401 或响应体中标记为 TOKEN_EXPIRED）
        if (response.status === 401 || tokenError === 'TOKEN_EXPIRED') {
          console.warn('⚠️ Token 无效或过期，正在刷新...');
          await this.handlePossibleTokenExpiry();
        } else if (response.status === 403) {
          console.error('❌ 权限不足 (HTTP 403)');
          this.updateStatus('error');
        } else {
          console.error('❌ 验证失败，尝试重连');
          this.attemptReconnect();
        }
        return;
      }

      console.log('✅ Token 验证成功，建立 WebSocket 连接');
      this.createWebSocket();
      
    } catch (error) {
      console.error('❌ Token 验证异常:', error);
      this.attemptReconnect();
    }
  }

  private createWebSocket() {
    if (!this.token || !this.shouldReconnect) {
      console.error('❌ 无法建立 WebSocket 连接：缺少 token');
      this.updateStatus('error');
      return;
    }

    const sockJsUrl = `${WS_URL}?token=${this.token}`;
    console.group('🔌 WebSocket 连接');
    console.log('URL:', sockJsUrl.replace(/token=[^&]+/, 'token=***'));
    console.log('时间:', new Date().toISOString());
    console.log('重连次数:', this.reconnectAttempts);
    console.groupEnd();
    
    this.updateStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    
    // 配置 SockJS 选项
    this.socket = new SockJS(sockJsUrl, null, {
      transports: ['websocket', 'xhr-streaming', 'xhr-polling']
    }) as any;

    if (this.socket) {
      this.socket.onopen = () => {
        console.log('✅ WebSocket 连接成功');
        this.reconnectAttempts = 0; // 重置重连次数
        this.updateStatus('connected');
        this.startHeartbeat();
        
        // 调用连接成功回调
        if (this.onConnectedCallback) {
          this.onConnectedCallback();
        }
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📥 收到消息:', message);
          
          // 检查是否包含 sessionId，自动存储
          if (message.payload?.sessionId && !this.sessionId) {
            console.log('💾 自动存储 sessionId:', message.payload.sessionId);
            this.sessionId = message.payload.sessionId;
          }
          
          if (this.messageHandler) {
            this.messageHandler(message);
          }
        } catch (error) {
          console.error('❌ 解析消息失败:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('❌ WebSocket 错误:', error);
        // onerror 后会立即触发 onclose，在 onclose 中处理
      };

      this.socket.onclose = (event: any) => {
        console.group('🔌 WebSocket 关闭');
        console.log('关闭码:', event.code);
        console.log('关闭原因:', event.reason || '无');
        console.log('是否正常关闭:', event.wasClean);
        console.groupEnd();
        
        this.socket = null;
        this.stopHeartbeat(); // 停止心跳
        this.updateStatus('disconnected');
        
        // 调用断开连接回调
        if (this.onDisconnectedCallback) {
          this.onDisconnectedCallback();
        }
        
        // 根据关闭码判断处理策略
        this.handleDisconnection(event.code);
      };
    }
  }

  private handleDisconnection(closeCode: number) {
    // 1006: 异常关闭，可能是 token 过期或网络问题
    // 1000: 正常关闭
    // 1001: 端点离开
    
    if (closeCode === 1006) {
      // 可能是 token 过期，尝试刷新 token
      console.warn('⚠️ 检测到异常关闭 (1006)，可能是 token 过期');
      this.handlePossibleTokenExpiry();
    } else if (closeCode === 1000 || closeCode === 1001) {
      // 正常关闭，不重连
      console.log('ℹ️ WebSocket 正常关闭');
      this.shouldReconnect = false;
    } else if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      // 其他错误码，尝试重连
      this.attemptReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ 达到最大重连次数，停止重连');
      this.updateStatus('error');
    }
  }

  private async handlePossibleTokenExpiry() {
    if (!this.onTokenExpiredCallback) {
      // 没有 token 刷新回调，尝试普通重连
      this.attemptReconnect();
      return;
    }

    try {
      console.log('🔄 尝试刷新 token...');
      const newToken = await this.onTokenExpiredCallback();
      
      if (newToken) {
        console.log('✅ Token 刷新成功');
        this.token = newToken;
        this.reconnectAttempts = 0; // 重置重连次数
        this.validateAndConnect();
      } else {
        console.error('❌ Token 刷新失败，尝试普通重连');
        this.attemptReconnect();
      }
    } catch (error) {
      console.error('❌ Token 刷新异常:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ 无法重连：已达到最大重连次数或不允许重连');
      this.updateStatus('error');
      return;
    }

    this.reconnectAttempts++;
    
    // 使用指数退避算法计算延迟
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      10000 // 最大延迟 10 秒
    );
    
    console.log(
      `🔄 将在 ${delay}ms 后进行第 ${this.reconnectAttempts}/${this.maxReconnectAttempts} 次重连...`
    );
    
    this.updateStatus('reconnecting');
    setTimeout(() => this.validateAndConnect(), delay);
  }

  private updateStatus(status: ConnectionStatus) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }

  /**
   * 生成唯一的 eventId
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 发送消息（新格式：eventId 和 timestamp 在外层）
   */
  sendMessage(
    text: string, 
    options?: {
      isInternal?: boolean;
      attachments?: MessageAttachment[];
      mentions?: string[];
    }
  ) {
    if (!this.sessionId) {
      console.error('❌ 缺少 sessionId，无法发送消息');
      throw new Error('缺少 sessionId');
    }

    const payload: SendMessagePayload = {
      sessionId: this.sessionId,
      text,
      isInternal: options?.isInternal || false,
      attachments: options?.attachments || [],
      mentions: options?.mentions || [],
    };

    const message: SendMessageRequest = {
      event: 'sendMessage',
      payload,
      eventId: this.generateEventId(),
      timestamp: Date.now(), // Unix 时间戳（毫秒）
    };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('📤 发送消息:', message);
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket 未连接，无法发送消息');
      throw new Error('WebSocket 未连接');
    }
  }

  /**
   * 设置 sessionId（用于后续发送消息）
   */
  setSessionId(sessionId: string) {
    console.log('💾 设置 sessionId:', sessionId);
    this.sessionId = sessionId;
  }

  /**
   * 获取当前 sessionId
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  sendEvent(event: string, payload: any) {
    const eventMessage = { event, payload };
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(eventMessage));
    }
  }

  /**
   * 获取当前连接状态
   */
  getConnectionState(): number {
    return this.socket?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * 手动触发重连
   */
  reconnect() {
    console.log('🔄 手动触发重连');
    this.reconnectAttempts = 0;
    this.shouldReconnect = true;
    this.validateAndConnect();
  }
}

const websocketService = new WebSocketService();
export default websocketService;
