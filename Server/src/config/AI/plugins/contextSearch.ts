import { z } from "zod";
import type { ToolDefinition } from "@/config/AI";
import { profileService } from "@/service/Profile/instance";

/**
 * searchRecentMessages Tool — 供 Agent 搜索群聊近期记录
 * 支持关键词搜索、时间范围、按频道过滤
 */
export const searchRecentMessagesTool: ToolDefinition = {
  name: "searchRecentMessages",
  description:
    "搜索频道内近期的消息记录。用于回答用户关于「之前聊了什么」「我昨天发的链接」等需要回溯上下文的问题。",
  inputSchema: z.object({
    keyword: z.string().optional().describe("搜索关键词，如为空则返回最近消息"),
    hours: z.number().default(24).describe("回溯小时数，默认24小时"),
  }),
  execute: async ({ keyword, hours }, session) => {
    try {
      if (!profileService) {
        return {
          success: false as const,
          aiResponse: "档案服务尚未初始化",
          errorInfo: "ProfileService not initialized",
        };
      }

      const channelId = session?.channel?.id;
      if (!channelId) {
        return {
          success: false as const,
          aiResponse: "无法获取频道 ID",
          errorInfo: "No channel ID",
        };
      }

      const messages = await profileService.searchMessagesByKeyword(channelId, keyword || "", hours);

      if (messages.length === 0) {
        return {
          success: true as const,
          responseType: "text" as const,
          aiResponse: keyword
            ? `在 ${hours} 小时内未找到包含「${keyword}」的消息。`
            : `在 ${hours} 小时内没有消息记录。`,
        };
      }

      // 格式化结果（限制返回条数，避免 token 爆炸）
      const formatted = messages
        .slice(0, 15)
        .map((m: any) => {
          const time = new Date(m.timestamp * 1000).toLocaleString("zh-CN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `[${time}] ${m.user_name}: ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`;
        })
        .join("\n");

      const header = keyword
        ? `在 ${hours} 小时内找到 ${messages.length} 条包含「${keyword}」的消息：\n`
        : `在 ${hours} 小时内的最近 ${messages.length} 条消息：\n`;

      return {
        success: true as const,
        responseType: "text" as const,
        aiResponse: header + formatted,
      };
    } catch (error) {
      return {
        success: false as const,
        aiResponse: "搜索消息记录失败",
        errorInfo: (error as Error).message,
      };
    }
  },
};
