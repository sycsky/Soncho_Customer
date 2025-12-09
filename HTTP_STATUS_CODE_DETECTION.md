# HTTP 状态码检测实现

## 问题背景

**WebSocket API 的限制**：
- 浏览器的 WebSocket API 不允许 JavaScript 直接访问握手阶段的 HTTP 响应头和状态码
- 即使服务器返回 401/403，前端也无法通过 WebSocket API 读取
- 只能依赖 `onclose` 事件的 `closeCode`，信息不够准确

## 解决方案

**在建立 WebSocket 连接前，先通过 HTTP 请求验证 Token**

### 工作流程

```
用户发起连接
    ↓
HTTP 请求验证 Token
    ↓
读取 HTTP 状态码 ✅
    ↓
┌─────────────────┐
│  Token 有效？    │
└─────────────────┘
   Yes        No
    │          │
    │          ↓
    │    根据状态码处理
    │    • 401 → 刷新 Token
    │    • 403 → 权限不足
    │    • 500 → 服务器错误
    │    • 其他 → 重试
    │          │
    ↓          ↓
建立 WebSocket 连接
    ↓
正常通信
```

## 实现细节

### 1. 验证接口选择

使用 `/api/v1/public/validate-token` 作为专门的验证接口，原因：
- ✅ 专用的 Token 验证接口
- ✅ 无需认证即可访问（public 接口）
- ✅ 轻量级（仅验证 Token）
- ✅ 不会产生副作用
- ✅ 语义明确

```bash
# 使用示例
curl -H "Authorization: Bearer cust_xxx" \
     "http://localhost:8080/api/v1/public/validate-token"
```

```typescript
const response = await fetch(`${API_BASE_URL}/api/v1/public/validate-token`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${this.token}`,
  },
});

console.log('📡 HTTP 响应状态码:', response.status);
```

### 2. WebSocketService 改进

**新增 `validateAndConnect()` 方法**：

```typescript
private async validateAndConnect() {
  // 1. 先验证 Token
  const response = await fetch(validationUrl, {
    headers: { 'Authorization': `Bearer ${this.token}` }
  });

  // 2. 可以读取 HTTP 状态码了！
  console.log('HTTP 状态码:', response.status);

  // 3. 根据状态码处理
  if (!response.ok) {
    if (response.status === 401) {
      // Token 过期，刷新
      await this.handlePossibleTokenExpiry();
    } else if (response.status === 403) {
      // 权限不足
      this.updateStatus('error');
    } else {
      // 其他错误，重试
      this.attemptReconnect();
    }
    return;
  }

  // 4. 验证通过，建立 WebSocket
  this.createWebSocket();
}
```

### 3. HTTP 错误回调

**新增回调函数**，让上层可以处理 HTTP 错误：

```typescript
connect(
  token: string,
  conversationId: string,
  onMessage: (message: ServerMessage) => void,
  onConnected?: () => void,
  onDisconnected?: () => void,
  onTokenExpired?: () => Promise<string | null>,
  onStatusChange?: (status: ConnectionStatus) => void,
  onHttpError?: (statusCode: number, message: string) => void  // 新增
)
```

### 4. ChatWindow 中的使用

```typescript
const handleHttpError = (statusCode: number, message: string) => {
  console.error(`🚨 HTTP 错误 ${statusCode}:`, message);
  
  let errorMsg = '连接失败';
  
  switch (statusCode) {
    case 401:
      errorMsg = '认证失败，正在刷新 Token...';
      break;
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
  
  // 显示友好的错误提示
  addMessage({
    content: errorMsg,
    sender: 'bot',
  });
};

// 连接时传入回调
websocketService.connect(
  token,
  conversationId,
  handleMessage,
  onConnected,
  onDisconnected,
  handleTokenExpired,
  handleStatusChange,
  handleHttpError  // HTTP 错误回调
);
```

## 优势对比

### 之前（只用 WebSocket closeCode）

```
连接失败
   ↓
onclose (code: 1006)
   ↓
❌ 无法确定具体原因
❌ 只能猜测是 Token 问题
❌ 没有详细错误信息
```

### 现在（HTTP 状态码 + WebSocket closeCode）

```
连接前验证
   ↓
HTTP Response
   ↓
✅ 明确的状态码 (401/403/500...)
✅ 详细的错误信息
✅ 可以精确处理
   ↓
根据状态码决定：
• 401 → 刷新 Token
• 403 → 停止重连，提示权限不足
• 500 → 重试连接
• 503 → 等待服务恢复
```

## 状态码处理策略

| 状态码 | 含义 | 处理策略 | 是否重连 |
|--------|------|----------|----------|
| 200 | 成功 | 建立 WebSocket 连接 | - |
| 401 | 未授权/Token过期 | 自动刷新 Token 后重连 | ✅ |
| 403 | 权限不足 | 提示用户，停止重连 | ❌ |
| 404 | 接口不存在 | 提示错误，停止重连 | ❌ |
| 500 | 服务器错误 | 延迟重试 | ✅ |
| 503 | 服务不可用 | 延迟重试 | ✅ |
| 其他 | 未知错误 | 延迟重试 | ✅ |

## 日志示例

### 成功场景

```
🔍 验证 Token 有效性...
📡 HTTP 响应状态码: 200
✅ Token 验证成功，建立 WebSocket 连接
🔌 WebSocket 连接
URL: /ws/chat?token=***
时间: 2025-11-25T10:30:00.000Z
✅ WebSocket 连接成功
```

### Token 过期场景

```
🔍 验证 Token 有效性...
📡 HTTP 响应状态码: 401
❌ Token 验证失败: 401 - Unauthorized
⚠️ Token 无效或过期 (HTTP 401)
🔄 尝试刷新 token...
✅ Token 刷新成功
🔍 验证 Token 有效性...
📡 HTTP 响应状态码: 200
✅ Token 验证成功，建立 WebSocket 连接
```

### 权限不足场景

```
🔍 验证 Token 有效性...
📡 HTTP 响应状态码: 403
❌ Token 验证失败: 403 - Forbidden
❌ 权限不足 (HTTP 403)
📡 连接状态: error
```

### 服务器错误场景

```
🔍 验证 Token 有效性...
📡 HTTP 响应状态码: 500
❌ Token 验证失败: 500 - Internal Server Error
❌ 验证失败，尝试重连
🔄 将在 2000ms 后进行第 1/3 次重连...
```

## CustomerService 新增方法

```typescript
/**
 * 验证 Token 是否有效
 * @returns { valid: boolean, statusCode: number }
 */
async validateToken(token: string): Promise<{
  valid: boolean;
  statusCode: number;
  message?: string;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/public/validate-token`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    return {
      valid: response.ok,
      statusCode: response.status,
      message: response.ok ? 'Token 有效' : await response.text(),
    };
  } catch (error) {
    return {
      valid: false,
      statusCode: 0,
      message: '网络错误',
    };
  }
}
```

## 性能影响

### 额外开销

- 每次连接前多一次 HTTP 请求
- 验证接口响应时间：通常 < 100ms
- 总连接时间增加：< 100ms

### 收益

- ✅ 明确的错误信息
- ✅ 精准的错误处理
- ✅ 更好的用户体验
- ✅ 减少无效的 WebSocket 连接尝试

**结论**：额外的 100ms 开销是值得的！

## 最佳实践

### 1. 缓存验证结果

避免频繁验证同一个 Token：

```typescript
private lastValidation: {
  token: string;
  time: number;
  valid: boolean;
} | null = null;

private async validateAndConnect() {
  // 5秒内不重复验证同一个 token
  if (this.lastValidation && 
      this.lastValidation.token === this.token &&
      Date.now() - this.lastValidation.time < 5000 &&
      this.lastValidation.valid) {
    this.createWebSocket();
    return;
  }
  
  // 执行验证...
}
```

### 2. 超时处理

设置验证请求超时：

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` },
  signal: controller.signal
});

clearTimeout(timeout);
```

### 3. 错误分类

细化错误处理逻辑：

```typescript
if (response.status >= 500) {
  // 服务器错误，可以重试
  this.attemptReconnect();
} else if (response.status >= 400) {
  // 客户端错误，不应重试
  this.updateStatus('error');
}
```

## 与 WebSocket closeCode 结合

虽然现在可以读取 HTTP 状态码，但 WebSocket closeCode 仍然有用：

```typescript
// HTTP 验证通过后建立的 WebSocket 如果断开
onclose = (event) => {
  if (event.code === 1006) {
    // 可能是连接后 Token 才过期
    this.handlePossibleTokenExpiry();
  } else if (event.code === 1000) {
    // 正常关闭
    this.shouldReconnect = false;
  }
}
```

**双重保障**：
- 连接前：HTTP 状态码验证
- 连接后：WebSocket closeCode 监控

## 总结

✅ **实现了 HTTP 状态码检测**  
✅ **在连接前就能发现 Token 问题**  
✅ **提供了详细的错误信息**  
✅ **支持精准的错误处理**  
✅ **改善了用户体验**  

这种方案完美解决了 WebSocket API 无法读取 HTTP 响应的限制！

## 更新日期

2025-11-25
