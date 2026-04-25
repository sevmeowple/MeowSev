import type { Database } from "bun:sqlite";
import type { ProfileWorker } from "./ProfileWorker";
import { sendToUser } from "@/utils/message";

/**
 * ProfileScheduler — 档案定时维护调度器
 * 职责：每天凌晨触发批量补偿，处理实时队列遗漏的消息
 */
export class ProfileScheduler {
  private worker: ProfileWorker;
  private db: Database;
  private timer: Timer | null = null;
  private isRunning: boolean = false;
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // 每分钟检查一次
  private readonly COMPACT_CONCURRENCY = 5; // 并发处理用户数

  constructor(worker: ProfileWorker, db: Database) {
    this.worker = worker;
    this.db = db;
    this.start();
  }

  start(): void {
    if (this.timer) return;

    console.log("[ProfileScheduler] 定时调度器已启动，每日 03:00 执行批量补偿");

    // 每分钟检查一次，当时间到达 03:00 时触发日报补偿，周日 04:00 触发压缩巡检
    this.timer = setInterval(() => {
      const now = new Date();

      const adminId = "1259598502";

      // 每日 03:00：批量补偿
      if (now.getHours() === 3 && now.getMinutes() === 0) {
        if (this.isRunning) {
          console.log("[ProfileScheduler] 上次任务仍在执行，跳过本次");
          return;
        }
        this.isRunning = true;
        const date = this.getYesterdayDate();
        this.runDailyCompaction(date)
          .then(() => {
            sendToUser(adminId, `✅ ${date} 定时批量补偿已完成`).catch(() => {});
          })
          .catch(e => {
            console.error("[ProfileScheduler] 定时任务失败:", e);
            sendToUser(adminId, `❌ ${date} 定时批量补偿失败`).catch(() => {});
          })
          .finally(() => {
            this.isRunning = false;
          });
      }

      // 每周日 04:00：全量压缩巡检
      if (now.getDay() === 0 && now.getHours() === 4 && now.getMinutes() === 0) {
        console.log("[ProfileScheduler] 触发每周全量压缩巡检");
        this.worker.compressAllProfiles()
          .then(() => {
            sendToUser(adminId, `✅ 每周档案压缩巡检已完成`).catch(() => {});
          })
          .catch(e => {
            console.error("[ProfileScheduler] 压缩巡检失败:", e);
            sendToUser(adminId, `❌ 每周档案压缩巡检失败`).catch(() => {});
          });
      }
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[ProfileScheduler] 定时调度器已停止");
    }
  }

  /**
   * 手动触发一次批量补偿（后台异步执行，立即返回）
   */
  async triggerNow(date?: string): Promise<string> {
    const targetDate = date || this.getYesterdayDate();

    // 快速统计未处理消息数
    const startOfDay = new Date(targetDate + "T00:00:00+08:00").getTime();
    const endOfDay = new Date(targetDate + "T23:59:59+08:00").getTime();

    const stats = this.db.query(
      `SELECT COUNT(*) as msg_count, COUNT(DISTINCT user_id) as user_count 
       FROM messages WHERE timestamp >= ? AND timestamp <= ? AND is_processed = 0`
    ).get(startOfDay, endOfDay) as { msg_count: number; user_count: number };

    if (stats.msg_count === 0) {
      return `${targetDate} 没有需要补偿的消息`;
    }

    // 后台启动（不阻塞 HTTP 响应）
    const adminId = "1259598502";
    this.runDailyCompaction(targetDate)
      .then(() => {
        sendToUser(adminId, `✅ ${targetDate} 批量补偿已完成`).catch(() => {});
      })
      .catch(e => {
        console.error("[ProfileScheduler] 后台任务失败:", e);
        sendToUser(adminId, `❌ ${targetDate} 批量补偿失败`).catch(() => {});
      });

    // 立即通知 admin 任务已启动
    sendToUser(adminId, `⏳ 开始后台处理 ${targetDate}：${stats.msg_count} 条消息 / ${stats.user_count} 个用户`).catch(() => {});

    const estimatedMin = Math.ceil(stats.user_count / this.COMPACT_CONCURRENCY * 4 / 60);
    return `开始后台处理 ${targetDate}：${stats.msg_count} 条消息 / ${stats.user_count} 个用户，预计约 ${estimatedMin} 分钟完成`;
  }

  // ─── 核心定时逻辑 ───────────────────────────────────

  private async runDailyCompaction(targetDate?: string): Promise<void> {
    const date = targetDate || this.getYesterdayDate();
    // 注意：messages 表的 timestamp 是毫秒级
    const startOfDay = new Date(date + "T00:00:00+08:00").getTime();
    const endOfDay = new Date(date + "T23:59:59+08:00").getTime();

    console.log(`[ProfileScheduler] 开始执行 ${date} 的批量补偿 (${startOfDay} ~ ${endOfDay})`);

    // 1. 查询当日未处理的消息（is_processed = 0）
    const messages = this.db
      .query(
        `SELECT * FROM messages 
         WHERE timestamp >= ? AND timestamp <= ? AND is_processed = 0
         ORDER BY timestamp ASC`
      )
      .all(startOfDay, endOfDay) as Array<{
        user_id: string;
        user_name: string;
        content: string;
        timestamp: number;
        message_type: string;
        message_id: string;
      }>;

    if (messages.length === 0) {
      console.log(`[ProfileScheduler] ${date} 无待处理消息，跳过`);
      return;
    }

    console.log(`[ProfileScheduler] ${date} 共 ${messages.length} 条未处理消息待补偿`);

    // 2. 按用户分组
    const userMessages = new Map<string, typeof messages>();
    for (const msg of messages) {
      if (!userMessages.has(msg.user_id)) {
        userMessages.set(msg.user_id, []);
      }
      userMessages.get(msg.user_id)!.push(msg);
    }

    // 3. 并发处理（限制并发数避免 API 限流）
    const tasks: Array<() => Promise<void>> = [];
    for (const [userId, msgs] of userMessages) {
      tasks.push(async () => {
        try {
          await this.worker.processDailyBatch(userId, date, msgs);
        } catch (error) {
          console.error(`[ProfileScheduler] 用户 ${userId} 批量处理失败:`, error);
        }
      });
    }

    await this.runWithLimit(tasks, this.COMPACT_CONCURRENCY);

    console.log(`[ProfileScheduler] ${date} 批量补偿完成，处理了 ${userMessages.size} 个用户`);
  }

  /**
   * 限制并发数的任务执行器
   */
  private async runWithLimit<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;

    async function worker() {
      while (index < tasks.length) {
        const i = index++;
        try {
          results[i] = await tasks[i]();
        } catch (e) {
          results[i] = e as T;
        }
      }
    }

    const workers = Array(Math.min(limit, tasks.length))
      .fill(null)
      .map(() => worker());
    await Promise.all(workers);
    return results;
  }

  private getYesterdayDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
}
