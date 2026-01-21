import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, X, Minimize2, Maximize2, User, Bot, WifiOff, RefreshCw, Globe } from 'lucide-react';
import websocketService, { ServerMessage, ConnectionStatus, MessageAttachment } from '../services/websocketService';
import customerService from '../services/customerService';
import { ProductCard, GiftCard, DiscountCard, OrderCard } from './MessageCards';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ChatWindow.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent' | 'bot' | 'system';
  timestamp: number;
  messageType?: string; // 新增: 消息类型
  translationData?: Record<string, any>; // 新增: 翻译数据
  attachments?: MessageAttachment[]; // 新增: 附件
}

interface ChatWindowProps {
  isEmbedded?: boolean;
  onClose?: () => void;
  userName?: string;
  initialMessage?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  shop?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  isEmbedded = false,
  onClose,
  userName,
  initialMessage,
  primaryColor,
  welcomeMessage,
  shop,
  position = 'bottom-right',
}) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [hasSentInitialMessage, setHasSentInitialMessage] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerToken, setCustomerToken] = useState<string>(''); // 新增: 保存 token
  const [browserLanguage, setBrowserLanguage] = useState<string>('en');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '简体中文' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'ja', label: '日本語' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
    { code: 'ar', label: 'العربية' },
    { code: 'ko', label: '한국어' },
  ];

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setBrowserLanguage(code);
    setShowLanguageMenu(false);
  };

  const toggleLanguage = () => {
    setShowLanguageMenu(!showLanguageMenu);
  };

  // 计算位置样式
  const getPositionStyle = () => {
    if (!isEmbedded) return {};
    
    switch (position) {
      case 'bottom-left':
        return { bottom: '20px', left: '20px', right: 'auto', top: 'auto' };
      case 'top-right':
        return { top: '20px', right: '20px', bottom: 'auto', left: 'auto' };
      case 'top-left':
        return { top: '20px', left: '20px', bottom: 'auto', right: 'auto' };
      case 'bottom-right':
      default:
        return { bottom: '20px', right: '20px', top: 'auto', left: 'auto' };
    }
  };

  useEffect(() => {
    initializeChat();

    return () => {
      // 在组件卸载时断开连接
      websocketService.disconnect();
    };
  }, []);

  const initializeChat = async () => {
    try {
      setIsLoading(true);

      // 语言处理逻辑：缓存 -> 浏览器匹配 -> 默认英文
      let targetLang = 'en';
      const cachedLang = localStorage.getItem('i18nextLng');
      
      // 检查缓存语言是否有效（在支持列表中）
      if (cachedLang && languages.some(l => l.code === cachedLang)) {
        targetLang = cachedLang;
      } else {
        // 没有有效缓存，尝试浏览器语言
        let browserLang = navigator.language;
        
        // 特殊处理中文
        if (browserLang === 'zh-CN') {
          browserLang = 'zh';
        } else if (browserLang.startsWith('zh') && browserLang !== 'zh') {
          // 保持 zh-TW 等
        } else if (browserLang.startsWith('zh')) {
          browserLang = 'zh-TW';
        }

        // 检查是否在支持列表中
        const isSupported = languages.some(l => l.code === browserLang);
        if (isSupported) {
          targetLang = browserLang;
        } else {
          targetLang = 'en';
        }
      }

      // 如果当前语言不一致，切换语言
      if (i18n.language !== targetLang) {
        i18n.changeLanguage(targetLang);
      }
      setBrowserLanguage(targetLang);
      
      // 1. 尝试从本地获取客户信息 (带 shop 参数)
      let customerInfo = customerService.getLocalCustomerInfo(shop);
      
      // 2. 如果没有本地信息，从服务器获取
      if (!customerInfo) {
        const browserId = customerService.generateBrowserId();
        // 生成基础名称并添加随机5位数字后缀
        const baseName = userName || `访客_${new Date().getTime().toString().slice(-6)}`;
        const randomSuffix = Math.floor(10000 + Math.random() * 90000);
        const name = `${baseName}_${randomSuffix}`;
        
        // 从 URL 读取参数
        const urlParams = new URLSearchParams(window.location.search);
        const metadata = Object.fromEntries(urlParams.entries());

        // 新增: 获取浏览器语言并添加到 metadata
        metadata.language = targetLang;
       
        customerInfo = await customerService.getCustomerToken({
          name,
          channel: 'WEB',
          channelId: browserId,
          shop, // 传递 shop 参数
          metadata, // 传递 URL 参数
        });
        
        // 保存到本地 (带 shop 参数)
        customerService.saveCustomerInfo(customerInfo, shop);
      }
      
      setCustomerId(customerInfo.customerId);
      setCustomerName(customerInfo.name);
      setCustomerToken(customerInfo.token); // 保存 token
      
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
        content: t('init_failed'),
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
        const historyMessages: Message[] = historyData.content
          .filter(msg => !msg.internal && msg.senderType !== 'SYSTEM') // 过滤掉内部消息和系统消息
          .map((msg) => {
          let sender: 'user' | 'agent' | 'bot' | 'system' = 'agent';
          
          // 使用 isMine 来判断是否是自己发送的
          if (msg.isMine) {
            sender = 'user';
          } else if (msg.senderType === 'AGENT') {
            sender = 'agent';
          }
          
          return {
            id: msg.id,
            content: msg.text,
            sender,
            timestamp: new Date(msg.createdAt).getTime(),
            messageType: msg.messageType, // 新增: 消息类型
            translationData: msg.translationData, // 新增: 传递翻译数据
            attachments: msg.attachments, // 新增: 加载附件
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
          content: welcomeMessage || t('welcome_default'),
          sender: 'bot',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('❌ 加载历史消息失败:', error);
      // 加载失败时显示欢迎语
      addMessage({
        id: '0',
        content: welcomeMessage || t('welcome_default'),
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
      const localInfo = customerService.getLocalCustomerInfo(shop);
      const cachedName = localInfo?.name;
      const cachedChannel = localInfo?.channel;
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
        shop, // 传递 shop 参数
      });
      
      // 保存新的客户信息 (带 shop 参数)
      customerService.saveCustomerInfo(customerInfo, shop);
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
    
    let errorMsg = t('connection_failed');
    
    switch (statusCode) {
      case 403:
        errorMsg = t('permission_denied');
        break;
      case 500:
        errorMsg = t('server_error');
        break;
      case 503:
        errorMsg = t('service_unavailable');
        break;
      default:
        errorMsg = t('conn_failed_code', { code: statusCode });
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
      
      if (msg.internal || msg.senderType === 'SYSTEM') {
        console.log('内部消息或系统消息，不显示:', msg);
        return;
      }
      let sender: 'user' | 'agent' | 'bot' | 'system' = 'agent';
      if (msg.senderType === 'CUSTOMER' || msg.customerId === customerId) {
        sender = 'user';
      } else if (msg.senderType === 'AGENT') {
        sender = 'agent';
      }
      
      addMessage({
        id: msg.id,
        content: msg.text,
        sender,
        timestamp: new Date(msg.createdAt).getTime(),
        messageType: msg.messageType, // 新增: 消息类型
        translationData: msg.translationData, // 新增: 传递翻译数据
        attachments: msg.attachments, // 新增: 处理附件
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
    setMessages((prev) => {
      // 检查是否存在相同 ID 的消息
      const exists = prev.some((msg) => msg.id === message.id);
      if (exists) {
        return prev;
      }
      return [...prev, message];
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessageContent = (messageContent: string, shouldClearInput: boolean) => {
    if (!messageContent.trim()) return;

    if (!websocketService.isConnected()) {
      console.error('❌ WebSocket 未连接，无法发送消息');
      addMessage({
        id: Date.now().toString(),
        content: t('disconnected_retry'),
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
        content: t('session_not_init'),
        sender: 'bot',
        timestamp: Date.now(),
      });
      return;
    }

    // 添加用户消息到界面
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      sender: 'user',
      timestamp: Date.now(),
    };
    addMessage(userMessage);

    // 发送到服务器（使用新格式）
    try {
      websocketService.sendMessage(messageContent);
      if (shouldClearInput) {
        setInputValue('');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      addMessage({
        id: Date.now().toString(),
        content: t('send_failed'),
        sender: 'bot',
        timestamp: Date.now(),
      });
    }
  };

  // 监听连接状态和初始消息
  useEffect(() => {
    if (isConnected && initialMessage && !hasSentInitialMessage) {
      sendMessageContent(initialMessage, false);
      setHasSentInitialMessage(true);
    }
  }, [isConnected, initialMessage, hasSentInitialMessage]);

  // 监听语言变化，实时更新欢迎语
  useEffect(() => {
    if (!welcomeMessage) {
      setMessages((prevMessages) => 
        prevMessages.map((msg) => {
          if (msg.id === '0') {
            return {
              ...msg,
              content: t('welcome_default')
            };
          }
          return msg;
        })
      );
    }
  }, [i18n.language, t, welcomeMessage]);

  const handleSend = () => {
    sendMessageContent(inputValue, true);
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
        return t('connecting');
      case 'connected':
        return t('online');
      case 'reconnecting':
        return t('reconnecting');
      case 'disconnected':
        return t('offline');
      case 'error':
        return t('connection_failed');
      default:
        return t('unknown');
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

  const renderMessageBody = (msg: Message) => {
    if (msg.messageType && msg.messageType.startsWith('CARD_')) {
      try {
        const cardData = JSON.parse(msg.content);
        switch (msg.messageType) {
          case 'CARD_PRODUCT':
            return <ProductCard data={cardData} />;
          case 'CARD_GIFT':
            return <GiftCard data={cardData} />;
          case 'CARD_DISCOUNT':
            return <DiscountCard data={cardData} />;
          case 'CARD_ORDER':
            return <OrderCard data={cardData} onSendMessage={(content) => sendMessageContent(content, true)} />;
          default:
            return <div className="message-text">Unsupported card type</div>;
        }
      } catch (e) {
        console.error('Failed to parse card data:', e);
        return <div className="message-text">Invalid card data</div>;
      }
    }

    const { content } = renderMessageContent(msg);

    return (
      <div 
        className="message-text markdown-body"
        style={msg.sender === 'user' && primaryColor ? { backgroundColor: primaryColor } : undefined}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    );
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

    return { content };
  }; 

  const windowClassName = isEmbedded
    ? `chat-window-embedded ${isMinimized ? 'minimized' : ''}`
    : 'chat-window-standalone';

  return (
    <div className={windowClassName} style={getPositionStyle()}>
      {/* Header */}
      <div className="chat-header" style={{ backgroundColor: primaryColor }}>
        <div className="chat-header-info">
          <Bot size={20} />
          <div>
            <div className="chat-title">{t('ai_agent')}</div>
            <div className="chat-status">
              {isLoading ? (
                <span className="status-text">{t('connecting')}</span>
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
          <div className="language-selector-wrapper">
            <button onClick={toggleLanguage} className="icon-button" title={t('switch_language')}>
              <Globe size={16} />
            </button>
            {showLanguageMenu && (
              <div className="language-menu">
                {languages.map(lang => (
                  <div 
                    key={lang.code} 
                    onClick={() => changeLanguage(lang.code)} 
                    className={`language-item ${i18n.language === lang.code ? 'active' : ''}`}
                  >
                    {lang.label}
                  </div>
                ))}
              </div>
            )}
          </div>
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
                <p>{t('connecting_message')}</p>
              </div>
            ) : !isConnected ? (
              <div className="chat-disconnected">
                <WifiOff size={48} />
                <p>{t('disconnected')}</p>
                <p className="status-hint">{getStatusText()}</p>
                <button onClick={() => websocketService.reconnect()} className="reconnect-button">
                  <RefreshCw size={16} />
                  {t('reconnect')}
                </button>
              </div>
            ) : null}
            
            {messages.map((msg) => {
              const isCard = msg.messageType && msg.messageType.startsWith('CARD_');

              return (
              <div key={msg.id} className={`message message-${msg.sender} ${isCard ? 'message-card-type' : ''}`}>
                <div className="message-avatar" style={msg.sender === 'user' && primaryColor ? { backgroundColor: primaryColor } : undefined}>
                  {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className="message-content">
                  {renderMessageBody(msg)}
                  {/* 新增: 渲染附件 */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="attachments">
                      {msg.attachments.map((att, index) => (
                        <div key={index} className="attachment-item">
                          {att.type === 'IMAGE' ? (
                            <a href={att.url} target="_blank" rel="noopener noreferrer">
                              <img src={att.url} alt={att.name} className="attachment-image" />
                            </a>
                          ) : (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="attachment-file">
                              {att.name}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            )})}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chat-input-area">
            <input
              type="text"
              className="chat-input"
              placeholder={t('type_message')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button 
              onClick={handleSend} 
              className="send-button" 
              style={{ backgroundColor: primaryColor }}
              disabled={!inputValue.trim() || !isConnected}
              title={!isConnected ? t('disconnected') : ''}
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
