import { generateText, streamText, tool } from 'ai';
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { z } from 'zod';
import type { CallSettings, GenerateTextResult, LanguageModel, StreamTextResult } from 'ai';
import { MessageObject } from '@/utils/message';
// AI 配置 Schema
export const AIConfigSchema = z.object({
    baseURL: z.url(),
    apiKey: z.string().min(1, "API Key 不能为空"),
    modelID: z.string().default("gpt-3.5-turbo")
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodSchema;
    execute: (params: any) => Promise<any> | any;
}

export type ToolResult = {
    success: true;
    aiResponse: string;
    userMessages?: MessageObject[];
} | {
    success: false;
    aiResponse: string;
    errorInfo: string;
};

export class AIClientSDK {
    private model: LanguageModel;
    private context: ChatMessage[] = [];
    private tools: Record<string, ToolDefinition> = {};

    constructor(config: AIConfig) {
        this.model = createOpenRouter({
            apiKey: config.apiKey,
        })(config.modelID || 'gpt-3.5-turbo');
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
        try {
            this.addContext('user', message);
            const allUserMessages: MessageObject[] = [];
            let toolResponses: string[] = []; // 收集工具返回的 aiResponse

            const baseOptions = {
                model: this.model,
                messages: this.context,
                temperature: 0.7,
            };

            let result: any;
            let finalText: string = ''; // 用于存储最终的文本回复

            if (enableTools && Object.keys(this.tools).length > 0) {
                // 包装工具执行函数
                const wrappedTools: Record<string, any> = {};

                for (const [name, toolDef] of Object.entries(this.tools)) {
                    wrappedTools[name] = tool({
                        description: toolDef.description,
                        inputSchema: toolDef.inputSchema,
                        execute: async (params: any) => {
                            console.log(`🔧 执行工具: ${name}`, params);
                            const toolResult = await toolDef.execute(params);

                            // 收集用户消息（图片、卡片等）
                            if (toolResult.userMessages) {
                                allUserMessages.push(...toolResult.userMessages);
                            }

                            // 收集工具的 AI 响应，用于第二次生成
                            if (toolResult.success && toolResult.aiResponse) {
                                toolResponses.push(toolResult.aiResponse);
                            }

                            // 处理错误
                            if (!toolResult.success && toolResult.errorInfo) {
                                throw new Error(toolResult.errorInfo);
                            }

                            // 返回给 AI SDK 的数据（用于工具调用的内部处理）
                            return toolResult.aiResponse;
                        }
                    });
                }

                // 第一次调用：让 AI 识别并执行工具
                result = await generateText({
                    ...baseOptions,
                    tools: wrappedTools,
                });

                // 如果有工具被调用，使用工具返回的数据进行第二次生成
                if (toolResponses.length > 0) {
                    console.log('🔄 工具执行完成，基于工具数据生成最终回复');
                    console.debug('🔄 工具响应数量:', toolResponses.length);
                    console.debug('🔄 工具响应内容:', JSON.stringify(toolResponses, null, 2));
                    console.debug('🔄 第一次 AI 回复:', result.text);

                    // 将工具返回的数据添加到上下文
                    const toolDataContext = toolResponses.join('\n\n');

                    // 第二次调用：基于工具数据生成自然的回复
                    const finalResult = await generateText({
                        model: this.model,
                        messages: [
                            // { role: 'system', content: '你是一个智能助手，善于根据获取的数据为用户提供有用的分析和建议。' },
                            // { role: 'user', content: message }, // 原始用户消息
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

                    // 使用第二次生成的结果作为最终文本
                    finalText = finalResult.text;
                    console.debug('🔄 第二次 AI 回复:', finalResult.text);
                    console.debug('🔄 最终使用的回复:', finalText);
                } else {
                    // 没有工具调用，使用原始回复
                    finalText = result.text;
                }
            } else {
                result = await generateText(baseOptions);
                finalText = result.text;
            }

            // 添加最终文本到上下文
            this.addContext('assistant', finalText);

            // 组合最终消息：AI 的最终回复 + 工具生成的消息
            const finalMessages: MessageObject[] = [];

            // 添加 AI 的最终回复（基于工具数据生成的自然回复）
            if (finalText.trim()) {
                finalMessages.push({
                    type: 'text',
                    content: finalText
                });
            }

            // 添加工具生成的消息（图片、卡片等）
            finalMessages.push(...allUserMessages);

            return finalMessages;
        } catch (error) {
            console.error('AI 对话失败:', error);
            return [{
                type: 'text',
                content: `❌ AI 服务暂时不可用: ${error instanceof Error ? error.message : '未知错误'}`
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