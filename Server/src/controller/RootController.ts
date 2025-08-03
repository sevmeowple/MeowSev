import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { AIService } from "../service/AIService";
import { ConfigUnion } from "../config/config";
import { MessageObject } from "../utils/message"; // 导入 MessageObject 类型

// 注册当前控制器的路由
RouteRegistry.registerBatch(['health', 'status', 'help', 'ai']);

const aiService = new AIService(ConfigUnion);

export const rootController = new Elysia()
    .get("/", ({ query }) => ({
        message: "Hello from API",
        timestamp: new Date().toISOString(),
        params: query
    }))
    .get("/health", () => {
        return { status: "healthy" };
    })
    .get("/status", () => {
        return {
            status: "running",
            routes: RouteRegistry.getAll()
        };
    })
    .post("/help", ({ body }): MessageObject => {
        // POST 接收，返回符合 MessageObject 格式
        return {
            type: "text",
            content: `喵喵使用说明：
• 喵喵 - 使用15条上下文的AI对话
• 喵喵 ai [消息] - 简单AI对话(无上下文)
• 喵喵 help - 显示此帮助信息
• 喵喵 health - 检查服务状态`
        };
    })
    .post("/health", ({ body }): MessageObject => {
        // 健康检查也改为 POST
        return {
            type: "text",
            content: "✅ 服务运行正常"
        };
    })
    .post("/", async ({ body }): Promise<MessageObject[]> => {
        // 根路由 - 使用15条上下文的AI对话
        if (body && typeof body === 'object' && 'session' in body) {
            try {
                const reply = await aiService.handleChatWithContext(body.session as any);
                // return {
                //     type: "text",
                //     content: reply
                // };
                return reply;
            } catch (error) {
                return [{
                    type: "text",
                    content: "❌ AI处理失败，请稍后重试"
                }];
            }
        }
        return [{
            type: "text",
            content: "❌ 请求格式错误"
        }];
    })
    .post("/ai", async ({ body }): Promise<MessageObject> => {
        console.log('AI endpoint 收到请求:', JSON.stringify(body, null, 2));

        if (body && typeof body === 'object' && 'params' in body) {
            const params = body.params as string[];
            const message = params.join(' ');

            console.log('提取的消息:', message);

            if (!message) {
                const errorResponse: MessageObject = {
                    type: "text",
                    content: "❌ 请提供消息内容，例如：喵喵 ai 你好"
                };
                console.log('返回错误响应:', errorResponse);
                return errorResponse;
            }

            try {
                const reply = await aiService.simpleChat(message);
                console.log('AI 回复:', reply);

                const successResponse: MessageObject = {
                    type: "text",
                    content: reply
                };
                console.log('返回成功响应:', successResponse);
                return successResponse;
            } catch (error) {
                console.error('AI 处理错误:', error);
                const errorResponse: MessageObject = {
                    type: "text",
                    content: "❌ AI处理失败，请稍后重试"
                };
                console.log('返回AI错误响应:', errorResponse);
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
    .get("/:endpoint", ({ params, query }) => {
        // 保留 GET 兜底路由
        if (RouteRegistry.exists(params.endpoint)) {
            return {
                endpoint: params.endpoint,
                query,
                type: "registered_route"
            };
        }

        const rootParams = { ...query };
        rootParams.params1 = params.endpoint;

        return {
            message: "Root endpoint with params",
            params: rootParams,
            timestamp: new Date().toISOString(),
            type: "root_with_params"
        };
    })
    // 添加 POST 兜底路由
    .post("/:endpoint", async ({ params, body }): Promise<MessageObject[]> => {
        console.log(`POST 兜底路由捕获: /${params.endpoint}`);

        // 如果是已注册的路由，说明可能是路由配置问题
        if (RouteRegistry.exists(params.endpoint)) {
            return [{
                type: "text",
                content: `❌ 路由 /${params.endpoint} 配置错误`
            }];
        }

        // 未知路由，直接当作根路由处理（15条上下文AI对话）
        console.log(`未知路由 /${params.endpoint}，转发到根路由处理`);

        if (body && typeof body === 'object' && 'session' in body) {
            try {
                const reply = await aiService.handleChatWithContext(body.session as any);
                return reply;
            } catch (error) {
                return [{
                    type: "text",
                    content: "❌ AI处理失败，请稍后重试"
                }];
            }
        }

        // 未知路由，直接当作根路由处理（15条上下文AI对话）
        console.log(`未知路由 /${params.endpoint}，转发到根路由处理`);

        if (body && typeof body === 'object' && 'session' in body) {
            try {
                const reply = await aiService.handleChatWithContext(body.session as any);
                // return {
                //     type: "text",
                //     content: reply
                // };
                return reply
            } catch (error) {
                return [{
                    type: "text",
                    content: "❌ AI处理失败，请稍后重试"
                }];
            }
        }

        return [{
            type: "text",
            content: "❌ 请求格式错误"
        }];
    })