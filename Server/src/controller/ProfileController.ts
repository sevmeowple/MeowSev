import { Elysia } from "elysia";
import { profileService, profileWorker } from "@/service/Profile/instance";
import { profileScheduler } from "@/service/Profile/instance";
import type { MessageObject } from "@/utils/message";

/**
 * ProfileController — 档案管理命令路由
 *
 * 命令格式（由 Connection 层的 Koishi 插件解析后转发）：
 *   喵喵 profile update <qq>  — 手动重建指定用户档案
 *   喵喵 profile show <qq>    — 查看指定用户档案（调试用）
 *   喵喵 profile me           — 查看自己的档案
 *
 * Connection → POST /profile
 *   body: { session: {...}, params: ["update", "123456"] }
 */
export const profileController = new Elysia().post("/profile", async ({ body }): Promise<MessageObject> => {
  if (!body || typeof body !== "object" || !("params" in body)) {
    return { type: "text", content: "❌ 请求格式错误" };
  }

  const params = (body as any).params as string[];
  const session = (body as any).session as any;
  const subCommand = params[0];
  const targetId = params[1];

  // ─── profile update <qq> ─────────────────────────────
  if (subCommand === "update" && targetId) {
    if (!profileWorker) {
      return { type: "text", content: "❌ ProfileWorker 未初始化" };
    }
    try {
      await profileWorker.rebuildUserProfile(targetId);
      return { type: "text", content: `✅ 用户 ${targetId} 的档案已更新` };
    } catch (error) {
      return { type: "text", content: `❌ 更新失败: ${(error as Error).message}` };
    }
  }

  // ─── profile show <qq> ───────────────────────────────
  if (subCommand === "show" && targetId) {
    if (!profileService) {
      return { type: "text", content: "❌ ProfileService 未初始化" };
    }
    try {
      const identity = await profileService.getUserIdentity(targetId);
      if (!identity) {
        return { type: "text", content: `📭 用户 ${targetId} 暂无档案记录` };
      }
      const recent = await profileService.getUserRecentContext(targetId, 7);
      const report = [
        `【${identity.name} 的档案】`,
        `认识时长：${identity.knownSince}`,
        `标签：${identity.tags.join("、") || "暂无"}`,
        `近期动态：${recent}`,
      ].join("\n");
      return { type: "text", content: report };
    } catch (error) {
      return { type: "text", content: `❌ 查询失败: ${(error as Error).message}` };
    }
  }

  // ─── profile compact [date] ──────────────────────────
  if (subCommand === "compact") {
    if (!profileScheduler) {
      return { type: "text", content: "❌ ProfileScheduler 未初始化" };
    }
    try {
      const targetDate = targetId; // 可选参数：指定日期 YYYY-MM-DD
      const result = await profileScheduler.triggerNow(targetDate);
      return { type: "text", content: `✅ ${result}` };
    } catch (error) {
      return { type: "text", content: `❌ 补偿失败: ${(error as Error).message}` };
    }
  }

  // ─── profile me ──────────────────────────────────────
  if (subCommand === "me") {
    const userId = session?.user?.id;
    if (!userId) {
      return { type: "text", content: "❌ 无法获取你的用户 ID" };
    }
    if (!profileService) {
      return { type: "text", content: "❌ ProfileService 未初始化" };
    }
    try {
      const identity = await profileService.getUserIdentity(userId);
      if (!identity) {
        return {
          type: "text",
          content: `📭 你还没有档案记录，试试发送 "喵喵 profile update ${userId}"`,
        };
      }
      const recent = await profileService.getUserRecentContext(userId, 7);
      const report = [
        `【你的档案】`,
        `认识时长：${identity.knownSince}`,
        `标签：${identity.tags.join("、") || "暂无"}`,
        `近期动态：${recent}`,
      ].join("\n");
      return { type: "text", content: report };
    } catch (error) {
      return { type: "text", content: `❌ 查询失败: ${(error as Error).message}` };
    }
  }

  // ─── 帮助信息 ─────────────────────────────────────────
  return {
    type: "text",
    content: `📋 档案命令帮助：
喵喵 profile update <QQ号>    — 重建指定用户档案
喵喵 profile show <QQ号>      — 查看指定用户档案
喵喵 profile me               — 查看自己的档案
喵喵 profile compact [日期]   — 手动触发批量补偿 (日期格式 YYYY-MM-DD)`,
  };
});
