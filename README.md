# AI 客服聊天客户端

客户端聊天应用，支持独立页面和嵌入 Widget 两种模式。

## 功能特性

✅ **自动获取客户 Token** - 无需手动注册，自动从后端获取身份认证  
✅ **WebSocket 实时通信** - 基于 SockJS 的稳定连接  
✅ **断线自动重连** - 智能重连机制，最多重试 5 次  
✅ **双模式部署** - 支持独立页面和嵌入式 Widget  
✅ **美观的 UI 设计** - 渐变色主题，流畅动画效果  
✅ **连接状态提示** - 实时显示在线/离线/连接中状态  

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3002

### 构建生产版本

#### 独立页面模式

```bash
npm run build
```

生成的文件在 `dist/` 目录。

#### Widget 嵌入模式

```bash
npm run build:widget
```

生成的文件在 `dist-widget/` 目录。

## 使用方式

### 1. 独立页面模式

直接访问部署的 URL，即可使用完整的聊天界面。

### 2. Widget 嵌入模式

在您的网站中添加以下代码：

```html
<!DOCTYPE html>
<html>
<head>
  <title>我的网站</title>
</head>
<body>
  <!-- 您的网站内容 -->
  
  <!-- AI 客服 Widget -->
  <script>
    // 可选配置
    window.AI_CHAT_CONFIG = {
      userName: '访客' // 可选，默认自动生成
    };
  </script>
  <script src="https://your-domain.com/chat-widget.js"></script>
</body>
</html>
```

Widget 会在页面右下角显示一个聊天按钮，点击即可打开聊天窗口。

### 手动控制 Widget

```javascript
// 打开聊天窗口
window.aiChatWidget.open();

// 关闭聊天窗口
window.aiChatWidget.close();

// 切换显示/隐藏
window.aiChatWidget.toggle();

// 销毁 Widget
window.aiChatWidget.destroy();
```

## 接入流程

客户端会自动完成以下流程：

1. **生成浏览器唯一标识** - 使用 localStorage 存储，确保同一浏览器识别为同一客户
2. **请求客户 Token** - 调用 `/api/v1/public/customer-token` 获取身份令牌
3. **连接 WebSocket** - 使用 Token 连接到 `/ws/chat?token=xxx`
4. **收发消息** - 实时双向通信

## 配置说明

### 环境变量

创建 `.env` 文件：

```env
# 后端 API 地址（生产环境）
VITE_API_URL=https://your-api.com

# WebSocket 地址（生产环境）
VITE_WS_URL=https://your-api.com/ws/chat
```

开发环境会自动使用 Vite 代理，无需配置。

### 修改服务器地址

编辑 `src/config.ts`：

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080';
export const WS_URL = import.meta.env.DEV 
  ? '/ws/chat'  // 开发环境通过代理
  : (import.meta.env.VITE_WS_URL || 'http://127.0.0.1:8080/ws/chat');
```

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **SockJS** - WebSocket 兼容层
- **Lucide React** - 图标库

## 项目结构

```
src/
├── components/
│   ├── ChatWindow.tsx      # 聊天窗口主组件
│   └── ChatWindow.css      # 样式文件
├── services/
│   ├── websocketService.ts # WebSocket 服务
│   └── customerService.ts  # 客户服务（获取 Token）
├── config.ts               # 配置文件
├── App.tsx                 # 独立页面入口
├── widget.tsx              # Widget 模式入口
└── main.tsx                # 应用入口
```

## 自定义样式

Widget 的样式可以通过修改 `ChatWindow.css` 自定义：

```css
/* 修改主题色 */
.chat-header {
  background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}

/* 修改气泡颜色 */
.message-user .message-text {
  background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}
```

## 断线重连

客户端内置智能重连机制：

- **重连次数**: 最多 5 次
- **重连间隔**: 递增延迟（5s, 10s, 15s, 20s, 25s）
- **最大延迟**: 30 秒
- **手动重连**: 提供重连按钮

## 常见问题

### Q: 如何修改欢迎消息？

编辑 `ChatWindow.tsx` 中的 `initializeChat` 函数：

```typescript
addMessage({
  id: '0',
  content: '您好！我是 AI 客服助手，有什么可以帮您的吗？', // 修改这里
  sender: 'bot',
  timestamp: Date.now(),
});
```

### Q: 如何自定义客户姓名？

传入 `userName` 参数：

```typescript
<ChatWindow userName="张三" />

// 或在 Widget 配置中
window.AI_CHAT_CONFIG = { userName: '张三' };
```

### Q: 如何清除客户身份？

```javascript
localStorage.clear(); // 清除所有本地存储
// 或
localStorage.removeItem('customer_id');
localStorage.removeItem('customer_token');
localStorage.removeItem('browser_id');
```

## 浏览器兼容性

- Chrome/Edge >= 90
- Firefox >= 88
- Safari >= 14

## License

MIT
