# 🚀 快速启动指南

## 第一步：安装依赖

```bash
cd d:/ai_agent_client
npm install
```

## 第二步：启动开发服务器

### 独立页面模式
```bash
npm run dev
```

然后访问: http://localhost:3001

### 构建 Widget 模式
```bash
npm run build:widget
```

构建后的文件在 `dist-widget/` 目录。

## 第三步：测试

### 测试独立页面
1. 访问 http://localhost:3001
2. 看到聊天界面
3. 可以发送消息（需要后端支持）

### 测试 Widget 嵌入
1. 先构建 Widget: `npm run build:widget`
2. 打开 `example.html` 文件
3. 看到页面右下角的聊天按钮
4. 点击按钮打开聊天窗口

## 两种使用方式

### 方式 1: 独立页面（全屏聊天）

直接访问或嵌入 iframe:
```html
<iframe src="http://your-domain.com/chat" width="400" height="600"></iframe>
```

**适用场景**:
- 专门的客服页面
- 移动端 App 内嵌页面
- 独立的聊天应用

### 方式 2: Widget（嵌入式气泡）

在任何网页中添加一行代码:
```html
<script src="http://your-domain.com/chat-widget.js"></script>
```

**适用场景**:
- 电商网站
- 企业官网
- 在线服务平台
- 任何需要在线客服的网站

## 配置后端连接

编辑 `.env` 文件:
```env
VITE_API_URL=http://127.0.0.1:8080
VITE_WS_URL=http://127.0.0.1:8080/ws/chat
```

或直接修改 `src/config.ts`:
```typescript
export const API_BASE_URL = 'http://your-backend.com';
export const WS_URL = 'http://your-backend.com/ws/chat';
```

## 常见问题

### Q: WebSocket 无法连接？
**A**: 检查后端是否启动，WebSocket 端点是否正确配置为 `/ws/chat`

### Q: 如何自定义样式？
**A**: 编辑 `src/components/ChatWindow.css`，修改颜色、尺寸等

### Q: 如何修改 Widget 位置？
**A**: 在 `ChatWindow.css` 中修改:
```css
.chat-window-embedded {
  bottom: 20px;  /* 距离底部 */
  right: 20px;   /* 距离右侧 */
}
```

### Q: 如何在生产环境部署？
**A**: 
1. 构建项目: `npm run build` 或 `npm run build:widget`
2. 将 `dist/` 或 `dist-widget/` 目录部署到服务器
3. 配置 Nginx 或其他 Web 服务器

## 下一步

- 查看 [README.md](./README.md) 了解详细文档
- 修改 [ChatWindow.tsx](./src/components/ChatWindow.tsx) 自定义功能
- 查看 [example.html](./example.html) 了解嵌入示例

## 项目结构

```
ai_agent_client/
├── src/
│   ├── components/
│   │   └── ChatWindow.tsx    # 聊天窗口组件
│   ├── services/
│   │   └── websocketService.ts  # WebSocket 服务
│   ├── App.tsx               # 独立页面
│   ├── widget.tsx            # Widget 入口
│   └── config.ts             # 配置
├── dist/                     # 独立页面构建输出
├── dist-widget/              # Widget 构建输出
│   ├── chat-widget.js        # Widget 脚本
│   └── chat-widget.css       # Widget 样式
└── example.html              # 嵌入示例
```

## 技术栈

- ⚛️ React 18
- 📘 TypeScript
- ⚡ Vite
- 🔌 SockJS
- 🎨 CSS3 Animations
- 🎯 Lucide Icons
