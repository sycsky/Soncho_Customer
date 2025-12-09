import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Minimize2, Maximize2, User, Bot, WifiOff, RefreshCw } from 'lucide-react';
import websocketService, { ServerMessage, ConnectionStatus } from '../services/websocketService';
import customerService from '../services/customerService';
import './ChatWindow.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent' | 'bot';
  timestamp: number;
  translationData?: Record<string, any>; // 新增: 翻译数据
}

interface ChatWindowProps {
  isEmbedded?: boolean;
  onClose?: () => void;
  userName?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  isEmbedded = false,
  onClose,
  userName,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string>('');
  const [browserLanguage, setBrowserLanguage] = useState<string>('en'); // 新增: 浏览器语言
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeChat();

    return () => {
      websocketService.disconnect();
    };
  }, []);

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      
      // 1. 尝试从本地获取客户信息
      let customerInfo = customerService.getLocalCustomerInfo();
      
      // 2. 如果没有本地信息，从服务器获取
      if (!customerInfo) {
        const browserId = customerService.generateBrowserId();
        const name = userName || `访客_${new Date().getTime().toString().slice(-6)}`;
        
        // 从 URL 读取参数
        const urlParams = new URLSearchParams(window.location.search);
        const metadata = Object.fromEntries(urlParams.entries());

        // 新增: 获取浏览器语言并添加到 metadata
        let language = navigator.language;
        if (language.startsWith('zh')) {
          language = 'zh-TW';
        }
        metadata.language = language;
        setBrowserLanguage(language); // 保存浏览器语言

        customerInfo = await customerService.getCustomerToken({
          name,
          channel: 'WEB',
          channelId: browserId,
          metadata, // 传递 URL 参数
        });
        
        // 保存到本地
        customerService.saveCustomerInfo(customerInfo);
      }
      
      setCustomerId(customerInfo.customerId);
      
      // 设置 sessionId 到 WebSocket 服务
      console.log('💾 设置 sessionId:', customerInfo.sessionId);
      websocketService.setSessionId(customerInfo.sessionId);
      
      // 3. 加载历史消息
      await loadHistoryMessages(customerInfo.sessionId, customerInfo.token);
      
      // 4. 连接 WebSocket
      websocketService.connect(
        customerInfo.token,
        customerInfo.sessionId, // 传入 sessionId
        handleMessage,
        () => setIsConnected(true),
        () => setIsConnected(false),
        handleTokenExpired, // Token 过期回调
        handleStatusChange, // 状态变化回调
        handleHttpError     // HTTP 错误回调
      );
      
      setIsLoading(false);
    } catch (error) {
      console.error('初始化聊天失败:', error);
      setIsLoading(false);
      addMessage({
        id: 'error',
        content: '连接客服失败，请刷新页面重试',
        sender: 'bot',
        timestamp: Date.now(),
      });
    }
  };

  // 加载历史消息
  const loadHistoryMessages = async (sessionId: string, token: string) => {
    try {
      console.log('📥 开始加载历史消息...');
      
      const historyData = await customerService.getHistoryMessages(sessionId, token, 0, 50);
      
      if (historyData.content && historyData.content.length > 0) {
        // 转换历史消息格式
        const historyMessages: Message[] = historyData.content.filter(msg => !msg.internal).map((msg) => {
          let sender: 'user' | 'agent' | 'bot' = 'agent';
          
          // 使用 isMine 来判断是否是自己发送的
          if (msg.isMine) {
            sender = 'user';
          } else if (msg.senderType === 'SYSTEM') {
            sender = 'bot';
          } else if (msg.senderType === 'AGENT') {
            sender = 'agent';
          }
          
          return {
            id: msg.id,
            content: msg.text,
            sender,
            timestamp: new Date(msg.createdAt).getTime(),
            translationData: msg.translationData, // 新增: 传递翻译数据
          };
        });
        
        console.log(`✅ 加载了 ${historyMessages.length} 条历史消息`);
        
        // 按时间排序(从旧到新)
        historyMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        setMessages(historyMessages);
      } else {
        console.log('ℹ️ 没有历史消息，显示欢迎语');
        // 没有历史消息时显示欢迎语
        addMessage({
          id: '0',
          content: '您好！我是 AI 客服助手，有什么可以帮您的吗？',
          sender: 'bot',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('❌ 加载历史消息失败:', error);
      // 加载失败时显示欢迎语
      addMessage({
        id: '0',
        content: '您好！我是 AI 客服助手，有什么可以帮您的吗？',
        sender: 'bot',
        timestamp: Date.now(),
      });
    }
  };

  // Token 过期处理
  const handleTokenExpired = async (): Promise<string | null> => {
    try {
      console.log('⚠️ Token 可能已过期，正在刷新...');
      
      // 从缓存中读取 name 和 channel，不创建新用户
      const cachedName = localStorage.getItem('customer_name');
      const cachedChannel = localStorage.getItem('customer_channel');
      const browserId = customerService.generateBrowserId();
      
      // 必须使用缓存的身份信息
      if (!cachedName || !cachedChannel) {
        console.error('❌ 缺少缓存的用户信息，无法刷新 Token');
        return null;
      }
      
      console.log('🔄 使用缓存身份刷新 Token:', { name: cachedName, channel: cachedChannel });
      
      const customerInfo = await customerService.getCustomerToken({
        name: cachedName,
        channel: cachedChannel as any,
        channelId: browserId,
      });
      
      // 保存新的客户信息
      customerService.saveCustomerInfo(customerInfo);
      setCustomerId(customerInfo.customerId);
      setCustomerToken(customerInfo.token);
      
      // 更新 sessionId
      console.log('💾 更新 sessionId:', customerInfo.sessionId);
      websocketService.setSessionId(customerInfo.sessionId);
      
      console.log('✅ Token 刷新成功，保持原有身份');
      return customerInfo.token;
    } catch (error) {
      console.error('❌ Token 刷新失败:', error);
      return null;
    }
  };

  // 连接状态变化处理
  const handleStatusChange = (status: ConnectionStatus) => {
    setConnectionStatus(status);
    console.log('📡 连接状态:', status);
  };

  // HTTP 错误处理（可以获取到真实的 HTTP 状态码）
  const handleHttpError = (statusCode: number, message: string) => {
    console.error(`🚨 HTTP 错误 ${statusCode}:`, message);
    
    // 401 Token 过期时不显示提示，自动刷新即可
    if (statusCode === 401) {
      console.log('⚠️ Token 过期，正在自动刷新...');
      return; // 不显示消息
    }
    
    let errorMsg = '连接失败';
    
    switch (statusCode) {
      case 403:
        errorMsg = '权限不足，无法连接';
        break;
      case 500:
        errorMsg = '服务器错误，请稍后重试';
        break;
      case 503:
        errorMsg = '服务暂时不可用';
        break;
      default:
        errorMsg = `连接失败 (错误码: ${statusCode})`;
    }
    
    addMessage({
      id: `error-${Date.now()}`,
      content: errorMsg,
      sender: 'bot',
      timestamp: Date.now(),
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMessage = (serverMessage: ServerMessage) => {
    console.log('收到消息:', serverMessage);
    
    // 处理新消息事件
    if (serverMessage.event === 'newMessage' && serverMessage.payload.message) {
      const msg = serverMessage.payload.message;
      
      if (msg.internal) {
        console.log('内部消息，不显示:', msg);
        return;
      }
      let sender: 'user' | 'agent' | 'bot' = 'agent';
      if (msg.senderType === 'CUSTOMER' || msg.customerId === customerId) {
        sender = 'user';
      } else if (msg.senderType === 'SYSTEM') {
        sender = 'bot';
      } else if (msg.senderType === 'AGENT') {
        sender = 'agent';
      }
      
      addMessage({
        id: msg.id,
        content: msg.text,
        sender,
        timestamp: new Date(msg.createdAt).getTime(),
        translationData: msg.translationData, // 新增: 传递翻译数据
      });
      
      // 自动存储 sessionId
      if (serverMessage.payload.sessionId) {
        websocketService.setSessionId(serverMessage.payload.sessionId);
      }
    }
    // 处理其他事件（向后兼容旧格式）
    else if (serverMessage.payload?.message?.text) {
      const msg = serverMessage.payload.message;
      addMessage({
        id: msg.id || Date.now().toString(),
        content: msg.text,
        sender: msg.senderType === 'CUSTOMER' ? 'user' : 'agent',
        timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
      });
    }
  };

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    if (!websocketService.isConnected()) {
      console.error('❌ WebSocket 未连接，无法发送消息');
      addMessage({
        id: Date.now().toString(),
        content: '连接已断开，请稍候重试',
        sender: 'bot',
        timestamp: Date.now(),
      });
      return;
    }

    // 检查 sessionId
    if (!websocketService.getSessionId()) {
      console.error('❌ 缺少 sessionId，无法发送消息');
      addMessage({
        id: Date.now().toString(),
        content: '会话未初始化，请刷新页面重试',
        sender: 'bot',
        timestamp: Date.now(),
      });
      return;
    }

    // 添加用户消息到界面
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: Date.now(),
    };
    addMessage(userMessage);

    // 发送到服务器（使用新格式）
    try {
      websocketService.sendMessage(inputValue);
      setInputValue('');
    } catch (error) {
      console.error('发送消息失败:', error);
      addMessage({
        id: Date.now().toString(),
        content: '消息发送失败，请重试',
        sender: 'bot',
        timestamp: Date.now(),
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return '连接中...';
      case 'connected':
        return '在线';
      case 'reconnecting':
        return '重新连接中...';
      case 'disconnected':
        return '离线';
      case 'error':
        return '连接失败';
      default:
        return '未知';
    }
  };

  const getStatusClass = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'online';
      case 'connecting':
      case 'reconnecting':
        return 'connecting';
      default:
        return 'offline';
    } 
  }; 

  const renderMessageContent = (msg: Message) => {
    let content = msg.content;

    // 检查是否有翻译数据，并且不是用户自己发的消息
    if (msg.sender !== 'user' && msg.translationData) {
      // 尝试获取当前语言的翻译
      const translatedText = msg.translationData[browserLanguage];
      if (translatedText) {
        content = translatedText;
      } else if (msg.translationData.originalText) {
        // 如果没有，回退到 originalText
        content = msg.translationData.originalText;
      }
    }

    // 替换换行符为 <br>
    const contentWithBreaks = content.replace(/\n/g, '<br />');
    return { __html: contentWithBreaks };
  }; 

  const windowClassName = isEmbedded
    ? `chat-window-embedded ${isMinimized ? 'minimized' : ''}`
    : 'chat-window-standalone';

  return (
    <div className={windowClassName}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <Bot size={20} />
          <div>
            <div className="chat-title">AI 客服</div>
            <div className="chat-status">
              {isLoading ? (
                <span className="status-text">连接中...</span>
              ) : (
                <>
                  <span className={`status-dot ${getStatusClass()}`}></span>
                  {getStatusText()}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          {isEmbedded && (
            <button onClick={() => setIsMinimized(!isMinimized)} className="icon-button">
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="icon-button">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {!isMinimized && (
        <>
          <div className="chat-messages">
            {isLoading ? (
              <div className="chat-loading">
                <div className="loading-spinner"></div>
                <p>正在连接客服...</p>
              </div>
            ) : !isConnected ? (
              <div className="chat-disconnected">
                <WifiOff size={48} />
                <p>连接已断开</p>
                <p className="status-hint">{getStatusText()}</p>
                <button onClick={() => websocketService.reconnect()} className="reconnect-button">
                  <RefreshCw size={16} />
                  重新连接
                </button>
              </div>
            ) : null}
            
            {messages.map((msg) => (
              <div key={msg.id} className={`message message-${msg.sender}`}>
                <div className="message-avatar">
                  {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className="message-content">
                  <div 
                    className="message-text" 
                    dangerouslySetInnerHTML={renderMessageContent(msg)} 
                  />
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chat-input-area">
            <input
              type="text"
              className="chat-input"
              placeholder="输入消息..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button 
              onClick={handleSend} 
              className="send-button" 
              disabled={!inputValue.trim() || !isConnected}
              title={!isConnected ? '连接已断开' : ''}
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
