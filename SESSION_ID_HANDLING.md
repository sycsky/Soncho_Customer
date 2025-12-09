# SessionId 处理说明

## SessionId 来源

SessionId 在获取 Customer Token 时由服务器返回：

```json
POST /api/v1/public/customer-token
{
  "name": "访客_123",
  "channel": "WEB",
  "channelId": "web_xxx"
}

响应：
{
  "success": true,
  "code": 200,
  "data": {
    "customerId": "c3a7d039-6054-49e9-9b9c-bd03ca813b01",
    "token": "cust_089d7d4c-f5cd-4eec-ad61-6c1de9f2ddb3",
    "name": "访客_141092",
    "channel": "WEB",
    "sessionId": "5afb53da-d918-4d38-a89a-8dc50fc7ce41",  ← 这里
    "groupId": "24697f26-1814-411c-a374-e6dd472a8a4f"
  }
}
```

## SessionId 获取与存储

### 方式1：从 customer-token 接口获取（主要方式）

```typescript
// 1. 获取 Token 和 SessionId
const customerInfo = await customerService.getCustomerToken({
  name: '访客_123',
  channel: 'WEB',
  channelId: browserId,
});

// 2. 保存到本地存储
customerService.saveCustomerInfo(customerInfo);

// 3. 设置到 WebSocket 服务
websocketService.setSessionId(customerInfo.sessionId);

// 4. 建立连接
websocketService.connect(
  customerInfo.token,
  customerInfo.sessionId,
  handleMessage
);
```

### 方式2：从服务器消息中更新（备用方式）

如果服务器消息中包含新的 sessionId，也会自动更新：

```typescript
this.socket.onmessage = (event: MessageEvent) => {
  const message = JSON.parse(event.data);
  
  // 自动更新 sessionId（如果消息中包含）
  if (message.payload?.sessionId && !this.sessionId) {
    console.log('💾 自动存储 sessionId:', message.payload.sessionId);
    this.sessionId = message.payload.sessionId;
  }
};
```

```json
{
  "event": "sendMessage",
  "payload": {
    "sessionId": "会话ID（UUID字符串）",
    "text": "消息文本内容",
    "isInternal": false,
    "attachments": [
      {
        "type": "IMAGE",
        "url": "附件URL",
        "name": "文件名.jpg",
        "sizeKb": 150
      }
    ],
    "mentions": ["@客服ID1", "@客服ID2"]
  }
}
```

### 接收消息格式

```json
{
  "event": "newMessage",
  "payload": {
    "sessionId": "会话ID",
    "message": {
      "id": "消息ID",
      "sessionId": "会话ID",
      "senderType": "AGENT" | "CUSTOMER" | "SYSTEM",
      "agentId": "发送者ID（如果是客服）",
      "customerId": "发送者ID（如果是客户）",
      "text": "消息内容",
      "internal": false,
      "translationData": {},
      "mentions": [],
      "attachments": [],
      "createdAt": "2025-11-25T12:00:00Z"
    }
  }
}
```

## SessionId 生命周期

```
用户打开聊天
    ↓
调用 /api/v1/public/customer-token
    ↓
响应: { sessionId: "xxx", token: "yyy", ... }
    ↓
保存到 localStorage
    ↓
设置到 websocketService
    ↓
建立 WebSocket 连接
    ↓
发送消息时自动使用 sessionId
```

## 本地存储

SessionId 会与其他客户信息一起保存到 localStorage：

```typescript
localStorage.setItem('customer_session_id', sessionId);
localStorage.setItem('customer_token', token);
localStorage.setItem('customer_id', customerId);
// ...
```

**好处**：
- 页面刷新后可以恢复会话
- 不需要重新获取 sessionId
- 保持会话连续性

## Token 刷新时的 SessionId 处理

当 Token 过期需要刷新时，会重新获取 sessionId：

```typescript
const handleTokenExpired = async () => {
  // 1. 重新获取 Token
  const customerInfo = await customerService.getCustomerToken({...});
  
  // 2. 保存新的 sessionId
  websocketService.setSessionId(customerInfo.sessionId);
  
  // 3. 返回新 Token 用于重连
  return customerInfo.token;
};
```

## WebSocketService 新增接口

### 类型定义

```typescript
// 附件接口
export interface MessageAttachment {
  type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO';
  url: string;
  name: string;
  sizeKb?: number;
}

// 发送消息的 payload
export interface SendMessagePayload {
  sessionId: string;
  text: string;
  isInternal?: boolean;
  attachments?: MessageAttachment[];
  mentions?: string[];
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
```

### 方法

#### sendMessage

发送消息（新格式）：

```typescript
sendMessage(
  text: string,
  options?: {
    isInternal?: boolean;
    attachments?: MessageAttachment[];
    mentions?: string[];
  }
): void
```

**示例**：

```typescript
// 发送文本消息
websocketService.sendMessage('你好');

// 发送带附件的消息
websocketService.sendMessage('请查看这张图片', {
  attachments: [{
    type: 'IMAGE',
    url: 'https://example.com/image.jpg',
    name: 'screenshot.jpg',
    sizeKb: 150
  }]
});

// 发送内部消息（仅客服可见）
websocketService.sendMessage('这是内部备注', {
  isInternal: true
});

// @提及其他客服
websocketService.sendMessage('请协助处理', {
  mentions: ['agent-id-1', 'agent-id-2']
});
```

#### setSessionId

手动设置 sessionId：

```typescript
setSessionId(sessionId: string): void
```

**示例**：

```typescript
websocketService.setSessionId('550e8400-e29b-41d4-a716-446655440000');
```

#### getSessionId

获取当前 sessionId：

```typescript
getSessionId(): string | null
```

**示例**：

```typescript
const sessionId = websocketService.getSessionId();
if (sessionId) {
  console.log('当前会话:', sessionId);
} else {
  console.log('未获取到 sessionId');
}
```

## ChatWindow 使用示例

### 处理接收到的消息

```typescript
const handleMessage = (serverMessage: ServerMessage) => {
  console.log('收到消息:', serverMessage);
  
  // 处理新消息事件
  if (serverMessage.event === 'newMessage' && serverMessage.payload.message) {
    const msg = serverMessage.payload.message;
    
    // 判断发送者类型
    let sender: 'user' | 'agent' | 'bot' = 'agent';
    if (msg.senderType === 'CUSTOMER' || msg.customerId === customerId) {
      sender = 'user';
    } else if (msg.senderType === 'SYSTEM') {
      sender = 'bot';
    } else if (msg.senderType === 'AGENT') {
      sender = 'agent';
    }
    
    // 添加到消息列表
    addMessage({
      id: msg.id,
      content: msg.text,
      sender,
      timestamp: new Date(msg.createdAt).getTime(),
    });
    
    // 自动存储 sessionId
    if (serverMessage.payload.sessionId) {
      websocketService.setSessionId(serverMessage.payload.sessionId);
    }
  }
};
```

### 发送消息

```typescript
const handleSend = () => {
  if (!inputValue.trim()) return;

  // 检查连接状态
  if (!websocketService.isConnected()) {
    console.error('❌ WebSocket 未连接');
    return;
  }

  // 检查 sessionId
  if (!websocketService.getSessionId()) {
    console.error('❌ 缺少 sessionId');
    addMessage({
      content: '会话未初始化，请刷新页面重试',
      sender: 'bot',
    });
    return;
  }

  // 先在界面显示
  addMessage({
    id: Date.now().toString(),
    content: inputValue,
    sender: 'user',
    timestamp: Date.now(),
  });

  // 发送到服务器
  try {
    websocketService.sendMessage(inputValue);
    setInputValue('');
  } catch (error) {
    console.error('发送失败:', error);
    addMessage({
      content: '消息发送失败，请重试',
      sender: 'bot',
    });
  }
};
```

## 完整流程

```
1. 用户打开聊天窗口
   ↓
2. 调用 GET /api/v1/public/customer-token
   {
     "name": "访客_123",
     "channel": "WEB",
     "channelId": "web_xxx"
   }
   ↓
3. 获取响应
   {
     "customerId": "xxx",
     "token": "cust_xxx",
     "sessionId": "session-uuid",  ← 关键
     "groupId": "group-uuid"
   }
   ↓
4. 保存到 localStorage
   localStorage.setItem('customer_session_id', 'session-uuid')
   ↓
5. 设置到 WebSocketService
   websocketService.setSessionId('session-uuid')
   ↓
6. 建立 WebSocket 连接
   websocketService.connect(token, sessionId, ...)
   ↓
7. 用户发送消息
   {
     "event": "sendMessage",
     "payload": {
       "sessionId": "session-uuid",  ← 自动使用
       "text": "你好"
     }
   }
   ↓
8. 服务器返回响应
   {
     "event": "newMessage",
     "payload": {
       "sessionId": "session-uuid",
       "message": { ... }
     }
   }
```

## 错误处理

### 缺少 sessionId

```typescript
if (!websocketService.getSessionId()) {
  addMessage({
    content: '会话未初始化，请刷新页面重试',
    sender: 'bot',
  });
  return;
}
```

### 发送失败

```typescript
try {
  websocketService.sendMessage(text);
} catch (error) {
  if (error.message === '缺少 sessionId') {
    addMessage({
      content: '会话未初始化，请刷新页面',
      sender: 'bot',
    });
  } else if (error.message === 'WebSocket 未连接') {
    addMessage({
      content: '连接已断开，正在重新连接...',
      sender: 'bot',
    });
  } else {
    addMessage({
      content: '消息发送失败，请重试',
      sender: 'bot',
    });
  }
}
```

## 调试日志

### 成功场景

```
💾 自动存储 sessionId: 550e8400-e29b-41d4-a716-446655440000
📤 发送消息: {
  event: "sendMessage",
  payload: {
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    text: "你好",
    isInternal: false,
    attachments: [],
    mentions: []
  }
}
📥 收到消息: {
  event: "newMessage",
  payload: {
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    message: {
      id: "msg-123",
      text: "你好！有什么可以帮您？",
      senderType: "AGENT"
    }
  }
}
```

### 错误场景

```
❌ 缺少 sessionId，无法发送消息
或
❌ WebSocket 未连接，无法发送消息
```

## 注意事项

1. **sessionId 来源**
   - ✅ 主要来源：`/api/v1/public/customer-token` 接口响应
   - ✅ 备用来源：服务器消息中的 `payload.sessionId`

2. **sessionId 持久化**
   - ✅ 存储到 localStorage
   - ✅ 页面刷新后自动恢复
   - ✅ Token 刷新时会更新

3. **sessionId 与 Token 关系**
   - sessionId 和 Token 同时获取
   - Token 过期后重新获取，会得到新的 sessionId
   - 两者都需要保存和更新

4. **发送前检查**
   - 必须检查 WebSocket 连接状态
   - 必须检查 sessionId 是否存在
   - sessionId 缺失时提示用户刷新页面

## 更新日期

2025-11-25
