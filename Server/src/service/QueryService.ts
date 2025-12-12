import { ConfigUnionType } from "@/config/config";
import { Message } from "@/models/Message";
import Database from "bun:sqlite";

export class QueryService {
  private db: Database;

  constructor(ConfigUnion: ConfigUnionType) {
    this.db = ConfigUnion.database;
  }

  async getMessages(limit: number = 100): Promise<Message[]> {
    const query = this.db.query("SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?");
    return query.all(limit) as Message[];
  }

  async getMessagesByUser(userId: string): Promise<Message[]> {
    const query = this.db.query("SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC");
    return query.all(userId) as Message[];
  }

  async getMessagesByChannel(channelId: string): Promise<Message[]> {
    const query = this.db.query("SELECT * FROM messages WHERE channel_id = ? ORDER BY timestamp DESC");
    return query.all(channelId) as Message[];
  }

  // 查询指定用户在指定频道的最近消息
  async getRecentMessagesByUserAndChannel(
    userId: string,
    channelId: string,
    limit: number = 15
  ): Promise<Message[]> {
    const query = this.db.query(`
      SELECT * FROM messages 
      WHERE user_id = ? AND channel_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return query.all(userId, channelId, limit) as Message[];
  }

  // 查询频道内所有用户的最近消息（用于群聊上下文）
  async getRecentChannelMessages(channelId: string, limit: number = 15): Promise<Message[]> {
    const query = this.db.query(`
      SELECT * FROM messages 
      WHERE channel_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return query.all(channelId, limit) as Message[];
  }

  // 查询指定时间范围内频道的消息
  async getMessagesByTimeRange(
    channelId: string,
    startTime: number,
    endTime: number
  ): Promise<Message[]> {
    const query = this.db.query(`
      SELECT * FROM messages 
      WHERE channel_id = ? AND timestamp >= ? AND timestamp < ?
      ORDER BY timestamp ASC
    `);
    return query.all(channelId, startTime, endTime) as Message[];
  }

}