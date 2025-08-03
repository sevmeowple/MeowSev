import { Element, h } from 'koishi'

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


// 创建常用的消息对象辅助函数
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