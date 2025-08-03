export interface Message {
  id?: number;
  message_id: string;           // Koishi 消息 ID
  user_id: string;              // 发送者 ID
  user_name: string;            // 发送者名称
  user_nick?: string;           // 群昵称
  group_id?: string;            // 群组 ID
  channel_id: string;           // 频道 ID
  content: string;              // 消息内容
  raw_message?: string;         // 原始消息
  message_type: string;         // 消息类型 (text, image, quote 等)
  platform: string;            // 平台 (onebot, discord 等)
  timestamp: number;            // 时间戳
  created_at?: string;          // 创建时间
}

export const MessageSchema = {
  tableName: 'messages',
  createTable: `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_nick TEXT,
      group_id TEXT,
      channel_id TEXT NOT NULL,
      content TEXT NOT NULL,
      raw_message TEXT,
      message_type TEXT NOT NULL,
      platform TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
};