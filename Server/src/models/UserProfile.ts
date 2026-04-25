/**
 * 用户核心画像模型 (Layer 3: Core Profile)
 * 单用户单行，通过压缩保证数据量永远可控
 */

export interface UserProfile {
  user_id: string;           // QQ 号，主键
  user_name: string;         // 最近已知昵称
  identity: string;          // 身份描述（LLM 生成的一句话）
  interests: string;         // JSON 数组字符串 ["原神","前端"]
  skills: string;            // JSON 数组字符串
  recent_mood: string;       // 最近情绪/状态摘要
  plans: string;             // JSON 数组字符串（计划列表）
  social_links: string;      // JSON 对象（互动关系）
  compressed_log: string;    // 压缩后的历史日志（溯源用）
  message_count: number;     // 累计处理消息数
  first_seen: number;        // 首次出现时间戳
  updated_at: number;        // 最后更新时间戳
}

/**
 * LLM 提取的结构化档案补丁
 * 用于增量更新，避免全量覆盖
 */
export interface ProfilePatch {
  identity?: string;
  interests?: string[];
  skills?: string[];
  recent_mood?: string;
  plans?: Array<{ plan: string; deadline?: string; status?: string }>;
  social_links?: Record<string, string[]>;
  facts?: Array<{ type: string; value: string; confidence: number }>;
}

/**
 * 对外暴露的精简身份视图
 */
export interface UserIdentity {
  userId: string;
  name: string;
  knownSince: string;   // "认识 45 天"
  tags: string[];       // 合并 interests + skills 的标签
}

export const UserProfileSchema = {
  tableName: 'user_profiles',
  createTable: `
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL DEFAULT '',
      identity TEXT NOT NULL DEFAULT '',
      interests TEXT NOT NULL DEFAULT '[]',
      skills TEXT NOT NULL DEFAULT '[]',
      recent_mood TEXT NOT NULL DEFAULT '',
      plans TEXT NOT NULL DEFAULT '[]',
      social_links TEXT NOT NULL DEFAULT '{}',
      compressed_log TEXT NOT NULL DEFAULT '',
      message_count INTEGER NOT NULL DEFAULT 0,
      first_seen INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,
  // 初始化时执行的索引（SQLite 支持 IF NOT EXISTS）
  createIndex: `
    CREATE INDEX IF NOT EXISTS idx_profiles_updated ON user_profiles(updated_at);
  `
};
