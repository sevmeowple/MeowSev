import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { PrtsService } from "../service/Arknights/prts";
import { MessageObject } from "../utils/message";

// 注册 arknights 相关路由
RouteRegistry.registerBatch([
  'wiki'
]);

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
