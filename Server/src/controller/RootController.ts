import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { AIService } from "../service/AIService";
import { ConfigUnion } from "../config/config";
import { MessageObject } from "../utils/message"; // 导入 MessageObject 类型

import { HelpRegistry } from "@/utils/HelpRegistry";

// 注册当前控制器的路由
RouteRegistry.registerBatch(["health", "status", "help", "ai"]);

// 注册基础帮助信息
HelpRegistry.register({
  command: "help",
  description: "显示终端帮助信息",
  usage: "help [命令名称]",
  examples: ["help", "help meme"],
  details: "博士，我是阿米娅。如果您对终端的操作有任何疑问，请随时查阅此帮助文档。输入 help 加上具体的命令名称，我可以为您提供更详细的说明。"
});

HelpRegistry.register({
  command: "health",
  description: "检查 PRTS 系统状态",
  usage: "health",
  details: "博士，使用此指令可以检查 PRTS 系统的运行状况和各模块的连接状态。请定期确认系统健康。"
});

HelpRegistry.register({
  command: "ai",
  description: "与 PRTS 智能助手对话",
  usage: "ai [内容]",
  examples: ["ai 你好", "ai 帮我写一份报告"],
  details: "博士，如果您需要协助处理事务，或者只是想聊聊天，请随时呼叫我。我会尽力为您分忧的。"
});

const aiService = new AIService(ConfigUnion);

export const rootController = new Elysia()
  .get("/", ({ query }) => ({
    message: "Hello from API",
    timestamp: new Date().toISOString(),
    params: query,
  }))
  .get("/health", () => {
    return { status: "healthy" };
  })
  .get("/status", () => {
    return {
      status: "running",
      routes: RouteRegistry.getAll(),
    };
  })
  .post("/help", async ({ body }): Promise<MessageObject> => {
    // 检查是否有参数
    if (body && typeof body === "object" && "params" in body) {
      const params = (body as any).params as string[];
      if (params && params.length > 0) {
        // 如果有参数，显示特定命令的帮助
        const command = params[0];
        try {
          const imagePath = await HelpRegistry.getHelpImage(command);
          return {
            type: "image",
            path: imagePath,
          };
        } catch (error) {
          console.error("生成帮助图片失败:", error);
          return {
            type: "text",
            content: HelpRegistry.generateDetail(command),
          };
        }
      }
    }

    // 无参数，显示主菜单
    try {
      const imagePath = await HelpRegistry.getHelpImage();
      return {
        type: "image",
        path: imagePath,
      };
    } catch (error) {
      console.error("生成帮助菜单图片失败:", error);
      return {
        type: "text",
        content: HelpRegistry.generateMenu(),
      };
    }
  })
//   .post("/help", ({ body }): MessageObject => {
//     // POST 接收，返回符合 MessageObject 格式
//     return {
//       type: "text",
//       content: `喵喵使用说明：
// • 喵喵 - 使用15条上下文的AI对话
// • 喵喵 ai [消息] - 简单AI对话(无上下文)
// • 喵喵 help - 显示此帮助信息
// • 喵喵 health - 检查服务状态`,
//     };
//   })
  .post("/health", ({ body }): MessageObject => {
    // 健康检查也改为 POST
    return {
      type: "text",
      content: "✅ 服务运行正常",
    };
  })
  .post("/", async ({ body }): Promise<MessageObject[]> => {
    // 合并/和/vision路由，通过是否引用图片区分
    if (body && typeof body === "object" && "session" in body) {
      const session = body.session as any;
      // 没有图片内容，使用普通AI对话
      try {
        const reply = await aiService.handleChatWithContext(session);
        return reply;
      } catch (error) {
        return [
          {
            type: "text",
            content: "❌ AI处理失败，请稍后重试",
          },
        ];
      }
    }
    return [
      {
        type: "text",
        content: "❌ 请求格式错误",
      },
    ];
  })
  .post("/ai", async ({ body }): Promise<MessageObject> => {
    console.log("AI endpoint 收到请求:", JSON.stringify(body, null, 2));

    if (body && typeof body === "object" && "params" in body) {
      const params = body.params as string[];
      const message = params.join(" ");

      console.log("提取的消息:", message);

      if (!message) {
        const errorResponse: MessageObject = {
          type: "text",
          content: "❌ 请提供消息内容，例如：喵喵 ai 你好",
        };
        console.log("返回错误响应:", errorResponse);
        return errorResponse;
      }

      try {
        const reply = await aiService.simpleChat(message);
        console.log("AI 回复:", reply);

        const successResponse: MessageObject = {
          type: "text",
          content: reply,
        };
        console.log("返回成功响应:", successResponse);
        return successResponse;
      } catch (error) {
        console.error("AI 处理错误:", error);
        const errorResponse: MessageObject = {
          type: "text",
          content: "❌ AI处理失败，请稍后重试",
        };
        console.log("返回AI错误响应:", errorResponse);
        return errorResponse;
      }
    }

    const formatErrorResponse: MessageObject = {
      type: "text",
      content: "❌ 请求格式错误",
    };
    console.log("返回格式错误响应:", formatErrorResponse);
    return formatErrorResponse;
  })
  .get("/:endpoint", ({ params, query }) => {
    // 保留 GET 兜底路由
    if (RouteRegistry.exists(params.endpoint)) {
      return {
        endpoint: params.endpoint,
        query,
        type: "registered_route",
      };
    }

    const rootParams = { ...query };
    rootParams.params1 = params.endpoint;

    return {
      message: "Root endpoint with params",
      params: rootParams,
      timestamp: new Date().toISOString(),
      type: "root_with_params",
    };
  })
  // 添加 POST 兜底路由
  .post("/:endpoint", async ({ params, body }): Promise<MessageObject[]> => {
    console.log(`POST 兜底路由捕获: /${params.endpoint}`);

    // 如果是已注册的路由，说明可能是路由配置问题
    if (RouteRegistry.exists(params.endpoint)) {
      return [
        {
          type: "text",
          content: `❌ 路由 /${params.endpoint} 配置错误`,
        },
      ];
    }

    // 未知路由，直接当作根路由处理（15条上下文AI对话）
    console.log(`未知路由 /${params.endpoint}，转发到根路由处理`);

    if (body && typeof body === "object" && "session" in body) {
      try {
        const reply = await aiService.handleChatWithContext(
          body.session as any
        );
        return reply;
      } catch (error) {
        return [
          {
            type: "text",
            content: "❌ AI处理失败，请稍后重试",
          },
        ];
      }
    }

    // 未知路由，直接当作根路由处理（15条上下文AI对话）
    console.log(`未知路由 /${params.endpoint}，转发到根路由处理`);

    if (body && typeof body === "object" && "session" in body) {
      try {
        const reply = await aiService.handleChatWithContext(
          body.session as any
        );
        // return {
        //     type: "text",
        //     content: reply
        // };
        return reply;
      } catch (error) {
        return [
          {
            type: "text",
            content: "❌ AI处理失败，请稍后重试",
          },
        ];
      }
    }

    return [
      {
        type: "text",
        content: "❌ 请求格式错误",
      },
    ];
  });
