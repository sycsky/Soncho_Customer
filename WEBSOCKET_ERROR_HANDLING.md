# WebSocket Token 过期错误处理指南

## 概述

当 WebSocket 连接时 token 无效或过期，系统会通过 HTTP 响应头返回明确的错误信息，前端可以根据这些信息进行相应处理。

## 错误码说明

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| `MISSING_TOKEN` | 缺少 token 参数 | 检查连接 URL 是否包含 token 参数 |
| `TOKEN_EXPIRED` | Token 无效或已过期 | 重新获取 token 后再次连接 |
| `INVALID_REQUEST` | 无效的请求类型 | 检查请求格式 |

## 前端处理示例

### JavaScript 原生 WebSocket

```javascript
class ChatWebSocket {
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
    }

    connect() {
        const wsUrl = `${this.baseUrl}?token=${this.token}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = (event) => {
            console.log('✅ WebSocket 连接成功');
            this.reconnectAttempts = 0;
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket 连接错误:', error);
            this.handleConnectionError(error);
        };

        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket 连接关闭:', event.code, event.reason);
            
            // 根据关闭码判断是否需要重连
            if (event.code === 1006) {
                // 异常关闭，可能是 token 问题
                this.handleTokenExpired();
            } else if (event.code !== 1000) {
                // 非正常关闭，尝试重连
                this.attemptReconnect();
            }
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
    }

    handleConnectionError(error) {
        // WebSocket onerror 事件不会提供详细信息
        // 但握手失败会触发 onerror 然后 onclose
        console.error('WebSocket 错误，等待 close 事件获取详细信息');
    }

    handleTokenExpired() {
        console.warn('⚠️ Token 可能已过期，正在刷新...');
        
        // 根据用户类型刷新 token
        if (this.isCustomer) {
            this.refreshCustomerToken();
        } else {
            this.refreshAgentToken();
        }
    }

    async refreshCustomerToken() {
        try {
            const response = await fetch('/api/v1/customers/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: this.customerId,
                    channel: this.channel
                })
            });
            
            const data = await response.json();
            this.token = data.token;
            
            // 使用新 token 重新连接
            this.connect();
        } catch (error) {
            console.error('❌ 刷新客户 token 失败:', error);
            this.notifyUser('连接失败，请刷新页面重试');
        }
    }

    async refreshAgentToken() {
        // 客服需要重新登录
        console.warn('⚠️ 客服 Token 过期，需要重新登录');
        this.notifyUser('登录已过期，请重新登录');
        window.location.href = '/login';
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
            
            console.log(`🔄 ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连...`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('❌ 达到最大重连次数，停止重连');
            this.notifyUser('连接失败，请刷新页面重试');
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'message':
                this.onMessageReceived(data.message);
                break;
            case 'offline_message':
                this.onOfflineMessageReceived(data.message);
                break;
            case 'offline_messages_complete':
                this.onOfflineMessagesComplete(data.count);
                break;
            default:
                console.warn('未知消息类型:', data.type);
        }
    }

    sendMessage(sessionId, text) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'message',
                sessionId: sessionId,
                text: text
            };
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('❌ WebSocket 未连接，无法发送消息');
            this.notifyUser('连接已断开，正在重新连接...');
            this.attemptReconnect();
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client closed connection');
        }
    }

    notifyUser(message) {
        // 实现用户通知逻辑（Toast、Alert 等）
        console.log('📢 通知用户:', message);
    }
}
```

### 使用示例

#### 客户端连接

```javascript
// 1. 创建客户并获取 token
const createCustomerResponse = await fetch('/api/v1/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: '张三',
        channel: 'WEB',
        metadata: { source: 'homepage' }
    })
});

const customerData = await createCustomerResponse.json();
const customerId = customerData.id;
const token = customerData.token;

// 2. 建立 WebSocket 连接
const wsClient = new ChatWebSocket('ws://localhost:8080/ws/chat', token);
wsClient.customerId = customerId;
wsClient.channel = 'WEB';
wsClient.isCustomer = true;

wsClient.onMessageReceived = (message) => {
    console.log('收到消息:', message);
    // 更新 UI 显示消息
};

wsClient.onOfflineMessageReceived = (message) => {
    console.log('收到离线消息:', message);
    // 显示离线消息
};

wsClient.onOfflineMessagesComplete = (count) => {
    console.log(`已加载 ${count} 条离线消息`);
};

// 3. 连接
wsClient.connect();

// 4. 发送消息
wsClient.sendMessage(sessionId, '你好，我需要帮助');

// 5. 断开连接
// wsClient.disconnect();
```

#### 客服端连接

```javascript
// 1. 客服登录获取 token
const loginResponse = await fetch('/api/v1/public/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'agent001',
        password: 'password123'
    })
});

const loginData = await loginResponse.json();
const token = loginData.token;

// 2. 建立 WebSocket 连接
const wsClient = new ChatWebSocket('ws://localhost:8080/ws/chat', token);
wsClient.isCustomer = false;

wsClient.onMessageReceived = (message) => {
    console.log('收到客户消息:', message);
    // 更新客服工作台
};

wsClient.onOfflineMessageReceived = (message) => {
    console.log('收到离线消息:', message);
    // 显示离线消息通知
};

// 3. 连接
wsClient.connect();
```

## 注意事项

### 1. 握手阶段错误检测

由于 WebSocket API 的限制，浏览器无法直接访问握手响应头。当握手失败时：

- `onerror` 事件会触发（但不提供详细信息）
- 随后 `onclose` 事件会触发，`event.code` 通常为 `1006`（异常关闭）

**解决方案：** 在 `onclose` 事件中，如果 `code` 为 `1006`，假定是 token 问题，尝试刷新 token。

### 2. Token 刷新策略

**客户端：**
- Token 相对简单，可以直接调用 `/api/v1/customers/token` 重新获取
- 建议实现自动重连机制

**客服端：**
- Token 过期意味着登录会话失效
- 应该引导用户重新登录，而不是自动刷新
- 可以存储登录凭证实现静默重登（注意安全性）

### 3. 重连策略

建议使用指数退避算法：
- 第1次重连：延迟 2 秒
- 第2次重连：延迟 4 秒
- 第3次重连：延迟 8 秒
- 最大延迟不超过 10 秒
- 最多重连 3-5 次

### 4. 用户体验优化

```javascript
class ChatUI {
    showConnectionStatus(status) {
        const statusBar = document.getElementById('connection-status');
        
        switch (status) {
            case 'connecting':
                statusBar.className = 'status-connecting';
                statusBar.textContent = '正在连接...';
                break;
            case 'connected':
                statusBar.className = 'status-connected';
                statusBar.textContent = '已连接';
                setTimeout(() => statusBar.style.display = 'none', 2000);
                break;
            case 'disconnected':
                statusBar.className = 'status-disconnected';
                statusBar.textContent = '连接已断开';
                break;
            case 'reconnecting':
                statusBar.className = 'status-reconnecting';
                statusBar.textContent = '正在重新连接...';
                break;
            case 'error':
                statusBar.className = 'status-error';
                statusBar.textContent = '连接失败，请重试';
                break;
        }
        
        statusBar.style.display = 'block';
    }

    disableSendButton() {
        const sendBtn = document.getElementById('send-button');
        sendBtn.disabled = true;
        sendBtn.textContent = '连接中...';
    }

    enableSendButton() {
        const sendBtn = document.getElementById('send-button');
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
    }
}
```

## 服务端响应头说明

当 WebSocket 握手失败时，服务端会返回以下响应头：

```
HTTP/1.1 401 Unauthorized
X-WebSocket-Error-Code: TOKEN_EXPIRED
X-WebSocket-Error-Message: Token 无效或已过期，请重新获取
```

虽然浏览器 WebSocket API 无法直接读取这些头，但它们会出现在网络请求日志中，便于调试。

## 调试技巧

### Chrome DevTools

1. 打开 **Network** 标签
2. 筛选 **WS**（WebSocket）
3. 点击 WebSocket 连接
4. 查看 **Headers** 标签页：
   - 如果握手失败，状态码会显示 `401`
   - **Response Headers** 中会包含 `X-WebSocket-Error-Code` 和 `X-WebSocket-Error-Message`

### 日志增强

```javascript
class DebugWebSocket extends ChatWebSocket {
    connect() {
        console.group('🔌 WebSocket 连接');
        console.log('URL:', `${this.baseUrl}?token=${this.maskToken(this.token)}`);
        console.log('时间:', new Date().toISOString());
        console.groupEnd();
        
        super.connect();
        
        // 记录所有事件
        this.ws.addEventListener('open', (e) => {
            console.log('✅ open 事件:', e);
        });
        
        this.ws.addEventListener('error', (e) => {
            console.error('❌ error 事件:', e);
        });
        
        this.ws.addEventListener('close', (e) => {
            console.group('🔌 close 事件');
            console.log('Code:', e.code);
            console.log('Reason:', e.reason);
            console.log('WasClean:', e.wasClean);
            console.groupEnd();
        });
    }

    maskToken(token) {
        if (!token || token.length < 10) return '***';
        return token.substring(0, 8) + '...' + token.substring(token.length - 4);
    }
}
```

## 完整错误处理流程

```
用户发起连接
    ↓
WebSocket 握手
    ↓
Token 验证
    ↓
┌─────────────────┐
│  验证成功？     │
└─────────────────┘
    │         │
   Yes       No
    │         │
    │         ↓
    │    返回 401 + 错误头
    │         ↓
    │    触发 onerror
    │         ↓
    │    触发 onclose (code=1006)
    │         ↓
    │    前端检测 code=1006
    │         ↓
    │    判断用户类型
    │         │
    │    ┌────┴────┐
    │    │         │
    │  客户      客服
    │    │         │
    │    ↓         ↓
    │  刷新token  重新登录
    │    │
    │    ↓
    │  重新连接
    │    │
    ↓    ↓
连接建立成功
    ↓
推送离线消息
    ↓
正常通信
```

## 相关 API

- **创建客户并获取 token**: `POST /api/v1/customers`
- **客户刷新 token**: `POST /api/v1/customers/token`
- **客服登录获取 token**: `POST /api/v1/public/login`
- **WebSocket 连接**: `ws://your-domain/ws/chat?token=xxx`

## 安全建议

1. **不要在 URL 中长期暴露 token**：建议在连接成功后，从 URL 中移除 token 参数
2. **实施 token 过期策略**：建议 token 有效期为 24 小时（客户）或 8 小时（客服）
3. **限制重连次数**：防止无效 token 反复重连
4. **使用 HTTPS/WSS**：生产环境必须使用加密连接

## 示例场景

### 场景 1：客户长时间未活动后重新使用

1. 客户打开页面（token 已过期）
2. WebSocket 连接失败（握手返回 401）
3. 触发 `onclose` 事件（code=1006）
4. 自动调用 `/api/v1/customers/token` 获取新 token
5. 使用新 token 重新连接
6. 连接成功，推送离线消息

### 场景 2：客服 token 过期

1. 客服登录工作 8 小时后，token 过期
2. WebSocket 连接断开
3. 前端检测到 token 过期
4. 提示"登录已过期，请重新登录"
5. 跳转到登录页面

### 场景 3：网络波动导致断线

1. 网络暂时中断
2. 触发 `onclose` 事件（code 可能是 1006 或其他）
3. 如果不是 code=1006，直接尝试重连（不刷新 token）
4. 使用原 token 重新连接
5. 连接成功继续使用
