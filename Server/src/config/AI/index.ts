import { generateText, streamText, tool } from 'ai';
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import type { CallSettings, GenerateTextResult, ImagePart, LanguageModel, ModelMessage, StreamTextResult, TextPart, UserContent } from 'ai';
import { MessageObject } from '@/utils/message';
// AI 配置 Schema
export const AIConfigSchema = z.object({
    baseURL: z.url(),
    apiKey: z.string().min(1, "API Key 不能为空"),
    modelID: z.string().default("gpt-3.5-turbo"),
    viewmodelID: z.string().default("google/gemini-2.5-flash"),
    openai: z.object({
        apiKey: z.string().optional(),
        modelID: z.string().default("gpt-3.5-turbo"),
        baseURL: z.string().default("https://api.openai.com/v1")
    }).optional()
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

// export interface ChatMessage {
//     role: 'system' | 'user' | 'assistant';
//     content: string | UserContent;
// }

export type ChatMessage = ModelMessage;

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodSchema;
    execute: (params: any) => Promise<any> | any;
}

export type ToolResult = {
    success: true;
    responseType: 'text' | 'image';
    resUrl?: string;
    aiResponse: string;
    userMessages?: MessageObject[];
} | {
    success: false;
    aiResponse: string;
    errorInfo: string;
};

export class AIClientSDK {
    private model: LanguageModel;
    private modelalt: LanguageModel;
    private viewmodel: LanguageModel;
    private context: ChatMessage[] = [];
    private tools: Record<string, ToolDefinition> = {};

    constructor(config: AIConfig) {
        this.model = createOpenRouter({
            apiKey: config.apiKey,
        })(config.modelID || 'gpt-3.5-turbo');
        this.viewmodel = createOpenRouter({
            apiKey: config.apiKey,
        })(config.viewmodelID || 'google/gemini-2.5-flash');
        if (config.openai) {
            this.modelalt = createOpenAICompatible({
                name: "kimi",
                apiKey: config.openai.apiKey,
                baseURL: config.openai.baseURL,
            })(config.openai.modelID || 'gpt-3.5-turbo');
        } else {
            this.modelalt = this.model; // 如果没有配置 OpenAI，则使用默认模型
        }
    }

    debugTools(): void {
        console.log('🔧 已注册的工具:', Object.keys(this.tools));
        console.log('🔧 工具详情:', this.tools);
    }

    // 设置系统提示词
    setSystemPrompt(prompt: string): void {
        this.context = [{ role: 'system', content: prompt }];
    }

    // 添加上下文消息
    addContext(role: 'user' | 'assistant', content: string): void {
        this.context.push({ role, content });

        // 限制上下文长度，保留最近的对话
        if (this.context.length > 20) {
            const systemMessages = this.context.filter(msg => msg.role === 'system');
            const recentMessages = this.context.slice(-19);
            this.context = [...systemMessages, ...recentMessages];
        }
    }

    // 注册工具
    registerTool(toolDef: ToolDefinition): void {
        this.tools[toolDef.name] = toolDef;
    }

    // 批量注册工具
    registerTools(tools: ToolDefinition[]): void {
        tools.forEach(t => this.registerTool(t)); // 避免与 tool 函数名冲突
    }

    // 获取已注册的工具（转换为 AI SDK 格式）
    private getToolsForAI() {
        const toolsForAI: Record<string, any> = {}; // 改为 any 类型

        for (const [name, toolDef] of Object.entries(this.tools)) {
            toolsForAI[name] = tool({
                description: toolDef.description,
                inputSchema: toolDef.inputSchema,
                execute: toolDef.execute,
            });
        }

        return toolsForAI;
    }


    async chat(
        message: string,
        enableTools: boolean = true
    ): Promise<MessageObject[]> {

        const executeWithFallback = async (options: any) => {
            try {
                // 首先尝试主模型
                return await generateText({ ...options, model: this.model });
            } catch (error) {
                console.warn('主模型连接失败，尝试备用模型:', error);
                // 失败时使用备用模型
                return await generateText({ ...options, model: this.modelalt });
            }
        };
        try {
            this.addContext('user', message);
            const allUserMessages: MessageObject[] = [];
            let toolResponses: string[] = [];
            let imageResponses: { url: string; description: string }[] = [];

            const baseOptions = {
                model: this.model,
                messages: this.context,
                temperature: 0.7,
            };

            let result: any;
            let finalText: string = '';

            if (enableTools && Object.keys(this.tools).length > 0) {
                const wrappedTools: Record<string, any> = {};

                for (const [name, toolDef] of Object.entries(this.tools)) {
                    wrappedTools[name] = tool({
                        description: toolDef.description,
                        inputSchema: toolDef.inputSchema,
                        execute: async (params: any) => {
                            console.log(`🔧 执行工具: ${name}`, params);
                            const toolResult = await toolDef.execute(params);

                            if (toolResult.userMessages) {
                                allUserMessages.push(...toolResult.userMessages);
                            }

                            if (toolResult.success) {
                                if (toolResult.responseType === 'image' && toolResult.resUrl) {
                                    imageResponses.push({
                                        url: toolResult.resUrl,
                                        description: toolResult.aiResponse
                                    });
                                } else {
                                    toolResponses.push(toolResult.aiResponse);
                                }
                            }

                            if (!toolResult.success && toolResult.errorInfo) {
                                throw new Error(toolResult.errorInfo);
                            }

                            return toolResult.aiResponse;
                        }
                    });
                }

                result = await executeWithFallback({
                    ...baseOptions,
                    tools: wrappedTools,
                });

                if (toolResponses.length > 0 || imageResponses.length > 0) {
                    console.log('🔄 工具执行完成，基于工具数据生成最终回复');

                    if (imageResponses.length > 0) {
                        console.log('🖼️ 检测到图片响应，使用视觉模型处理');

                        // 构建符合 AI SDK 类型的消息内容
                        const userContent: UserContent = [
                            {
                                type: 'text' as const,
                                text: message
                            } as TextPart,
                            ...imageResponses.map(img => ({
                                type: 'image' as const,
                                image: img.url
                            } as ImagePart))
                        ];

                        // 构建视觉模型的消息 - 确保类型正确
                        const visionMessages: ChatMessage[] = [
                            ...this.context.slice(0, -1), // 除了最后一条用户消息的所有上下文
                            {
                                role: 'user' as const,
                                content: userContent
                            }
                        ];

                        // 使用视觉模型生成回复
                        const visionResult = await generateText({
                            model: this.viewmodel,
                            messages: visionMessages,
                            system: '你是一个智能助手，能够分析图片内容并与用户进行自然的对话。请根据用户的问题和提供的图片给出详细、有用的回答。',
                            temperature: 0.7,
                        });

                        finalText = visionResult.text;
                        console.log('🖼️ 视觉模型回复:', finalText);
                    }
                    else if (toolResponses.length > 0) {
                        const toolDataContext = toolResponses.join('\n\n');

                        const finalResult = await generateText({
                            model: this.model,
                            messages: [
                                ...this.context,
                                {
                                    role: 'assistant',
                                    content: `我已经获取到了相关信息：\n${toolDataContext}`
                                },
                                {
                                    role: 'user',
                                    content: '请基于上述信息给我一个自然、详细的分析，不要重复说要查询什么，直接分析数据内容即可。'
                                }
                            ],
                            temperature: 0.7,
                        });

                        finalText = finalResult.text;
                        console.log('📝 文本模型回复:', finalText);
                    }
                } else {
                    finalText = result.text;
                }
            } else {
                result = await executeWithFallback(baseOptions);
                finalText = result.text;
            }

            this.addContext('assistant', finalText);

            const finalMessages: MessageObject[] = [];

            if (finalText.trim()) {
                finalMessages.push({
                    type: 'text',
                    content: finalText
                });
            }

            finalMessages.push(...allUserMessages);

            return finalMessages;
        } catch (error) {
            console.error('AI 对话失败:', error);
            return [{
                type: 'text',
                content: `喵喵服务掉线了喵`
            }];
        }
    }


    // 流式对话
    async *chatStream(
        message: string,
        enableTools: boolean = false
    ): AsyncGenerator<string, void, unknown> {
        try {
            this.addContext('user', message);

            const baseOptions = {
                model: this.model,
                messages: this.context,
                temperature: 0.7,
                maxOutputTokens: 1000,
            };

            let streamResult: any; // 简化类型

            if (enableTools && Object.keys(this.tools).length > 0) {
                streamResult = streamText({
                    ...baseOptions,
                    tools: this.getToolsForAI(),
                });
            } else {
                streamResult = streamText(baseOptions);
            }

            // 收集完整响应用于添加到上下文
            let fullResponse = '';

            for await (const delta of streamResult.textStream) {
                fullResponse += delta;
                yield delta;
            }

            // 流结束后添加到上下文
            this.addContext('assistant', fullResponse);
        } catch (error) {
            console.error('AI 流式对话失败:', error);
            throw new Error('AI 服务暂时不可用');
        }
    }

    // 简单对话（无上下文，无工具）
    async simpleChat(message: string, systemPrompt?: string): Promise<string> {
        try {
            const messages: ChatMessage[] = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: message });

            const result = await generateText({
                model: this.model,
                messages,
                temperature: 0.7,
                maxOutputTokens: 1000,
            });

            return result.text;
        } catch (error) {
            console.error('AI 简单对话失败:', error);
            throw new Error('AI 服务暂时不可用');
        }
    }

    // 清空上下文
    clearContext(): void {
        const systemMessages = this.context.filter(msg => msg.role === 'system');
        this.context = systemMessages;
    }

    // 获取当前上下文
    getContext(): ChatMessage[] {
        return [...this.context];
    }

    // 获取已注册的工具列表
    getRegisteredTools(): string[] {
        return Object.keys(this.tools);
    }

    // 移除工具
    removeTool(name: string): void {
        delete this.tools[name];
    }

    // 清空所有工具
    clearTools(): void {
        this.tools = {};
    }
}

// 创建 AI SDK 客户端实例
export function createAISDKClient(config: AIConfig): AIClientSDK {
    return new AIClientSDK(config);
}

// 预定义的常用工具示例
export const CommonTools = {
    // 获取当前时间
    getCurrentTime: (): ToolDefinition => ({
        name: 'getCurrentTime',
        description: '获取当前时间和日期',
        inputSchema: z.object({}),
        execute: async () => {
            return {
                currentTime: new Date().toISOString(),
                localTime: new Date().toLocaleString('zh-CN'),
                timestamp: Date.now()
            };
        }
    }),

    // 计算器
    calculator: (): ToolDefinition => ({
        name: 'calculator',
        description: '执行基本数学计算',
        inputSchema: z.object({
            expression: z.string().describe('数学表达式，如 "2 + 3 * 4"')
        }),
        execute: async ({ expression }: { expression: string }) => {
            try {
                // 简单的表达式计算（生产环境建议使用更安全的库）
                const result = Function('"use strict"; return (' + expression + ')')();
                return { result, expression };
            } catch (error) {
                return { error: '无效的数学表达式', expression };
            }
        }
    }),

    // 网络搜索（示例，需要实际的搜索 API）
    webSearch: (): ToolDefinition => ({
        name: 'webSearch',
        description: '搜索网络信息',
        inputSchema: z.object({
            query: z.string().describe('搜索关键词'),
            limit: z.number().optional().describe('返回结果数量')
        }),
        execute: async ({ query, limit = 5 }: { query: string; limit?: number }) => {
            // 这里应该调用实际的搜索 API
            return {
                query,
                results: [
                    { title: '示例搜索结果', url: 'https://example.com', snippet: '这是一个示例结果' }
                ],
                message: '这是一个示例实现，请接入实际的搜索 API'
            };
        }
    })
};