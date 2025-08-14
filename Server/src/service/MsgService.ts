import { ConfigUnionType } from "@/config/config";
import { DatabaseManager } from "../config/database";
import { Message, MessageSchema } from "../models/Message";
import Database from "bun:sqlite";
import { promises as fs } from 'fs';
import path from 'path';
import { CQCodeProcessor } from "./message/type";

// 图片下载工具函数
async function downloadImageFromMessage(content: string, downloadPath: string) {
  // 正则提取图片URL
  const imgMatch = content.match(/src="([^"]+)"/);
  if (!imgMatch) {
    console.log('未找到图片URL');
    return;
  }

  const imageUrl = imgMatch[1].replace(/&amp;/g, '&');

  // 提取文件名
  const fileMatch = content.match(/file="([^"]+)"/);
  const fileName = fileMatch ? fileMatch[1] : `image_${Date.now()}.jpg`;

  console.log(`📥 开始下载图片: ${fileName}`);
  console.log(`🔗 URL: ${imageUrl}`);

  try {
    // 确保下载目录存在
    await fs.mkdir(downloadPath, { recursive: true });

    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const filePath = path.join(downloadPath, fileName);

    await fs.writeFile(filePath, Buffer.from(buffer));

    console.log(`✅ 图片下载成功: ${filePath}`);
    console.log(`📊 文件大小: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ 图片下载失败:', error);
  }
}

export class MsgService {
  private db: Database;
  private processors: CQCodeProcessor[] = []; // 注入的处理器
  constructor(ConfigUnion: ConfigUnionType) {
    this.db = ConfigUnion.database;
    this.db.exec(MessageSchema.createTable);
  }

  // 新增：注册 CQ 码处理器
  registerProcessor(processor: CQCodeProcessor): void {
    this.processors.push(processor);
    console.log(`📝 注册 CQ 码处理器: ${processor.name}`);
  }

  // 新增：批量注册处理器
  registerProcessors(processors: CQCodeProcessor[]): void {
    processors.forEach(processor => this.registerProcessor(processor));
  }



  // 从 Koishi session 数据中提取并保存消息
  async handleMessage(sessionData: any) {
    try {
      // 提取关键字段
      const messageData = this.extractMessageData(sessionData);

      // 保存到数据库
      const savedMessage = await this.createMessage(messageData);

      console.log(`消息已保存: ${messageData.user_name} 在 ${messageData.channel_id} 说: ${messageData.content}`);

      // 新增：处理 CQ 码
      if (messageData.raw_message) {
        await this.processCQCodes(messageData.raw_message, sessionData);
      }

      return savedMessage;
    } catch (error) {
      console.error('处理消息失败:', error);
      throw error;
    }
  }

  // 新增：遍历所有处理器进行处理
  private async processCQCodes(rawMessage: string, sessionData: any) {
    for (const processor of this.processors) {
      try {
        if (processor.detector.canHandle(rawMessage)) {
          const matches = processor.detector.detect(rawMessage);
          for (const match of matches) {
            await processor.handler.handle(match, sessionData);
          }
        }
      } catch (error) {
        console.error(`❌ 处理器 ${processor.name} 执行失败:`, error);
      }
    }
  }

  // 提取消息数据的核心逻辑
  private extractMessageData(sessionData: any): Omit<Message, 'id' | 'created_at'> {
    const { message, user, member, guild, channel, platform, timestamp, _data } = sessionData;

    // 判断消息类型
    let messageType = 'text';
    if (message.content.includes('<img')) messageType = 'image';
    else if (message.content.includes('<quote')) messageType = 'quote';
    else if (message.quote) messageType = 'reply';

    return {
      message_id: message.messageId || message.id,
      user_id: user.id,
      user_name: user.name || user.username,
      user_nick: member?.nick ?? null,     // 直接设为 null
      group_id: guild?.id ?? null,         // 直接设为 null
      channel_id: channel.id,
      content: this.cleanContent(message.content),
      raw_message: _data?.raw_message ?? null,  // 直接设为 null
      message_type: messageType,
      platform: platform,
      timestamp: timestamp
    };
  }

  // 清理消息内容，去除 HTML 标签
  private cleanContent(content: string): string {
    return content
      .replace(/<[^>]*>/g, '') // 去除 HTML 标签
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  // 更新创建消息方法
  async createMessage(messageData: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    const query = this.db.query(`
    INSERT INTO messages (
      message_id, user_id, user_name, user_nick, group_id, 
      channel_id, content, raw_message, message_type, platform, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);

    return query.get(
      messageData.message_id,
      messageData.user_id,
      messageData.user_name,
      messageData.user_nick ?? null,       // 转换 undefined 为 null
      messageData.group_id ?? null,        // 转换 undefined 为 null
      messageData.channel_id,
      messageData.content,
      messageData.raw_message ?? null,     // 转换 undefined 为 null
      messageData.message_type,
      messageData.platform,
      messageData.timestamp
    ) as Message;
  }

  // 其他查询方法...
  async getMessages(): Promise<Message[]> {
    const query = this.db.query("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100");
    return query.all() as Message[];
  }

  async getMessagesByUser(userId: string): Promise<Message[]> {
    const query = this.db.query("SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC");
    return query.all(userId) as Message[];
  }
}
