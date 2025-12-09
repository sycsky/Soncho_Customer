# WebSocket 错误处理改进总结

## 改进内容

根据 `WEBSOCKET_ERROR_HANDLING.md` 文档的最佳实践，对 WebSocket 连接进行了全面优化。

## 主要改进

### 1. 错误码识别与处理

**新增关闭码识别**：
- `1006`: 异常关闭 → 可能是 token 过期，尝试刷新 token
- `1000/1001`: 正常关闭 → 不进行重连
- 其他错误码 → 尝试自动重连

```typescript
private handleDisconnection(closeCode: number) {
  if (closeCode === 1006) {
    // Token 可能过期，尝试刷新
    this.handlePossibleTokenExpiry();
  } else if (closeCode === 1000 || closeCode === 1001) {
    // 正常关闭，不重连
    this.shouldReconnect = false;
  } else {
    // 其他错误，尝试重连
    this.attemptReconnect();
  }
}
```

### 2. Token 自动刷新机制

**新增 Token 过期处理**：
- 检测到 1006 错误码时自动尝试刷新 token
- 客户端自动调用 `/api/v1/public/customer-token` 获取新 token
- 刷新成功后使用新 token 重新连接

```typescript
// ChatWindow.tsx
const handleTokenExpired = async (): Promise<string | null> => {
  const customerInfo = await customerService.getCustomerToken({
    name,
    channel: 'WEB',
    channelId: browserId,
  });
  
  customerService.saveCustomerInfo(customerInfo);
  return customerInfo.token;
};
```

### 3. 智能重连策略

**指数退避算法**：
- 第 1 次重连：延迟 2 秒
- 第 2 次重连：延迟 4 秒  
- 第 3 次重连：延迟 8 秒
- 最大延迟：10 秒
- 最大重连次数：3 次

```typescript
const delay = Math.min(
  this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
  10000
);
```

### 4. 连接状态管理

**新增 5 种连接状态**：
- `connecting` - 首次连接中
- `connected` - 已连接
- `reconnecting` - 重连中
- `disconnected` - 已断开
- `error` - 连接失败

**状态可视化**：
```css
.status-dot.online { 
  background: #48bb78; 
  animation: pulse 2s ease-in-out infinite;
}

.status-dot.connecting { 
  background: #ed8936;
  animation: blink 1s ease-in-out infinite;
}

.status-dot.offline { 
  background: #e53e3e; 
}
```

### 5. 增强的日志系统

**详细的调试日志**：
```typescript
console.group('🔌 WebSocket 连接');
console.log('URL:', sockJsUrl.replace(/token=[^&]+/, 'token=***'));
console.log('时间:', new Date().toISOString());
console.log('重连次数:', this.reconnectAttempts);
console.groupEnd();

// 关闭事件详情
console.group('🔌 WebSocket 关闭');
console.log('关闭码:', event.code);
console.log('关闭原因:', event.reason || '无');
console.log('是否正常关闭:', event.wasClean);
console.groupEnd();
```

### 6. 用户体验优化

**UI 改进**：
- 实时显示连接状态（连接中/在线/重连中/离线/失败）
- 状态点动画效果（脉冲/闪烁）
- 重连按钮带图标
- 显示当前状态提示文字

**消息发送保护**：
```typescript
const handleSend = () => {
  if (!websocketService.isConnected()) {
    addMessage({
      content: '连接已断开，请稍候重试',
      sender: 'bot',
    });
    return;
  }
  // ... 发送消息
};
```

## 新增 API

### WebSocketService

```typescript
// 检查是否已连接
isConnected(): boolean

// 获取连接状态
getConnectionState(): number

// 手动触发重连
reconnect(): void

// 连接方法（新增参数）
connect(
  token: string,
  conversationId: string,
  onMessage: (message: ServerMessage) => void,
  onConnected?: () => void,
  onDisconnected?: () => void,
  onTokenExpired?: () => Promise<string | null>,  // 新增
  onStatusChange?: (status: ConnectionStatus) => void  // 新增
)
```

## 使用示例

### 基本用法

```typescript
websocketService.connect(
  token,
  conversationId,
  handleMessage,
  () => console.log('已连接'),
  () => console.log('已断开'),
  async () => {
    // Token 过期处理
    const newToken = await refreshToken();
    return newToken;
  },
  (status) => {
    // 状态变化处理
    console.log('状态:', status);
  }
);
```

### 检查连接状态

```typescript
if (websocketService.isConnected()) {
  websocketService.sendMessage(content, senderId);
} else {
  console.error('未连接');
}
```

### 手动重连

```typescript
<button onClick={() => websocketService.reconnect()}>
  重新连接
</button>
```

## 调试技巧

### Chrome DevTools

1. 打开 **Network** 标签
2. 筛选 **WS** (WebSocket)
3. 点击 WebSocket 连接
4. 查看 **Messages** 标签：
   - 📤 发送的消息
   - 📥 接收的消息
5. 查看 **Headers** 标签：
   - 如果握手失败，查看状态码和错误头

### 控制台日志

现在会看到详细的日志信息：
- 🔌 连接/断开事件（分组显示）
- 📤 发送消息（完整对象）
- 📥 接收消息（完整对象）
- 🔄 重连尝试（次数和延迟）
- ⚠️ Token 刷新提示
- ✅ 成功标记
- ❌ 错误标记

## 错误处理流程

```
用户发起连接
    ↓
WebSocket 握手
    ↓
Token 验证
    ↓
┌─────────────┐
│  验证成功？  │
└─────────────┘
   Yes    No
    │      │
    │      ↓
    │   返回 401
    │      ↓
    │   关闭码 1006
    │      ↓
    │   检测 Token 过期
    │      ↓
    │   自动刷新 Token
    │      ↓
    │   重新连接
    │      │
    ↓      ↓
  连接成功
    ↓
 正常通信
```

## 配置参数

可在 `websocketService.ts` 中调整：

```typescript
private reconnectInterval: number = 2000;        // 初始重连间隔
private maxReconnectAttempts: number = 3;        // 最大重连次数
private maxDelay: number = 10000;                 // 最大延迟
```

## 兼容性

- ✅ Chrome/Edge >= 90
- ✅ Firefox >= 88
- ✅ Safari >= 14
- ✅ 支持 SockJS 传输方式：websocket, xhr-streaming, xhr-polling

## 安全建议

1. ✅ Token 不在日志中完整显示（已脱敏）
2. ✅ 限制重连次数防止无效请求
3. ✅ 正常关闭时不进行重连
4. ⚠️ 生产环境请使用 HTTPS/WSS

## 后续优化建议

1. 添加心跳检测机制
2. 实现消息发送队列（离线时缓存）
3. 添加网络状态监听
4. 实现更精细的错误分类
5. 添加性能监控（连接时间、消息延迟等）

## 相关文档

- [WEBSOCKET_ERROR_HANDLING.md](./WEBSOCKET_ERROR_HANDLING.md) - 详细的错误处理指南
- [README.md](./README.md) - 项目文档

## 测试场景

### 场景 1: Token 过期
1. 等待 token 过期
2. 自动检测到 1006 关闭码
3. 自动刷新 token
4. 使用新 token 重连
5. 连接成功

### 场景 2: 网络波动
1. 网络暂时中断
2. 检测到非 1006 错误
3. 使用原 token 自动重连（指数退避）
4. 网络恢复后连接成功

### 场景 3: 达到最大重连次数
1. 连续重连失败 3 次
2. 停止自动重连
3. 显示"连接失败"状态
4. 用户可手动点击"重新连接"按钮

## 更新日期

2025-11-25
