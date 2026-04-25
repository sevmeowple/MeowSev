import { Elysia } from "elysia";
import { profileService } from "@/service/Profile/instance";
import type { MessageObject } from "@/utils/message";

/**
 * AdminProfileController — 管理员专用档案查询路由
 * 路径: POST /check-profile
 * 权限: 仅管理员 (requireAdmin)
 * 功能: 查看指定用户的完整原始档案（非精简版）
 */
export const adminProfileController = new Elysia().post(
  "/check-profile",
  async ({ body, user }): Promise<MessageObject> => {
    const params = (body as any).params as string[];
    const targetId = params[0];

    if (!targetId) {
      return { type: "text", content: "❌ 用法：喵喵 check-profile <QQ号>" };
    }

    if (!profileService) {
      return { type: "text", content: "❌ ProfileService 未初始化" };
    }

    try {
      const profile = await profileService.getUserProfile(targetId);
      if (!profile) {
        return { type: "text", content: `📭 用户 ${targetId} 暂无档案记录` };
      }

      const report = formatRawProfile(profile, targetId);
      return { type: "text", content: report };
    } catch (error) {
      return { type: "text", content: `❌ 查询失败: ${(error as Error).message}` };
    }
  },
  {
    requireAdmin: true,
  }
);

function formatRawProfile(p: any, userId: string): string {
  const interests = safeJsonParse(p.interests, []);
  const skills = safeJsonParse(p.skills, []);
  const plans = safeJsonParse(p.plans, []);
  const social = safeJsonParse(p.social_links, {});

  const lines = [
    `【用户 ${userId} 完整档案】`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `昵称：${p.user_name || "未知"}`,
    `身份：${p.identity || "未提取"}`,
    `兴趣：${interests.join("、") || "暂无"}`,
    `技能：${skills.join("、") || "暂无"}`,
    `最近状态：${p.recent_mood || "暂无"}`,
    `进行中的计划：${plans.length > 0 ? plans.map((x: any) => x.plan).join("；") : "暂无"}`,
    `社交关系：${Object.keys(social).length > 0 ? JSON.stringify(social) : "暂无"}`,
    `累计消息：${p.message_count} 条`,
    `首次出现：${new Date(p.first_seen * 1000).toLocaleString("zh-CN")}`,
    `最后更新：${new Date(p.updated_at * 1000).toLocaleString("zh-CN")}`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `原始日志（前 500 字）：`,
    p.compressed_log?.slice(0, 500) || "（空）",
    p.compressed_log?.length > 500 ? "…（已截断）" : "",
  ];

  return lines.filter(Boolean).join("\n");
}

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
