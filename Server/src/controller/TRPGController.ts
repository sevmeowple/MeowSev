import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { TRPGService } from "../service/TRPGService";
import { MessageObject } from "../utils/message";

// 注册当前控制器的路由
RouteRegistry.registerBatch(['roll', 'dice', 'trpg-help']);

const trpgService = new TRPGService();

export const trpgController = new Elysia()
  .post("/roll", ({ body }): MessageObject => {
    console.log('Roll endpoint 收到请求:', JSON.stringify(body, null, 2));

    if (body && typeof body === 'object' && 'params' in body) {
      const params = body.params as string[];
      const expression = params.join(''); // 拼接骰子表达式，如 "1d20" 或 "2d6+3"

      console.log('骰子表达式:', expression);

      if (!expression) {
        const errorResponse: MessageObject = {
          type: "text",
          content: "❌ 请提供骰子表达式，例如：喵喵 roll 1d20"
        };
        console.log('返回错误响应:', errorResponse);
        return errorResponse;
      }

      try {
        const result = trpgService.rollDice(expression);
        console.log('投骰结果:', result);
        return result;
      } catch (error) {
        console.error('投骰错误:', error);
        const errorResponse: MessageObject = {
          type: "text",
          content: "❌ 投骰失败，请检查表达式格式"
        };
        console.log('返回投骰错误响应:', errorResponse);
        return errorResponse;
      }
    }

    const formatErrorResponse: MessageObject = {
      type: "text",
      content: "❌ 请求格式错误"
    };
    console.log('返回格式错误响应:', formatErrorResponse);
    return formatErrorResponse;
  })
  
  .post("/dice", ({ body }): MessageObject => {
    // dice 是 roll 的别名
    console.log('Dice endpoint 收到请求，转发到 roll');
    return trpgController.fetch(new Request('http://localhost/roll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })) as any;
  })
  
  .post("/trpg-help", ({ body }): MessageObject => {
    console.log('TRPG Help endpoint 收到请求');
    return trpgService.getHelp();
  });