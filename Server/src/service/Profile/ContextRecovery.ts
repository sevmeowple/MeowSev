import type { Database } from "bun:sqlite";
import type { Message } from "@/models/Message";

/**
 * ContextRecovery — 群聊上下文恢复引擎
 * 职责：解决"刚才那个链接是什么""我昨天发的方案"这类指代问题
 */
export class ContextRecovery {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // ─── 指代消解 ───────────────────────────────────────

  /**
   * 解析用户的指代查询
   * @param query 用户原始查询（如"刚才那个链接""前面的方案"）
   * @param channelId 频道 ID
   * @param hours 回溯时间窗口（默认最近 2 小时）
   */
  async resolveReference(
    query: string,
    channelId: string,
    hours: number = 2
  ): Promise<{
    type: "link" | "topic" | "message" | "unknown";
    results: Message[];
    summary: string;
  }> {
    const since = Date.now() - hours * 3600 * 1000;

    // 判断指代类型
    const lowerQuery = query.toLowerCase();
    let type: "link" | "topic" | "message" | "unknown" = "unknown";

    if (lowerQuery.includes("链接") || lowerQuery.includes("url") || lowerQuery.includes("网站")) {
      type = "link";
    } else if (lowerQuery.includes("图") || lowerQuery.includes("照片") || lowerQuery.includes("截图")) {
      type = "message"; // 图片消息
    } else if (lowerQuery.includes("方案") || lowerQuery.includes("计划") || lowerQuery.includes("想法")) {
      type = "topic";
    } else {
      type = "message";
    }

    let results: Message[] = [];

    if (type === "link") {
      results = this.db
        .query(
          `SELECT * FROM messages 
           WHERE channel_id = ? AND timestamp >= ? AND has_link = 1
           ORDER BY timestamp DESC LIMIT 10`
        )
        .all(channelId, since) as Message[];
    } else if (type === "topic") {
      // 提取 query 中的关键词，按关键词搜索
      const keyword = this.extractKeyword(query);
      results = this.db
        .query(
          `SELECT * FROM messages 
           WHERE channel_id = ? AND timestamp >= ? AND content LIKE ?
           ORDER BY timestamp DESC LIMIT 10`
        )
        .all(channelId, since, `%${keyword}%`) as Message[];
    } else {
      // 默认：返回最近 N 条消息
      results = this.db
        .query(
          `SELECT * FROM messages 
           WHERE channel_id = ? AND timestamp >= ?
           ORDER BY timestamp DESC LIMIT 20`
        )
        .all(channelId, since) as Message[];
    }

    // 反转回时间正序
    results.reverse();

    const summary = this.generateSummary(type, results);
    return { type, results, summary };
  }

  // ─── 话题搜索 ───────────────────────────────────────

  /**
   * 按关键词搜索频道内的历史话题
   */
  async searchTopic(
    channelId: string,
    keyword: string,
    days: number = 7
  ): Promise<{
    messages: Message[];
    participants: string[];
    summary: string;
  }> {
    const since = Date.now() - days * 86400 * 1000;

    const messages = this.db
      .query(
        `SELECT * FROM messages 
         WHERE channel_id = ? AND timestamp >= ? AND content LIKE ?
         ORDER BY timestamp ASC`
      )
      .all(channelId, since, `%${keyword}%`) as Message[];

    const participants = [...new Set(messages.map(m => m.user_id))];

    const summary = messages.length > 0
      ? `在 ${days} 天内找到 ${messages.length} 条关于「${keyword}」的消息，涉及 ${participants.length} 位用户`
      : `在 ${days} 天内未找到关于「${keyword}」的讨论`;

    return { messages, participants, summary };
  }

  // ─── 工具方法 ───────────────────────────────────────

  private extractKeyword(query: string): string {
    // 简单提取：去掉常见疑问词，取核心名词
    const stopWords = ["刚才", "那个", "前面", "的", "什么", "怎么", "哪里", "谁", "吗", "呢", "啊"];
    let cleaned = query;
    for (const sw of stopWords) {
      cleaned = cleaned.replace(sw, "");
    }
    return cleaned.trim() || query;
  }

  private generateSummary(type: string, results: Message[]): string {
    if (results.length === 0) return "未找到相关内容";

    if (type === "link") {
      const links = results
        .map(m => {
          const match = m.content.match(/https?:\/\/[^\s]+/);
          return match ? match[0] : null;
        })
        .filter(Boolean);
      return `找到 ${links.length} 个链接：\n${links.slice(0, 5).join("\n")}`;
    }

    const speakers = [...new Set(results.map(m => m.user_name || m.user_id))];
    return `找到 ${results.length} 条相关消息，涉及用户：${speakers.join("、")}`;
  }
}
