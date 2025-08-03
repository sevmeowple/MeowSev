import { Element, h } from 'koishi'
import fs from 'fs'
import path from 'path'

// 添加调试日志函数
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) : ''}\n\n`;
  fs.appendFileSync(path.join(__dirname, '../debug.log'), logMessage);
}

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

export function parseMessageObject(obj: MessageObject | MessageObject[]): Element[] {
  // 调试日志函数
  function debugLog(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] parseMessageObject: ${message}\n${data ? JSON.stringify(data, null, 2) : ''}\n\n`;
    fs.appendFileSync(path.join(__dirname, '../debug.log'), logMessage);
  }

  debugLog('parseMessageObject 输入:', obj);

  if (Array.isArray(obj)) {
    return obj.flatMap(parseMessageObject)
  }

  const { type, content, url, src, userId, messageId, text, href, theme, title, children, ...attrs } = obj
  debugLog('解析的字段:', { type, content, text });

  switch (type) {
    case 'text':
      const textElements = [h.text(content || text || '')];
      debugLog('生成的文本元素:', textElements);
      return textElements;

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
      debugLog('未知的消息类型:', type);
      return [h.text(content || '未知消息类型')];
  }
}