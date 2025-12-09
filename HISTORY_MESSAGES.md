# 历史聊天记录功能文档

## 概述

实现了历史聊天记录加载功能,在用户打开聊天窗口时自动加载历史对话,提供连续的聊天体验。

## 接口信息

### 获取历史消息

**接口地址:** `GET /api/v1/chat/sessions/{sessionId}/messages`

**请求参数:**
- `sessionId`: 会话ID (路径参数)
- `page`: 页码,从 0 开始 (查询参数,默认 0)
- `size`: 每页大小 (查询参数,默认 50)

**请求头:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**响应格式:**
```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "content": [
      {
        "id": "47134081-9265-4a2a-b968-864677d1bf78",
        "sessionId": "c2e41ad3-0aaf-4a2d-8133-648e9a560656",
        "senderType": "USER",
        "agentId": null,
        "agentName": null,
        "text": "你好",
        "internal": false,
        "isMine": true,
        "translationData": {},
        "mentionAgentIds": [],
        "attachments": [],
        "agentMetadata": {},
        "createdAt": "2025-11-26T05:06:20Z"
      }
    ],
    "pageable": {
      "pageNumber": 0,
      "pageSize": 50,
      "sort": {
        "empty": false,
        "sorted": true,
        "unsorted": false
      },
      "offset": 0,
      "unpaged": false,
      "paged": true
    },
    "last": true,
    "totalPages": 1,
    "totalElements": 1,
    "size": 50,
    "number": 0,
    "sort": {
      "empty": false,
      "sorted": true,
      "unsorted": false
    },
    "first": true,
    "numberOfElements": 1,
    "empty": false
  },
  "success": true
}
```

## 数据结构说明

### HistoryMessage 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 消息唯一ID |
| `sessionId` | string | 会话ID |
| `senderType` | enum | 发送者类型: `USER`(用户), `AGENT`(客服), `SYSTEM`(系统) |
| `agentId` | string? | 客服ID (客服消息时有值) |
| `agentName` | string? | 客服名称 (客服消息时有值) |
| `text` | string | 消息内容 |
| `internal` | boolean | 是否为内部消息 |
| **`isMine`** | boolean | **是否是当前用户发送的消息** (关键字段) |
| `translationData` | object | 翻译数据 |
| `mentionAgentIds` | string[] | @提及的客服ID列表 |
| `attachments` | array | 附件列表 |
| `agentMetadata` | object | 客服元数据 |
| `createdAt` | string | 创建时间 (ISO 8601格式) |

### 分页信息 (Pageable)

| 字段 | 类型 | 说明 |
|------|------|------|
| `pageNumber` | number | 当前页码 (从0开始) |
| `pageSize` | number | 每页大小 |
| `totalPages` | number | 总页数 |
| `totalElements` | number | 总记录数 |
| `first` | boolean | 是否第一页 |
| `last` | boolean | 是否最后一页 |
| `empty` | boolean | 是否为空 |

## 实现细节

### 1. customerService.ts 新增接口

```typescript
/**
 * 获取历史聊天记录
 * @param sessionId 会话ID
 * @param token 认证token
 * @param page 页码(从0开始)
 * @param size 每页大小(默认50)
 */
async getHistoryMessages(
  sessionId: string,
  token: string,
  page: number = 0,
  size: number = 50
): Promise<HistoryMessagesResponse>
```

### 2. ChatWindow.tsx 加载流程

```typescript
// 初始化流程
initializeChat() {
  1. 获取客户信息 (从缓存或服务器)
  2. 加载历史消息 ← 新增
  3. 连接 WebSocket
}

// 历史消息加载
loadHistoryMessages(sessionId, token) {
  1. 调用 API 获取历史消息
  2. 使用 isMine 字段区分自己/他人的消息
  3. 转换为前端 Message 格式
  4. 按时间排序 (从旧到新)
  5. 更新消息列表
}
```

### 3. 消息区分逻辑

```typescript
// 使用 isMine 字段判断
if (msg.isMine) {
  sender = 'user';  // 自己发的
} else if (msg.senderType === 'SYSTEM') {
  sender = 'bot';   // 系统消息
} else if (msg.senderType === 'AGENT') {
  sender = 'agent'; // 客服消息
}
```

## 特性

### ✅ 已实现

1. **自动加载历史**: 打开聊天窗口时自动加载最近50条消息
2. **消息区分**: 使用 `isMine` 准确区分自己/他人的消息
3. **时间排序**: 历史消息按时间从旧到新排序
4. **无缝衔接**: 历史消息加载后,新消息通过 WebSocket 实时推送
5. **错误处理**: 加载失败时显示欢迎语,不影响正常聊天
6. **分页支持**: 接口支持分页,可扩展实现滚动加载更多

### 🔄 缓存优化

在 `getCustomerToken` 中优先使用缓存的 `name` 和 `channel`:

```typescript
// 优先使用缓存,保持身份一致
const cachedName = localStorage.getItem('customer_name');
const cachedChannel = localStorage.getItem('customer_channel');

const finalRequest = {
  name: cachedName || request.name,
  channel: cachedChannel || request.channel,
  channelId: request.channelId,
};
```

## 使用示例

### 前端调用

```typescript
// 在 ChatWindow 初始化时自动调用
const historyData = await customerService.getHistoryMessages(
  sessionId,  // 会话ID
  token,      // 认证token
  0,          // 第一页
  50          // 每页50条
);

// 处理返回数据
historyData.content.forEach(msg => {
  console.log(msg.isMine ? '我:' : '客服:', msg.text);
});
```

### 消息格式示例

**我发送的消息:**
```json
{
  "id": "msg-001",
  "text": "你好",
  "isMine": true,
  "senderType": "USER",
  "createdAt": "2025-11-26T05:06:20Z"
}
```

**客服回复的消息:**
```json
{
  "id": "msg-002",
  "text": "您好,请问有什么可以帮您?",
  "isMine": false,
  "senderType": "AGENT",
  "agentName": "小助手",
  "createdAt": "2025-11-26T05:06:25Z"
}
```

## 未来扩展

### 1. 滚动加载更多
```typescript
// 滚动到顶部时加载更早的消息
const loadMoreMessages = async () => {
  const nextPage = Math.floor(messages.length / 50);
  const moreData = await customerService.getHistoryMessages(
    sessionId,
    token,
    nextPage,
    50
  );
  // 插入到消息列表顶部
};
```

### 2. 消息搜索
```typescript
// 在历史消息中搜索关键词
const searchMessages = (keyword: string) => {
  return messages.filter(msg => 
    msg.content.includes(keyword)
  );
};
```

### 3. 消息状态同步
```typescript
// 标记消息为已读
await markMessagesAsRead(sessionId, messageIds);
```

## 注意事项

1. **isMine 字段是关键**: 必须使用这个字段来判断消息归属,不要依赖 `senderType`
2. **时间排序**: 历史消息需要按时间排序后再显示
3. **错误处理**: 历史消息加载失败不应阻止聊天功能
4. **性能优化**: 默认只加载最近50条,避免一次加载过多消息
5. **Token 有效性**: 加载历史消息前确保 Token 有效

## 相关文件

- `src/services/customerService.ts` - 历史消息接口实现
- `src/components/ChatWindow.tsx` - 历史消息加载逻辑
- `SESSION_ID_HANDLING.md` - SessionId 管理文档
- `WEBSOCKET_IMPROVEMENTS.md` - WebSocket 优化文档
