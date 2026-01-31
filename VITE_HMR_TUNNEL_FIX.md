# Vite HMR 内网映射连接断开问题解决方案（客户端）

## 问题描述

使用内网映射访问客户端开发服务器时出现：
```
[vite] server connection lost. Polling for restart...
```

## 快速解决方案

### 创建配置文件

在 `ai_agent_client` 目录创建 `.env.local` 文件：

#### HTTP 映射
```bash
VITE_USE_TUNNEL=true
VITE_HMR_PROTOCOL=ws
VITE_HMR_PORT=3001
```

#### HTTPS 映射
```bash
VITE_USE_TUNNEL=true
VITE_HMR_PROTOCOL=wss
VITE_HMR_HOST=your-tunnel-domain.com
VITE_HMR_PORT=443
```

### 禁用 HMR（临时方案）
```bash
VITE_DISABLE_HMR=true
```

## 环境变量说明

| 变量 | 说明 | 示例 |
|-----|------|------|
| `VITE_USE_TUNNEL` | 启用内网映射模式 | `true` |
| `VITE_HMR_PROTOCOL` | WebSocket 协议 | `ws` / `wss` |
| `VITE_HMR_HOST` | 内网映射域名 | `your-domain.com` |
| `VITE_HMR_PORT` | 客户端端口 | HTTP:`3001` / HTTPS:`443` |
| `VITE_DISABLE_HMR` | 禁用热更新 | `true` / `false` |

## 启动服务

```bash
cd ai_agent_client
npm run dev
```

客户端默认运行在端口 **3001**。

## 验证连接

1. 打开浏览器开发者工具 (F12)
2. Network → WS 筛选器
3. 查看 WebSocket 连接状态
4. 修改文件测试热更新

## 更多信息

详细文档请参考客服端的 [VITE_HMR_TUNNEL_FIX.md](../ai_agent_web/VITE_HMR_TUNNEL_FIX.md)







