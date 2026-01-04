import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { ReportRenderService } from "../service/Report/reportRender";
import { MessageObject, SessionData, extractGameSessionInfo } from "../utils/message";
import { HelpRegistry } from "../utils/HelpRegistry";

// 注册路由
RouteRegistry.registerBatch([
  'report2025'
]);

// 注册帮助信息
HelpRegistry.register({
  command: 'report2025',
  description: '生成2025年度群聊报告',
  usage: 'report2025',
  details: '博士，2025年的年度总结报告已经准备好了。请在群聊中使用此指令，我会为您生成一份详细的数据分析报告。'
});

const reportService = new ReportRenderService();

export const reportController = new Elysia()
  .post("/report2025", async ({ body }): Promise<MessageObject> => {
    console.log('Report 2025 endpoint 收到请求');

    const { session } = body as { session: SessionData };

    if (!session) {
      return {
        type: "text",
        content: "❌ 无法获取会话信息"
      };
    }

    // 使用 extractGameSessionInfo 提取信息
    const gameSession = extractGameSessionInfo(session);
    const { groupId, userId: memberId } = gameSession;

    // 检查是否在群聊中 (groupId 不为 unknown)
    if (!groupId || groupId === 'unknown') {
      return {
        type: "text",
        content: "❌ 无法获取群号，请在群聊中使用此功能"
      };
    }

    if (!memberId) {
      return {
        type: "text",
        content: "❌ 无法获取用户ID"
      };
    }

    console.log(`生成报告请求: Group=${groupId}, Member=${memberId}`);
    
    // 调用服务生成报告
    return await reportService.generateReport(groupId, memberId);
  });
