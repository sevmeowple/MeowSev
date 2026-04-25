/**
 * 每日摘要模型 (Layer 2: Daily Digest)
 * 按天聚合用户的结构化事实，作为 Core Profile 的中间层
 */

export interface DailyDigest {
  id?: number;
  user_id: string;          // QQ 号
  date: string;             // YYYY-MM-DD
  summary: string;          // LLM 生成的一日摘要
  facts: string;            // JSON 数组（结构化事实）
  message_count: number;    // 当日处理的消息数
  created_at: number;       // 创建时间戳
}

export const DailyDigestSchema = {
  tableName: 'daily_digests',
  createTable: `
    CREATE TABLE IF NOT EXISTS daily_digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      facts TEXT NOT NULL DEFAULT '[]',
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `,
  createIndex: `
    CREATE INDEX IF NOT EXISTS idx_digests_user_date ON daily_digests(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_digests_date ON daily_digests(date);
  `
};
