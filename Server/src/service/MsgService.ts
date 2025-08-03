import { ConfigUnionType } from "@/config/config";
import { DatabaseManager } from "../config/database";
import { Message, MessageSchema } from "../models/Message";
import Database from "bun:sqlite";

export class MsgService {
  private db: Database;

  constructor(ConfigUnion: ConfigUnionType) {
    this.db = ConfigUnion.database;
    this.db.exec(MessageSchema.createTable);
  }

  // 从 Koishi session 数据中提取并保存消息
  async handleMessage(sessionData: any) {
    try {
      // 提取关键字段
      const messageData = this.extractMessageData(sessionData);

      // 保存到数据库
      const savedMessage = await this.createMessage(messageData);

      console.log(`消息已保存: ${messageData.user_name} 在 ${messageData.channel_id} 说: ${messageData.content}`);

      return savedMessage;
    } catch (error) {
      console.error('处理消息失败:', error);
      throw error;
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
