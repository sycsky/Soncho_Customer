import { API_BASE_URL } from '../config';

export interface CustomerTokenRequest {
  name: string;
  channel: 'WEB' | 'WECHAT' | 'WHATSAPP' | 'LINE' | 'TELEGRAM' | 'FACEBOOK' | 'EMAIL' | 'SMS' | 'PHONE' | 'APP';
  channelId: string;
  metadata?: Record<string, any>; // 新增: 用于传递 URL 参数等
}

export interface CustomerTokenResponse {
  customerId: string;
  token: string;
  name: string;
  channel: string;
  sessionId: string;  // 新增
  groupId?: string;   // 新增
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// 历史消息接口
export interface HistoryMessage {
  id: string;
  sessionId: string;
  senderType: 'USER' | 'AGENT' | 'SYSTEM';
  agentId?: string | null;
  agentName?: string | null;
  text: string;
  internal: boolean;
  isMine: boolean; // 用于区分是否是自己发送的消息
  translationData?: Record<string, any>;
  mentionAgentIds?: string[];
  attachments?: any[];
  agentMetadata?: Record<string, any>;
  createdAt: string;
}

// 分页信息
export interface Pageable {
  pageNumber: number;
  pageSize: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  offset: number;
  unpaged: boolean;
  paged: boolean;
}

// 历史消息响应
export interface HistoryMessagesResponse {
  content: HistoryMessage[];
  pageable: Pageable;
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

class CustomerService {
  /**
   * 验证 Token 是否有效
   * @returns { valid: boolean, statusCode: number }
   */
  async validateToken(token: string): Promise<{ valid: boolean; statusCode: number; message?: string; error?: string }> {
    try {
      // 使用专门的验证接口
      const response = await fetch(`${API_BASE_URL}/api/v1/public/validate-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 解析响应体
      let responseData: any = null;
      try {
        responseData = await response.json();
      } catch (e) {
        return {
          valid: false,
          statusCode: response.status,
          message: '解析响应失败',
        };
      }

      // 检查响应体中的 valid 字段
      const isValid = response.ok && responseData?.data?.valid !== false;

      return {
        valid: isValid,
        statusCode: response.status,
        error: responseData?.data?.error,
        message: responseData?.data?.message || (isValid ? 'Token 有效' : 'Token 无效'),
      };
    } catch (error) {
      console.error('验证 Token 失败:', error);
      return {
        valid: false,
        statusCode: 0,
        message: '网络错误',
      };
    }
  }

  /**
   * 获取客户 Token
   * 如果客户不存在会自动创建
   * 优先使用缓存中的 name 和 channel
   */
  async getCustomerToken(request: CustomerTokenRequest): Promise<CustomerTokenResponse> {
    // 从缓存中读取 name 和 channel
    const cachedName = localStorage.getItem('customer_name');
    const cachedChannel = localStorage.getItem('customer_channel');
    
    // 如果缓存中有 name 和 channel,则使用缓存的值
    const finalRequest: CustomerTokenRequest = {
      name: cachedName || request.name,
      channel: (cachedChannel as any) || request.channel,
      channelId: request.channelId,
      metadata: request.metadata, // 新增: 传递 metadata
    };
    
    console.log('📤 请求 customer-token:', {
      cached: { name: cachedName, channel: cachedChannel },
      final: finalRequest,
    });

    const response = await fetch(`${API_BASE_URL}/api/v1/public/customer-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalRequest),
    });

    if (!response.ok) {
      throw new Error(`Failed to get customer token: ${response.statusText}`);
    }

    const result: ApiResponse<CustomerTokenResponse> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to get customer token');
    }

    return result.data;
  }

  /**
   * 生成浏览器唯一标识
   */
  generateBrowserId(): string {
    const stored = localStorage.getItem('browser_id');
    if (stored) {
      return stored;
    }

    const browserId = 'web_' + this.generateUUID();
    localStorage.setItem('browser_id', browserId);
    return browserId;
  }

  /**
   * 生成 UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * 保存客户信息到本地
   */
  saveCustomerInfo(info: CustomerTokenResponse): void {
    localStorage.setItem('customer_id', info.customerId);
    localStorage.setItem('customer_token', info.token);
    localStorage.setItem('customer_name', info.name);
    localStorage.setItem('customer_channel', info.channel);
    localStorage.setItem('customer_session_id', info.sessionId);
    if (info.groupId) {
      localStorage.setItem('customer_group_id', info.groupId);
    }
  }

  /**
   * 获取本地保存的客户信息
   */
  getLocalCustomerInfo(): CustomerTokenResponse | null {
    const customerId = localStorage.getItem('customer_id');
    const token = localStorage.getItem('customer_token');
    const name = localStorage.getItem('customer_name');
    const channel = localStorage.getItem('customer_channel');
    const sessionId = localStorage.getItem('customer_session_id');
    const groupId = localStorage.getItem('customer_group_id');

    if (customerId && token && name && channel && sessionId) {
      return { 
        customerId, 
        token, 
        name, 
        channel, 
        sessionId,
        groupId: groupId || undefined
      };
    }

    return null;
  }

  /**
   * 清除本地客户信息
   */
  clearCustomerInfo(): void {
    localStorage.removeItem('customer_id');
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_name');
    localStorage.removeItem('customer_channel');
    localStorage.removeItem('customer_session_id');
    localStorage.removeItem('customer_group_id');
  }

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
  ): Promise<HistoryMessagesResponse> {
    const url = `${API_BASE_URL}/api/v1/chat/sessions/${sessionId}/messages?page=${page}&size=${size}`;
    
    console.log('📥 请求历史消息:', { sessionId, page, size });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get history messages: ${response.statusText}`);
    }

    const result: ApiResponse<HistoryMessagesResponse> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to get history messages');
    }

    console.log('✅ 历史消息加载成功:', {
      total: result.data.totalElements,
      page: result.data.number,
      messages: result.data.content.length,
    });

    return result.data;
  }
}

const customerService = new CustomerService();
export default customerService;
