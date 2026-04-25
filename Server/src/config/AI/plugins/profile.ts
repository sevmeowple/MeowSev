import { z } from "zod";
import type { ToolDefinition } from "@/config/AI";
import { profileService } from "@/service/Profile/instance"; // 从 instance 导入，避免循环依赖

/**
 * getUserProfile Tool — 供 Agent 查询用户档案
 * 注意：Agent 不能直接修改档案，只能查询
 */
export const getUserProfileTool: ToolDefinition = {
  name: "getUserProfile",
  description:
    "获取指定用户的核心画像信息。当你需要了解某个群友的背景、兴趣、技能或最近动态时使用。",
  inputSchema: z.object({
    userId: z.string().describe("用户的 QQ 号或唯一标识"),
    detail: z
      .enum(["brief", "full"])
      .default("brief")
      .describe("brief=精简身份标签，full=完整画像含近期动态"),
  }),
  execute: async ({ userId, detail }) => {
    try {
      if (!profileService) {
        return {
          success: false as const,
          aiResponse: "档案服务尚未初始化",
          errorInfo: "ProfileService not initialized",
        };
      }

      const profile = await profileService.getUserProfile(userId);
      if (!profile) {
        return {
          success: true as const,
          responseType: "text" as const,
          aiResponse: `用户 ${userId} 暂无档案记录。`,
        };
      }

      if (detail === "brief") {
        const identity = await profileService.getUserIdentity(userId);
        return {
          success: true as const,
          responseType: "text" as const,
          aiResponse: identity
            ? `${identity.name}，认识 ${identity.knownSince}。标签：${identity.tags.join("、") || "暂无"}。`
            : `用户 ${userId} 档案信息不足。`,
        };
      }

      // full 模式：返回完整结构化信息
      const interests = safeJsonParse(profile.interests, []);
      const skills = safeJsonParse(profile.skills, []);
      const plans = safeJsonParse(profile.plans, []);
      const recentContext = await profileService.getUserRecentContext(userId, 7);

      const report = [
        `【${profile.user_name || `用户${profile.user_id}`} 的档案】`,
        `身份：${profile.identity || "未知"}`,
        `兴趣：${interests.join("、") || "暂无"}`,
        `技能：${skills.join("、") || "暂无"}`,
        `最近动态：${recentContext}`,
        plans.length > 0 ? `计划：${plans.map((p: any) => p.plan).join("；")}` : "",
        `累计记录消息：${profile.message_count} 条`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        success: true as const,
        responseType: "text" as const,
        aiResponse: report,
      };
    } catch (error) {
      return {
        success: false as const,
        aiResponse: `查询用户 ${userId} 档案失败`,
        errorInfo: (error as Error).message,
      };
    }
  },
};

/**
 * searchUserMemory Tool — 搜索用户历史提及的话题
 */
export const searchUserMemoryTool: ToolDefinition = {
  name: "searchUserMemory",
  description:
    "搜索指定用户的历史档案中是否提及过某个话题。用于回答「你之前不是说过...」这类问题。",
  inputSchema: z.object({
    userId: z.string().describe("用户的 QQ 号"),
    query: z.string().describe("要搜索的关键词或话题"),
  }),
  execute: async ({ userId, query }) => {
    try {
      if (!profileService) {
        return {
          success: false as const,
          aiResponse: "档案服务尚未初始化",
          errorInfo: "ProfileService not initialized",
        };
      }

      const matches = await profileService.searchUserMemory(userId, query);
      if (matches.length === 0) {
        return {
          success: true as const,
          responseType: "text" as const,
          aiResponse: `在 ${userId} 的档案中没有找到与"${query}"相关的记录。`,
        };
      }

      const report = matches.map(m => `• ${m.fact}`).join("\n");
      return {
        success: true as const,
        responseType: "text" as const,
        aiResponse: `找到 ${matches.length} 条相关记录：\n${report}`,
      };
    } catch (error) {
      return {
        success: false as const,
        aiResponse: `搜索用户 ${userId} 记忆失败`,
        errorInfo: (error as Error).message,
      };
    }
  },
};

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
