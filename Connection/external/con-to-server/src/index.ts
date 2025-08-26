import { Context, Schema } from 'koishi'
import { resolve } from 'path'
import { } from '@koishijs/plugin-console'
import axios from 'axios'
import { parseMessageObject } from './message'
import { Logger } from 'koishi'
const logger = new Logger('con-to-server')

import fs from 'fs'
import path from 'path'

// 添加调试日志函数
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) : ''}\n\n`;
  fs.appendFileSync(path.join(__dirname, '../debug.log'), logMessage);
}
export const name = 'con-to-server'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.inject(['console'], (ctx) => {
    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })
  })


ctx.command('喵喵 [...params]')
  .action(async ({ session }, ...params) => {
    // 构造基础 URL
    const endpoint = params[0] ? encodeURIComponent(params[0]) : ''
    let url = `http://127.0.0.1:6040/${endpoint}`

    // 构造请求体，包含 session 和参数
    const requestBody = {
      session: session,
      params: params.slice(1)
    }

    try {
      const response = await axios.post(url, requestBody)

        // 如果响应是消息对象数组，逐条发送
        if (Array.isArray(response.data)) {
          debugLog('收到消息数组:', response.data);
          for (const messageObj of response.data) {
            const elements = parseMessageObject(messageObj);
            await session.send(elements);
          }
          return;
        }

        // 如果响应是单个消息对象，解析后发送
        if (response.data && typeof response.data === 'object' && response.data.type) {
          debugLog('收到单个消息对象:', response.data);
          const elements = parseMessageObject(response.data)
          session.send(elements)
          return
        }

        return `请求成功：${JSON.stringify(response.data)}`
      } catch (err: any) {
        return `请求失败：${err.message}`
      }
    })

  ctx.on('message', async (session) => {
    const endpoint = 'message'
    const url = `http://127.0.0.1:6040/${endpoint}`
    try {
      const response = await axios.post(url, { data: session })

      // 服务端通过 shouldReply 字段控制是否回复
      if (response.data?.shouldReply) {
        const payload = response.data.data

        // 与 command 中相同的处理逻辑
        if (Array.isArray(payload)) {
          debugLog('收到消息数组:', payload)
          for (const messageObj of payload) {
            const elements = parseMessageObject(messageObj)
            await session.send(elements)
          }
          return
        }

        if (payload && typeof payload === 'object' && payload.type) {
          debugLog('收到单个消息对象:', payload)
          const elements = parseMessageObject(payload)
          await session.send(elements)
          return
        }
      }
    } catch (err: any) {
      console.error(`转发消息失败：${err.message}`)
    }
  })
}
