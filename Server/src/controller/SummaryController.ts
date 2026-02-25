import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { HelpRegistry } from "../utils/HelpRegistry";
// import { authPlugin } from "../middleware/auth";
import { MessageObject, SessionData, extractGameSessionInfo } from "../utils/message";
import { SummaryService } from "../service/SummaryService";
import { ConfigUnion } from "../config/config";

RouteRegistry.registerBatch(['summary']);

HelpRegistry.register({
  command: 'summary',
  description: '生成群聊总结报告（仅限超级管理员）',
  usage: 'summary [消息数量]',
  examples: ['summary', 'summary 50', 'summary 200'],
  details: '总结当前群聊的最近消息，默认20条，最大1000条。包含话题分析、活跃用户、精彩片段等。'
});

const summaryService = new SummaryService(ConfigUnion);

export const summaryController = new Elysia()
  // .use(authPlugin)
  .post("/summary", async ({ body }): Promise<MessageObject> => {
    const { session, params } = body as { session: SessionData; params?: string[] };

    if (!session) {
      return { type: "text", content: "❌ 无法获取会话信息" };
    }

    const { groupId } = extractGameSessionInfo(session);
    if (!groupId || groupId === 'unknown') {
      return { type: "text", content: "❌ 请在群聊中使用此功能" };
    }

    let count = 20;
    if (params && params.length > 0) {
      const parsed = parseInt(params[0]);
      if (!isNaN(parsed)) {
        count = Math.max(1, Math.min(1000, parsed));
      }
    }

    try {
      return await summaryService.generateSummary(session.channel.id, count);
    } catch (error) {
      console.error("群聊总结生成失败:", error);
      return { type: "text", content: "❌ 总结生成失败，请稍后重试" };
    }
  }/* , { requireSuperAdmin: true } */);
