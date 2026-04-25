import type { Database } from "bun:sqlite";
import type { UserProfile, UserIdentity, ProfilePatch } from "@/models/UserProfile";
import { UserProfileSchema } from "@/models/UserProfile";

/**
 * ProfileService — 档案查询与更新服务
 * 职责：提供查询接口供 AIService / Agent / Tool 消费
 * 约束：不直接回复用户，只维护数据
 */
export class ProfileService {
  private db: Database;
  // 热用户缓存：user_id -> { profile, expiresAt }
  private cache: Map<string, { profile: UserProfile; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存

  constructor(db: Database) {
    this.db = db;
    this.initTable();
  }

  private initTable(): void {
    this.db.exec(UserProfileSchema.createTable);
    this.db.exec(UserProfileSchema.createIndex);
  }

  // ─── 查询接口 ───────────────────────────────────────

  /**
   * 获取完整用户画像（带缓存）
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    // 1. 读缓存
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }

    // 2. 查 DB
    const row = this.db.query("SELECT * FROM user_profiles WHERE user_id = ?").get(userId) as
      | UserProfile
      | undefined;
    if (!row) return null;

    // 3. 写缓存
    this.cache.set(userId, { profile: row, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return row;
  }

  /**
   * 获取精简身份视图（供 AIService system prompt 注入）
   */
  async getUserIdentity(userId: string): Promise<UserIdentity | null> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return null;

    const interests: string[] = safeJsonParse(profile.interests, []);
    const skills: string[] = safeJsonParse(profile.skills, []);
    const tags = [...new Set([...interests, ...skills])];

    const daysSince = Math.floor((Date.now() - profile.first_seen * 1000) / (1000 * 60 * 60 * 24));
    const knownSince = daysSince <= 1 ? "今天" : `${daysSince} 天`;

    return {
      userId: profile.user_id,
      name: profile.user_name || `用户${profile.user_id}`,
      knownSince,
      tags: tags.slice(0, 8), // 最多 8 个标签，避免 prompt 过长
    };
  }

  /**
   * 获取用户近期动态摘要
   */
  async getUserRecentContext(userId: string, days: number = 7): Promise<string> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return "暂无档案记录";

    const parts: string[] = [];
    if (profile.recent_mood) parts.push(`最近状态：${profile.recent_mood}`);

    const plans: Array<{ plan: string; status?: string }> = safeJsonParse(profile.plans, []);
    if (plans.length > 0) {
      const activePlans = plans.filter(p => p.status !== "已完成" && p.status !== "cancelled");
      if (activePlans.length > 0) {
        parts.push(`进行中的计划：${activePlans.map(p => p.plan).join("、")}`);
      }
    }

    return parts.length > 0 ? parts.join("；") : "近期暂无显著动态";
  }

  /**
   * 搜索用户历史提及的某话题（基于 compressed_log）
   */
  async searchUserMemory(userId: string, query: string): Promise<Array<{ fact: string; date?: string }>> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return [];

    // 简单关键词匹配（后续可升级向量搜索）
    const log = profile.compressed_log;
    if (!log) return [];

    const lines = log.split("\n").filter(l => l.trim());
    const matches = lines
      .filter(line => line.toLowerCase().includes(query.toLowerCase()))
      .map(line => ({ fact: line.trim() }));

    return matches.slice(0, 5);
  }

  // ─── 更新接口（供 ProfileWorker 调用）─────────────────

  /**
   * 全量覆盖更新（用于初始化或压缩后重建）
   */
  async updateProfile(userId: string, profile: Partial<UserProfile>): Promise<void> {
    const existing = await this.getUserProfile(userId);
    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      const setClause = Object.keys(profile)
        .map(k => `${k} = ?`)
        .join(", ");
      const values = [...Object.values(profile), now, userId];
      this.db.query(`UPDATE user_profiles SET ${setClause}, updated_at = ? WHERE user_id = ?`).run(...values);
    } else {
      const defaults: Partial<UserProfile> = {
        user_name: "",
        identity: "",
        interests: "[]",
        skills: "[]",
        recent_mood: "",
        plans: "[]",
        social_links: "{}",
        compressed_log: "",
        message_count: 0,
        first_seen: now,
        updated_at: now,
      };
      const merged = { ...defaults, ...profile, user_id: userId, updated_at: now };
      const keys = Object.keys(merged);
      const placeholders = keys.map(() => "?").join(", ");
      this.db.query(`INSERT INTO user_profiles (${keys.join(", ")}) VALUES (${placeholders})`).run(...Object.values(merged));
    }

    // 清除缓存，下次读取最新
    this.cache.delete(userId);
  }

  /**
   * 增量合并补丁（用于日常更新，保留旧数据+合并新数据）
   */
  async patchProfile(userId: string, patch: ProfilePatch, messageCountDelta: number = 0): Promise<void> {
    const existing = await this.getUserProfile(userId);
    const now = Math.floor(Date.now() / 1000);

    if (!existing) {
      // 首次创建，直接用 patch 内容
      const newProfile: Partial<UserProfile> = {
        user_name: patch.identity ? "" : "",
        identity: patch.identity || "",
        interests: JSON.stringify(patch.interests || []),
        skills: JSON.stringify(patch.skills || []),
        recent_mood: patch.recent_mood || "",
        plans: JSON.stringify(patch.plans || []),
        social_links: JSON.stringify(patch.social_links || {}),
        message_count: messageCountDelta,
        first_seen: now,
      };
      await this.updateProfile(userId, newProfile);
      return;
    }

    // 合并逻辑
    const mergedInterests = mergeArrays(safeJsonParse(existing.interests, []), patch.interests || []);
    const mergedSkills = mergeArrays(safeJsonParse(existing.skills, []), patch.skills || []);
    const mergedPlans = mergePlans(safeJsonParse(existing.plans, []), patch.plans || []);

    // compressed_log 追加新 facts
    let newLog = existing.compressed_log;
    if (patch.facts && patch.facts.length > 0) {
      const logLines = patch.facts.map(f => `[${new Date().toISOString().slice(0, 10)}] ${f.type}: ${f.value}`);
      newLog = [existing.compressed_log, ...logLines].filter(Boolean).join("\n");
    }

    await this.updateProfile(userId, {
      identity: patch.identity || existing.identity,
      interests: JSON.stringify(mergedInterests),
      skills: JSON.stringify(mergedSkills),
      recent_mood: patch.recent_mood || existing.recent_mood,
      plans: JSON.stringify(mergedPlans),
      social_links: JSON.stringify({ ...safeJsonParse(existing.social_links, {}), ...(patch.social_links || {}) }),
      compressed_log: newLog,
      message_count: existing.message_count + messageCountDelta,
    });
  }

  /**
   * 清除缓存（供外部在数据变更后调用）
   */
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * 获取所有有档案的用户 ID（用于定时压缩巡检）
   */
  getAllProfiledUsers(): string[] {
    const rows = this.db.query("SELECT user_id FROM user_profiles").all() as Array<{ user_id: string }>;
    return rows.map(r => r.user_id);
  }

  // ─── W3: 消息查询接口（供 ContextRecovery / Tool 使用）─────────────────

  /**
   * 按关键词搜索频道内的近期消息
   */
  async searchMessagesByKeyword(channelId: string, keyword: string, hours: number): Promise<any[]> {
    const since = Date.now() - hours * 3600 * 1000;

    if (keyword) {
      return this.db
        .query(
          `SELECT * FROM messages 
           WHERE channel_id = ? AND timestamp >= ? AND content LIKE ?
           ORDER BY timestamp DESC LIMIT 50`
        )
        .all(channelId, since, `%${keyword}%`) as any[];
    } else {
      return this.db
        .query(
          `SELECT * FROM messages 
           WHERE channel_id = ? AND timestamp >= ?
           ORDER BY timestamp DESC LIMIT 50`
        )
        .all(channelId, since) as any[];
    }
  }

  /**
   * 获取用户近期消息（供精确回溯）
   */
  async getUserRecentMessages(userId: string, hours: number): Promise<any[]> {
    const since = Date.now() - hours * 3600 * 1000;
    return this.db
      .query(
        `SELECT * FROM messages 
         WHERE user_id = ? AND timestamp >= ?
         ORDER BY timestamp DESC LIMIT 50`
      )
      .all(userId, since) as any[];
  }
}

// ─── 工具函数 ─────────────────────────────────────────

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function mergeArrays<T>(existing: T[], incoming: T[]): T[] {
  return [...new Set([...existing, ...incoming])];
}

function mergePlans(
  existing: Array<{ plan: string; deadline?: string; status?: string }>,
  incoming: Array<{ plan: string; deadline?: string; status?: string }>
): Array<{ plan: string; deadline?: string; status?: string }> {
  const map = new Map<string, typeof existing[0]>();
  for (const p of existing) map.set(p.plan, p);
  for (const p of incoming) map.set(p.plan, p); // 同名计划覆盖
  return Array.from(map.values());
}
