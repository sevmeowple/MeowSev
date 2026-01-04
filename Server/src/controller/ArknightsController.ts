import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { PrtsService } from "../service/Arknights/prts";
import { MessageObject } from "../utils/message";
import { HelpRegistry } from "../utils/HelpRegistry";

// 注册 arknights 相关路由
RouteRegistry.registerBatch([
  'wiki'
]);

// 注册帮助信息
HelpRegistry.register({
  command: 'wiki',
  description: '查询罗德岛干员档案',
  usage: 'wiki [干员名称]',
  examples: ['wiki 艾雅法拉', 'wiki 凯尔希'],
  details: '博士，如果您需要查阅干员的详细资料，请告诉我名字，我会为您调取 PRTS 数据库中的档案。'
});

const prtsService = new PrtsService();

export const arknightsController = new Elysia()
  .post("/wiki", async ({ body }): Promise<MessageObject> => {
    console.log('Wiki endpoint 收到请求:', JSON.stringify(body, null, 2));

    if (body && typeof body === 'object' && 'params' in body) {
      const params = body.params as string[];
      
      if (params.length === 0) {
        return {
          type: "text",
          content: "❌ 请提供查询关键词，例如：wiki 艾雅法拉"
        };
      }

      const queryKey = params[0];
      console.log(`🔍 开始查询 PRTS Wiki: ${queryKey}`);
      
      return await prtsService.getWikiScreenshot(queryKey);
    }

    return {
      type: "text",
      content: "❌ 请求格式错误，需要 params 字段"
    };
  });
