import { Element, h } from 'koishi'
import axios from 'axios'
export interface MessageObject {
  type: 'text' | 'image' | 'audio' | 'video' | 'at' | 'quote' | 'card'
  content?: string
  url?: string
  src?: string
  userId?: string
  messageId?: string
  text?: string
  href?: string
  theme?: string
  title?: string
  children?: MessageObject[]
  [key: string]: any
}

// 完整的 Session 数据类型定义
export interface SessionData {
  selfId: string
  platform: string
  timestamp: number
  type: string
  message: {
    messageId: string
    id: string
    quote?: {
      messageId: string
      id: string
      elements: any[]
      content: string
      user: UserInfo
      member: MemberInfo
      timestamp: number
      guild: GuildInfo
      channel: ChannelInfo
    }
    content: string
  }
  user: UserInfo
  member: MemberInfo
  guild: GuildInfo
  channel: ChannelInfo
  subtype: string
  subsubtype: string
  _type: string
  _data: {
    self_id: number
    user_id: number
    time: number
    message_id: number
    message_seq: number
    real_id: number
    real_seq: string
    message_type: string
    sender: {
      user_id: number
      nickname: string
      card: string
      role: string
    }
    raw_message: string
    font: number
    sub_type: string
    message: any[]
    message_format: string
    post_type: string
    group_id?: number
  }
  sn: number
  login: {
    sn: number
    user: UserInfo
    platform: string
    selfId: string
    status: number
    hidden: boolean
    features: string[]
    adapter: string
  }
  id: number
}

export interface UserInfo {
  id: string
  name: string
  userId: string
  avatar: string
  username: string
}

export interface MemberInfo {
  user: UserInfo
  nick: string
  roles: string[]
}

export interface GuildInfo {
  id: string
}

export interface ChannelInfo {
  id: string
  type: number
}

// 游戏会话信息提取器
export interface GameSessionInfo {
  platform: string
  selfId: string
  channelId: string
  groupId: string
  userId: string
  userName: string
  userNick: string
  messageId: string
  isGroup: boolean
  isPrivate: boolean
}

export function parseMessageObject(obj: MessageObject | MessageObject[]): Element[] {
  if (Array.isArray(obj)) {
    return obj.flatMap(parseMessageObject)
  }

  const { type, content, url, src, userId, messageId, text, href, theme, title, children, ...attrs } = obj

  switch (type) {
    case 'text':
      return [h.text(content || text || '')]

    case 'image':
      return [h.image(src || url || '', attrs)]

    case 'audio':
      return [h.audio(src || url || '', attrs)]

    case 'video':
      return [h.video(src || url || '', attrs)]

    case 'at':
      return [h.at(userId || '', attrs)]

    case 'quote':
      return [h.quote(messageId || '', attrs)]

    case 'card':
      const cardChildren = children ? children.flatMap(parseMessageObject) : []
      return [h('card', { theme, title, ...attrs }, cardChildren)]

    default:
      const elementChildren = children ? children.flatMap(parseMessageObject) : []
      return [h(type as any, attrs, elementChildren)]
  }
}

// ========== 基础消息创建函数 ==========

export const createTextMessage = (content: string): MessageObject => ({
  type: 'text',
  content
});

export const createErrorMessage = (error: string): MessageObject => ({
  type: 'text',
  content: `❌ ${error}`
});

export const createSuccessMessage = (message: string): MessageObject => ({
  type: 'text',
  content: `✅ ${message}`
});

export const createWarningMessage = (message: string): MessageObject => ({
  type: 'text',
  content: `⚠️ ${message}`
});

export const createInfoMessage = (message: string): MessageObject => ({
  type: 'text',
  content: `ℹ️ ${message}`
});

// ========== Session 数据提取工具 ==========

/**
 * 从 session 数据中提取游戏会话信息
 */
export function extractGameSessionInfo(session: SessionData): GameSessionInfo {
  const isGroup = session.subtype === 'group' || session._data.message_type === 'group';
  
  return {
    platform: session.platform,
    selfId: session.selfId,
    channelId: session.channel?.id || session.guild?.id || 'unknown',
    groupId: session._data.group_id?.toString() || session.guild?.id || 'unknown',
    userId: session.user.id,
    userName: session.user.name,
    userNick: session.member?.nick || session.user.name,
    messageId: session.message.messageId,
    isGroup,
    isPrivate: !isGroup
  };
}

/**
 * 检查用户是否有管理员权限
 */
export function hasAdminPermission(session: SessionData): boolean {
  const roles = session.member?.roles || [];
  return roles.includes('owner') || roles.includes('admin');
}

/**
 * 获取用户显示名称（优先昵称，后备用户名）
 */
export function getUserDisplayName(session: SessionData): string {
  return session.member?.nick || session.user.name || session.user.username;
}

/**
 * 检查消息是否来自群聊
 */
export function isGroupMessage(session: SessionData): boolean {
  return session.subtype === 'group' || session._data.message_type === 'group';
}

/**
 * 检查消息是否来自私聊
 */
export function isPrivateMessage(session: SessionData): boolean {
  return session.subtype === 'private' || session._data.message_type === 'private';
}


// ========== 参数解析工具 ==========

/**
 * 从请求体中提取 session 和 params
 */
export function extractRequestData(body: any): {
  session: SessionData | null;
  params: string[];
  isValid: boolean;
} {
  if (!body || typeof body !== 'object') {
    return { session: null, params: [], isValid: false };
  }

  const session = body.session as SessionData || null;
  const params = Array.isArray(body.params) ? body.params : [];

  return {
    session,
    params,
    isValid: session !== null
  };
}

/**
 * 验证必需参数
 */
export function validateParams(params: string[], minLength: number, errorMessage: string): {
  isValid: boolean;
  error?: MessageObject;
} {
  if (params.length < minLength) {
    return {
      isValid: false,
      error: createErrorMessage(errorMessage)
    };
  }
  return { isValid: true };
}

interface SendGroupMessageConfig {
  groupId: string;
  message: string | MessageObject | MessageObject[];
  baseUrl?: string; // OneBot API 基础地址
}

/**
 * 发送私聊消息的配置
 */
interface SendPrivateMessageConfig {
  userId: string;
  message: string | MessageObject | MessageObject[];
  baseUrl?: string;
}

/**
 * 通用消息发送函数 - 群聊
 */
export async function sendGroupMessage(config: SendGroupMessageConfig): Promise<boolean> {
  try {
    const baseUrl = config.baseUrl || 'http://127.0.0.1:3033';
    
    // 转换消息格式
    const messageData = convertToOneBotFormat(config.message);
    
    const requestData = {
      group_id: config.groupId,
      message: messageData
    };

    const axiosConfig = {
      method: 'post' as const,
      url: `${baseUrl}/send_group_msg`,
      headers: { 
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(requestData)
    };

    const response = await axios(axiosConfig);
    console.log('群聊消息发送成功:', response.data);
    return true;
  } catch (error) {
    console.error('发送群聊消息失败:', error);
    return false;
  }
}

/**
 * 通用消息发送函数 - 私聊
 */
export async function sendPrivateMessage(config: SendPrivateMessageConfig): Promise<boolean> {
  try {
    const baseUrl = config.baseUrl || 'http://127.0.0.1:3033';
    
    // 转换消息格式
    const messageData = convertToOneBotFormat(config.message);
    
    const requestData = {
      user_id: config.userId,
      message: messageData
    };

    const axiosConfig = {
      method: 'post' as const,
      url: `${baseUrl}/send_private_msg`,
      headers: { 
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(requestData)
    };

    const response = await axios(axiosConfig);
    console.log('私聊消息发送成功:', response.data);
    return true;
  } catch (error) {
    console.error('发送私聊消息失败:', error);
    return false;
  }
}

/**
 * 将 MessageObject 转换为 OneBot 消息格式
 */
function convertToOneBotFormat(message: string | MessageObject | MessageObject[]): any[] {
  if (typeof message === 'string') {
    return [{
      type: "text",
      data: {
        text: message
      }
    }];
  }

  if (Array.isArray(message)) {
    return message.flatMap(convertToOneBotFormat);
  }

  // 单个 MessageObject
  const msg = message as MessageObject;
  
  switch (msg.type) {
    case 'text':
      return [{
        type: "text",
        data: {
          text: msg.content || msg.text || ''
        }
      }];
      
    case 'image':
      // 处理 file:// 前缀，OneBot 协议只需要文件路径
      let filePath = msg.src || msg.url || '';
      if (filePath.startsWith('file://')) {
        filePath = filePath.substring(7); // 移除 'file://' 前缀
      }
      return [{
        type: "image",
        data: {
          file: filePath
        }
      }];
      
    case 'at':
      return [{
        type: "at",
        data: {
          qq: msg.userId || ''
        }
      }];
      
    case 'audio':
      // 处理 file:// 前缀
      let audioPath = msg.src || msg.url || '';
      if (audioPath.startsWith('file://')) {
        audioPath = audioPath.substring(7);
      }
      return [{
        type: "record",
        data: {
          file: audioPath
        }
      }];
      
    case 'video':
      // 处理 file:// 前缀
      let videoPath = msg.src || msg.url || '';
      if (videoPath.startsWith('file://')) {
        videoPath = videoPath.substring(7);
      }
      return [{
        type: "video",
        data: {
          file: videoPath
        }
      }];
      
    default:
      // 未知类型，转为文本
      return [{
        type: "text",
        data: {
          text: msg.content || JSON.stringify(msg)
        }
      }];
  }
}

// ========== 会话消息发送工具 ==========

/**
 * 根据 session 信息发送消息（自动判断群聊/私聊）
 */
export async function sendSessionMessage(
  session: SessionData, 
  message: string | MessageObject | MessageObject[],
  baseUrl?: string
): Promise<boolean> {
  const gameInfo = extractGameSessionInfo(session);
  
  if (gameInfo.isGroup) {
    return sendGroupMessage({
      groupId: gameInfo.groupId,
      message,
      baseUrl
    });
  } else {
    return sendPrivateMessage({
      userId: gameInfo.userId,
      message,
      baseUrl
    });
  }
}

/**
 * 发送消息到指定群聊（通过群ID）
 */
export async function sendToGroup(
  groupId: string,
  message: string | MessageObject | MessageObject[],
  baseUrl?: string
): Promise<boolean> {
  return sendGroupMessage({
    groupId,
    message,
    baseUrl
  });
}

/**
 * 发送消息到指定用户（通过用户ID）
 */
export async function sendToUser(
  userId: string,
  message: string | MessageObject | MessageObject[],
  baseUrl?: string
): Promise<boolean> {
  return sendPrivateMessage({
    userId,
    message,
    baseUrl
  });
}