import type { Database } from "bun:sqlite";
import type { AIClientSDK } from "@/config/AI";
import type { Message } from "@/models/Message";
import type { ProfilePatch } from "@/models/UserProfile";
import { DailyDigestSchema } from "@/models/DailyDigest";
import { ProfileService } from "./ProfileService";
import { MessageFilter } from "./MessageFilter";
import { generateText } from "ai";

/**
 * ProfileWorker — 档案维护引擎
 * 职责：从群消息中提取结构化事实，更新用户画像
 * 约束：
 *   - 不直接回复用户
 *   - 异步执行，不阻塞消息回复主链路
 *   - 使用 LLM 进行事实提取（有成本，需配合 MessageFilter 使用）
 */
export class ProfileWorker {
  private ai: AIClientSDK;
  private profileService: ProfileService;
  private db: Database;
  private messageFilter: MessageFilter;

  // 实时队列：user_id -> Message[]（内存暂存，定时刷新或触发处理）
  private realtimeQueue: Map<string, Message[]> = new Map();
  private processingUsers: Set<string> = new Set(); // 去重锁，防止同一用户并发处理
  private flushTimer: Timer | null = null;
  private readonly FLUSH_INTERVAL_MS = 30 * 1000; // 30 秒自动刷新队列
  private readonly BATCH_SIZE = 20; // 单次处理最多消息数

  constructor(ai: AIClientSDK, db: Database) {
    this.ai = ai;
    this.db = db;
    this.profileService = new ProfileService(db);
    this.messageFilter = new MessageFilter();
    this.initDailyDigestTable();
    this.startFlushTimer();
  }

  private initDailyDigestTable(): void {
    this.db.exec(DailyDigestSchema.createTable);
    this.db.exec(DailyDigestSchema.createIndex);
  }

  // ─── 实时队列接口 ───────────────────────────────────

  /**
   * 将消息加入实时处理队列（由 BotCore/MsgController 调用）
   * 非阻塞，立即返回
   */
  enqueue(message: Message): void {
    // W2: 使用 MessageFilter 过滤低价值消息
    if (!this.messageFilter.shouldProcess(message)) {
      return;
    }

    const userId = message.user_id;
    if (!this.realtimeQueue.has(userId)) {
      this.realtimeQueue.set(userId, []);
    }
    this.realtimeQueue.get(userId)!.push(message);

    // 单个用户积累到阈值立即触发处理
    if (this.realtimeQueue.get(userId)!.length >= this.BATCH_SIZE) {
      this.flushUser(userId);
    }
  }

  /**
   * 手动触发指定用户的档案重建（供命令调用）
   * 从历史消息中全量重建，而非增量
   */
  async rebuildUserProfile(userId: string, userName?: string): Promise<void> {
    // 拉取该用户最近 100 条消息（W1 足够构建基础画像）
    const messages = this.db
      .query(
        `SELECT * FROM messages 
         WHERE user_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 100`
      )
      .all(userId) as Message[];

    if (messages.length === 0) {
      console.log(`[ProfileWorker] 用户 ${userId} 无历史消息，跳过重建`);
      throw new Error("该用户没有历史消息记录");
    }

    // 反转回时间正序，方便 LLM 理解
    messages.reverse();

    console.log(`[ProfileWorker] 重建用户 ${userId} 档案，基于 ${messages.length} 条消息`);

    const patch = await this.extractFactsFromBatch(messages, true);

    // 如果 LLM 提取失败（返回空 patch），视为重建失败
    if (this.isEmptyPatch(patch)) {
      throw new Error("AI 档案提取失败，请检查 API 配置或稍后重试");
    }

    await this.profileService.patchProfile(userId, patch, messages.length);

    // 更新用户名（如果有）
    if (userName) {
      await this.profileService.updateProfile(userId, { user_name: userName });
    }

    console.log(`[ProfileWorker] 用户 ${userId} 档案重建完成`);
  }

  /**
   * 强制刷新所有队列中的用户
   */
  async flushAll(): Promise<void> {
    const users = Array.from(this.realtimeQueue.keys());
    for (const userId of users) {
      await this.flushUser(userId);
    }
  }

  /**
   * W2: 处理指定用户某日的消息批量（定时补偿路径）
   * @param userId 用户 ID
   * @param date YYYY-MM-DD
   * @param rawMessages 原始消息列表（已按时间排序）
   */
  async processDailyBatch(userId: string, date: string, rawMessages: Array<Partial<Message>>): Promise<void> {
    // 1. 过滤低价值消息
    const messages = this.messageFilter.filterBatch(rawMessages as Message[]);
    if (messages.length === 0) {
      console.log(`[ProfileWorker] 用户 ${userId} 在 ${date} 无高价值消息，跳过`);
      return;
    }

    console.log(`[ProfileWorker] 处理用户 ${userId} 的 ${date} 日报，${rawMessages.length} 条原始消息 → ${messages.length} 条高价值消息`);

    // 2. 提取事实
    const patch = await this.extractFactsFromBatch(messages, false);
    if (this.isEmptyPatch(patch)) {
      console.log(`[ProfileWorker] 用户 ${userId} 在 ${date} 未提取到有效事实，跳过`);
      return;
    }

    // 3. 生成 summary
    const summary = this.generateSummaryFromPatch(patch);

    // 4. 保存 DailyDigest
    const now = Math.floor(Date.now() / 1000);
    // 先尝试 UPDATE，不存在则 INSERT（避免 UNIQUE 约束缺失导致 ON CONFLICT 报错）
    const existing = this.db
      .query("SELECT id FROM daily_digests WHERE user_id = ? AND date = ?")
      .get(userId, date) as { id: number } | null;
    
    if (existing) {
      this.db
        .query(
          `UPDATE daily_digests SET summary = ?, facts = ?, message_count = ?, created_at = ? WHERE id = ?`
        )
        .run(summary, JSON.stringify(patch.facts || []), messages.length, now, existing.id);
    } else {
      this.db
        .query(
          `INSERT INTO daily_digests (user_id, date, summary, facts, message_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(userId, date, summary, JSON.stringify(patch.facts || []), messages.length, now);
    }

    // 5. 合并到 Core Profile
    await this.profileService.patchProfile(userId, patch, messages.length);

    // 6. 标记为已处理（定时补偿）
    const messageIds = (rawMessages as Message[]).map(m => m.message_id).filter(Boolean) as string[];
    if (messageIds.length > 0) {
      this.markMessagesProcessed(messageIds, 2);
    }

    console.log(`[ProfileWorker] 用户 ${userId} 的 ${date} 日报已保存并合并到档案`);
  }

  // ─── 内部处理 ───────────────────────────────────────

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushAll().catch(err => console.error("[ProfileWorker] 定时刷新失败:", err));
    }, this.FLUSH_INTERVAL_MS);
  }

  private async flushUser(userId: string): Promise<void> {
    if (this.processingUsers.has(userId)) return; // 正在处理中，跳过

    const batch = this.realtimeQueue.get(userId);
    if (!batch || batch.length === 0) return;

    // 取出并清空队列
    this.realtimeQueue.set(userId, []);
    this.processingUsers.add(userId);

    try {
      console.log(`[ProfileWorker] 处理用户 ${userId} 的 ${batch.length} 条消息`);
      const patch = await this.extractFactsFromBatch(batch, false);
      // 实时更新允许空 patch（可能只是闲聊，没有可提取的事实）
      await this.profileService.patchProfile(userId, patch, batch.length);
      // 标记为已处理（实时处理）
      const messageIds = batch.map(m => m.message_id).filter(Boolean) as string[];
      if (messageIds.length > 0) {
        this.markMessagesProcessed(messageIds, 1);
      }
    } catch (error) {
      console.error(`[ProfileWorker] 处理用户 ${userId} 失败:`, error);
      // 实时更新失败不阻塞，消息丢弃（避免无限重试消耗 token）
    } finally {
      this.processingUsers.delete(userId);
    }
  }

  /**
   * 调用 LLM 从一批消息中提取结构化事实
   * @param messages 消息列表（时间正序）
   * @param isRebuild 是否全量重建模式（影响 prompt）
   */
  private async extractFactsFromBatch(messages: Message[], isRebuild: boolean): Promise<ProfilePatch> {
    const messageText = messages
      .map(m => {
        const time = new Date(m.timestamp).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        const name = m.user_name || m.user_nick || `用户${m.user_id}`;
        return `[${time}] ${name}: ${m.content}`;
      })
      .join("\n");

    const systemPrompt = `你是一名专业的社交档案分析员。你的任务是从群聊记录中提取用户的结构化画像信息。

提取规则：
1. 只提取高置信度事实（用户明确表达过，或多次提及的）
2. 忽略水群内容（纯表情、无意义复读、闲聊）
3. 对模糊信息标注低置信度，不要编造
4. 输出严格的 JSON 格式，不要有任何额外文本

输出字段说明：
- identity: 一句话身份描述（如"前端工程师，原神玩家"）
- interests: 兴趣标签数组（如["原神","徒步","猫咪"]）
- skills: 技能标签数组（如["React","Python","摄影"]）
- recent_mood: 最近情绪/状态摘要（如"最近在忙面试，情绪积极"）
- plans: 计划数组，每个包含 plan(内容), deadline(截止日期), status(状态)
- facts: 关键事实数组，每个包含 type(类型), value(内容), confidence(0-1)`;

    const prompt = `${isRebuild ? "【全量重建模式】" : "【增量更新模式】"}

以下是一位用户在群聊中的发言记录（共 ${messages.length} 条）：

${messageText}

请从以上记录中提取该用户的画像信息，以 JSON 格式返回。如果某字段没有信息，返回空值或空数组。

要求返回格式：
{
  "identity": "string",
  "interests": ["string"],
  "skills": ["string"],
  "recent_mood": "string",
  "plans": [{"plan": "string", "deadline": "string", "status": "string"}],
  "facts": [{"type": "string", "value": "string", "confidence": number}]
}`;

    let rawText = "";
    try {
      // 使用 ai SDK 的 generateText 直接调用，使用 system + prompt 参数模式
      // 绕过 AIClientSDK.generateText() 的 messages 数组模式（与 kimi-for-coding 兼容性问题）
      const result = await generateText({
        model: this.ai.getModel(),
        system: systemPrompt,
        prompt: prompt,
        temperature: this.ai.getTemperature(),
      });
      rawText = result.text;

      // ─── 健壮的 JSON 提取 ─────────────────────────────
      let jsonText = rawText.trim();

      // 1. 去除 markdown 代码块标记
      jsonText = jsonText.replace(/```json\s*/gi, "").replace(/```/gi, "").trim();

      // 2. 如果包含解释性文字，提取第一个 { 到最后一个 } 之间的内容
      const firstBrace = jsonText.indexOf("{");
      const lastBrace = jsonText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = jsonText.slice(firstBrace, lastBrace + 1);
      }

      // 3. 尝试解析
      const parsed = JSON.parse(jsonText) as ProfilePatch;
      return this.sanitizePatch(parsed);
    } catch (error) {
      console.error("[ProfileWorker] LLM 事实提取失败，原始输出:", rawText);
      console.error("[ProfileWorker] 解析错误:", error);
      // 失败时返回空 patch，避免破坏现有档案
      return {};
    }
  }

  /**
   * 清洗补丁，防止 LLM 返回异常数据破坏档案
   */
  private sanitizePatch(patch: ProfilePatch): ProfilePatch {
    const sanitized: ProfilePatch = {};

    if (patch.identity && typeof patch.identity === "string" && patch.identity.length < 200) {
      sanitized.identity = patch.identity;
    }

    if (patch.interests && Array.isArray(patch.interests)) {
      sanitized.interests = patch.interests
        .filter((i): i is string => typeof i === "string" && i.length > 0 && i.length < 50)
        .slice(0, 20); // 最多 20 个兴趣
    }

    if (patch.skills && Array.isArray(patch.skills)) {
      sanitized.skills = patch.skills
        .filter((s): s is string => typeof s === "string" && s.length > 0 && s.length < 50)
        .slice(0, 20);
    }

    if (patch.recent_mood && typeof patch.recent_mood === "string" && patch.recent_mood.length < 500) {
      sanitized.recent_mood = patch.recent_mood;
    }

    if (patch.plans && Array.isArray(patch.plans)) {
      sanitized.plans = patch.plans
        .filter(p => p && typeof p.plan === "string" && p.plan.length > 0)
        .slice(0, 10);
    }

    if (patch.facts && Array.isArray(patch.facts)) {
      sanitized.facts = patch.facts
        .filter(f => f && typeof f.type === "string" && typeof f.value === "string")
        .map(f => ({
          type: f.type.slice(0, 50),
          value: f.value.slice(0, 500),
          confidence: Math.min(1, Math.max(0, Number(f.confidence) || 0.5)),
        }))
        .slice(0, 20);
    }

    return sanitized;
  }

  /**
   * 批量标记消息处理状态
   * @param messageIds 消息 ID 列表
   * @param status 1=实时处理, 2=定时补偿
   */
  private markMessagesProcessed(messageIds: string[], status: number): void {
    if (messageIds.length === 0) return;
    // SQLite 单次参数上限约 999，分批处理
    const BATCH = 500;
    for (let i = 0; i < messageIds.length; i += BATCH) {
      const chunk = messageIds.slice(i, i + BATCH);
      const placeholders = chunk.map(() => "?").join(",");
      this.db
        .query(`UPDATE messages SET is_processed = ? WHERE message_id IN (${placeholders})`)
        .run(status, ...chunk);
    }
  }

  /**
   * 判断 patch 是否为空（即 LLM 没有提取到任何有效信息）
   */
  private isEmptyPatch(patch: ProfilePatch): boolean {
    if (!patch) return true;
    const hasContent =
      (patch.identity && patch.identity.trim().length > 0) ||
      (patch.interests && patch.interests.length > 0) ||
      (patch.skills && patch.skills.length > 0) ||
      (patch.recent_mood && patch.recent_mood.trim().length > 0) ||
      (patch.plans && patch.plans.length > 0) ||
      (patch.facts && patch.facts.length > 0);
    return !hasContent;
  }

  /**
   * 从 Patch 生成一句话摘要（用于 DailyDigest）
   */
  private generateSummaryFromPatch(patch: ProfilePatch): string {
    const parts: string[] = [];

    if (patch.identity) parts.push(`身份：${patch.identity}`);
    if (patch.interests && patch.interests.length > 0) parts.push(`兴趣：${patch.interests.join("、")}`);
    if (patch.skills && patch.skills.length > 0) parts.push(`技能：${patch.skills.join("、")}`);
    if (patch.recent_mood) parts.push(`状态：${patch.recent_mood}`);
    if (patch.plans && patch.plans.length > 0) {
      const planTexts = patch.plans.map(p => p.plan).join("；");
      parts.push(`计划：${planTexts}`);
    }
    if (patch.facts && patch.facts.length > 0) {
      const highConfFacts = patch.facts.filter(f => f.confidence >= 0.7);
      if (highConfFacts.length > 0) {
        parts.push(`关键事实：${highConfFacts.map(f => f.value).join("；")}`);
      }
    }

    return parts.join("；") || "当日无显著动态";
  }

  // ─── W4: 档案压缩 ───────────────────────────────────

  /**
   * 压缩指定用户的档案（当 compressed_log 过长时触发）
   * @param userId 用户 ID
   * @returns 是否执行了压缩
   */
  async compressProfile(userId: string): Promise<boolean> {
    const profile = await this.profileService.getUserProfile(userId);
    if (!profile) return false;

    const COMPRESS_THRESHOLD = 4000;
    if (profile.compressed_log.length < COMPRESS_THRESHOLD) {
      return false; // 未达到压缩阈值
    }

    console.log(`[ProfileWorker] 用户 ${userId} 档案长度 ${profile.compressed_log.length}，触发压缩`);

    const systemPrompt = `你是一名档案管理员。你的任务是压缩用户档案，规则如下：
1. 保留高置信度、长期有效的事实（如职业、核心兴趣）
2. 删除已过期的事件（如"昨天感冒""上周去了某地"）
3. 合并相似标签（如"JS"和"JavaScript"合并）
4. 将时间敏感信息压缩为一句摘要
5. 输出严格的 JSON 格式，不要有任何额外文本`;

    const prompt = `请压缩以下用户档案：

当前档案：
${JSON.stringify(profile, null, 2)}

要求输出格式（保持与原档案相同的字段结构）：
{
  "identity": "string",
  "interests": ["string"],
  "skills": ["string"],
  "recent_mood": "string",
  "plans": [{"plan": "string", "deadline": "string", "status": "string"}],
  "compressed_log": "string"
}`;

    try {
      const result = await generateText({
        model: this.ai.getModel(),
        system: systemPrompt,
        prompt: prompt,
        temperature: this.ai.getTemperature(),
      });

      // 清理并解析
      let jsonText = result.text.trim()
        .replace(/```json\s*/gi, "")
        .replace(/```/gi, "")
        .trim();
      const firstBrace = jsonText.indexOf("{");
      const lastBrace = jsonText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = jsonText.slice(firstBrace, lastBrace + 1);
      }

      const compressed = JSON.parse(jsonText);
      const patch: Partial<typeof profile> = {};

      if (compressed.identity !== undefined) patch.identity = compressed.identity;
      if (compressed.interests !== undefined) patch.interests = JSON.stringify(compressed.interests);
      if (compressed.skills !== undefined) patch.skills = JSON.stringify(compressed.skills);
      if (compressed.recent_mood !== undefined) patch.recent_mood = compressed.recent_mood;
      if (compressed.plans !== undefined) patch.plans = JSON.stringify(compressed.plans);
      if (compressed.compressed_log !== undefined) patch.compressed_log = compressed.compressed_log;

      await this.profileService.updateProfile(userId, patch);
      console.log(`[ProfileWorker] 用户 ${userId} 档案压缩完成`);
      return true;
    } catch (error) {
      console.error(`[ProfileWorker] 用户 ${userId} 档案压缩失败:`, error);
      return false;
    }
  }

  /**
   * 全量压缩巡检（每周日凌晨执行）
   */
  async compressAllProfiles(): Promise<{ compressed: number; total: number }> {
    const users = this.profileService.getAllProfiledUsers();
    let count = 0;
    for (const userId of users) {
      const ok = await this.compressProfile(userId);
      if (ok) count++;
    }
    console.log(`[ProfileWorker] 全量压缩完成：${count}/${users.length} 个用户被压缩`);
    return { compressed: count, total: users.length };
  }

  /**
   * 停止定时器（用于优雅关闭）
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
