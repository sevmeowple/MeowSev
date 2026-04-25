import { generateText, streamText, tool } from 'ai';
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createKimiCodePlanProvider, type CodePlanConfig } from './providers/CodePlanProvider';
import { z } from 'zod';
import type { CallSettings, GenerateTextResult, ImagePart, LanguageModel, ModelMessage, StreamTextResult, TextPart, UserContent } from 'ai';
import { MessageObject, SessionData } from '@/utils/message';
import { downloadImageAsBase64 } from '@/utils/imageUtils';
// AI 配置 Schema
export const AIConfigSchema = z.object({
    baseURL: z.url(),
    apiKey: z.string().min(1, "API Key 不能为空"),
    modelID: z.string().default("gpt-3.5-turbo"),
    viewmodelID: z.string().default("google/gemini-2.5-flash"),
    temperature: z.number().min(0).max(2).default(0.7),
    openai: z.object({
        apiKey: z.string().optional(),
        modelID: z.string().default("gpt-3.5-turbo"),
        baseURL: z.string().default("https://api.openai.com/v1"),
        temperature: z.number().min(0).max(2).optional(),
    }).optional(),
    codeplan: z.object({
        enabled: z.boolean().default(false),
        provider: z.enum(['kimi']).default('kimi'),
        apiKey: z.string(),
        baseURL: z.string().default('https://api.kimi.com/coding/v1'),
        modelID: z.string().default('kimi-for-coding'),
    }).optional()
});

export type AIConfig = z.infer<typeof AIConfigSchema>;
export { CodePlanConfig };

// export interface ChatMessage {
//     role: 'system' | 'user' | 'assistant';
//     content: string | UserContent;
// }

export type ChatMessage = ModelMessage;

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodSchema;
    execute: (params: any, session?: SessionData) => Promise<any> | any;
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
    private temperature: number;
    private context: ChatMessage[] = [];
    private tools: Record<string, ToolDefinition> = {};

    constructor(config: AIConfig) {
        this.temperature = config.temperature ?? 0.7;
        this.model = createOpenRouter({
            apiKey: config.apiKey,
        })(config.modelID || 'gpt-3.5-turbo');
        this.viewmodel = createOpenRouter({
            apiKey: config.apiKey,
        })(config.viewmodelID || 'google/gemini-2.5-flash');

        if (config.codeplan?.enabled) {
            // Code Plan 专用通道
            this.model = createKimiCodePlanProvider(config.codeplan);
            this.modelalt = this.model;
        } else if (config.openai) {
            this.modelalt = createOpenAICompatible({
                name: "kimi",
                apiKey: config.openai.apiKey,
                baseURL: config.openai.baseURL,
            })(config.openai.modelID || 'gpt-3.5-turbo');
            // openai 子配置的 temperature 优先级更高
            if (config.openai.temperature !== undefined) {
                this.temperature = config.openai.temperature;
            }
            this.model = this.modelalt;
        } else {
            this.modelalt = this.model;
            this.model = this.modelalt;
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
        enableTools: boolean = true,
        enableVision: boolean = false,
        replyOnImage: boolean = false,
        session?: SessionData
    ): Promise<MessageObject[]> {

        const executeWithFallback = async (options: any) => {
            try {
                // 首先尝试主模型
                return await generateText({ ...options, model: this.model });
            } catch (error) {
                console.warn('主模型连接失败，尝试备用模型:', error);
                // 失败时使用备用模型 - 保留所有参数包括tools
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
                temperature: this.temperature,
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
                            // 传递session给支持上下文的工具
                            const toolResult = await toolDef.execute(params, session);

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

                    if (imageResponses.length > 0 && !replyOnImage) {
                        console.log('🔕 检测到图片响应，跳过 AI 文本回复');
                        finalText = '';
                    } else {
                        let visionSuccess = false;

                        // [修改] 视觉处理逻辑：增加开关检查和错误捕获
                        if (enableVision && imageResponses.length > 0) {
                            console.log('🖼️ 检测到图片响应，使用视觉模型处理');

                            // 构建符合 AI SDK 类型的消息内容
                            const userContent: UserContent = [
                                {
                                    type: 'text' as const,
                                    text: message + (toolResponses.length > 0 ? `\n\n相关工具信息：\n${toolResponses.join('\n\n')}` : '')
                                } as TextPart,
                                ...imageResponses.map(img => ({
                                    type: 'image' as const,
                                    image: img.url
                                } as ImagePart))
                            ];

                            // 构建视觉模型的消息
                            const visionMessages: ChatMessage[] = [
                                ...this.context.slice(0, -1),
                                {
                                    role: 'user' as const,
                                    content: userContent
                                }
                            ];

                            try {
                                const visionResult = await generateText({
                                    model: this.viewmodel,
                                    messages: visionMessages,
                                    system: '你是一个智能助手，能够分析图片内容并与用户进行自然的对话。请根据用户的问题和提供的图片给出详细、有用的回答。',
                                    temperature: this.temperature,
                                });
                                finalText = visionResult.text;
                                console.log('🖼️ 视觉模型回复:', finalText);
                                visionSuccess = true;
                            } catch (error) {
                                console.warn('⚠️ 视觉模型调用失败，将自动退避到文本模式:', error);
                                visionSuccess = false;
                            }
                        }

                        // [新增] 退避逻辑：如果视觉未启用或失败，将图片转为文本描述处理
                        if (!visionSuccess) {
                            if (imageResponses.length > 0) {
                                console.log('🔄 使用文本模式处理图片响应');
                                imageResponses.forEach(img => {
                                    toolResponses.push(`[系统已生成图片] ${img.description}`);
                                });
                            }

                            if (toolResponses.length > 0) {
                                const toolDataContext = toolResponses.join('\n\n');

                                const finalResult = await (async () => {
                                    try {
                                        return await generateText({
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
                                            temperature: this.temperature,
                                        });
                                    } catch (error) {
                                        console.warn('文本模型失败，使用备用模型:', error);
                                        return await generateText({
                                            model: this.modelalt,
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
                                            temperature: this.temperature,
                                        });
                                    }
                                })();
                                finalText = finalResult.text;
                                console.log('📝 文本模型回复:', finalText);
                            }
                        }
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
                temperature: this.temperature,
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
                temperature: this.temperature,
                maxOutputTokens: 1000,
            });

            return result.text;
        } catch (error) {
            console.error('AI 简单对话失败:', error);
            throw new Error('AI 服务暂时不可用');
        }
    }

    // 简单对话（无上下文，无工具）
    async analyzeImage(
        imageUrl: string,
        prompt: string = "请描述这张图片",
        options?: {
            systemPrompt?: string;
            useMainModel?: boolean; // 是否使用主模型（kimi2.5 等支持视觉的模型）
        }
    ): Promise<string> {
        try {
            // 自动下载并转换为 base64
            const base64Image = await downloadImageAsBase64(imageUrl);
            if (!base64Image) {
                throw new Error('图片下载失败');
            }

            const userContent: UserContent = [
                {
                    type: 'text' as const,
                    text: prompt
                } as TextPart,
                {
                    type: 'image' as const,
                    image: base64Image // 使用 base64 data URL
                } as ImagePart
            ];

            const messages: ChatMessage[] = [
                {
                    role: 'user' as const,
                    content: userContent
                }
            ];

            // 根据 useMainModel 选择模型
            const selectedModel = options?.useMainModel ? this.model : this.viewmodel;
            const modelName = options?.useMainModel ? '主模型' : '视觉模型';

            console.log(`🖼️ 使用 ${modelName} 分析图片`);

            const result = await generateText({
                model: selectedModel,
                messages,
                system: options?.systemPrompt || '你是一个智能助手，能够分析图片内容并给出详细、有用的描述。',
                temperature: this.temperature,
            });

            return result.text;
        } catch (error) {
            console.error('视觉分析失败:', error);
            throw new Error('视觉服务暂时不可用');
        }
    }

    // 批量分析多张图片
    async analyzeImages(
        imageUrls: string[],
        prompt: string = "请描述这些图片",
        options?: {
            systemPrompt?: string;
            useMainModel?: boolean;
        }
    ): Promise<string> {
        if (imageUrls.length === 0) {
            throw new Error('没有提供图片');
        }

        try {
            // 并行下载所有图片
            console.log(`📥 开始下载 ${imageUrls.length} 张图片...`);
            const base64Images = await Promise.all(
                imageUrls.map(url => downloadImageAsBase64(url))
            );

            // 过滤掉下载失败的图片
            const validImages = base64Images.filter((img): img is string => img !== null);

            if (validImages.length === 0) {
                throw new Error('所有图片下载失败');
            }

            if (validImages.length < imageUrls.length) {
                console.warn(`⚠️ ${imageUrls.length - validImages.length} 张图片下载失败`);
            }

            // 构建包含多张图片的消息内容
            const imageParts: ImagePart[] = validImages.map(base64 => ({
                type: 'image' as const,
                image: base64
            }));

            const userContent: UserContent = [
                {
                    type: 'text' as const,
                    text: prompt
                } as TextPart,
                ...imageParts
            ];

            const messages: ChatMessage[] = [
                {
                    role: 'user' as const,
                    content: userContent
                }
            ];

            const selectedModel = options?.useMainModel ? this.model : this.viewmodel;
            const modelName = options?.useMainModel ? '主模型' : '视觉模型';

            console.log(`🖼️ 使用 ${modelName} 分析 ${validImages.length} 张图片`);

            const result = await generateText({
                model: selectedModel,
                messages,
                system: options?.systemPrompt || '你是一个智能助手，能够分析图片内容并给出详细、有用的描述。',
                temperature: this.temperature,
            });

            return result.text;
        } catch (error) {
            console.error('批量视觉分析失败:', error);
            throw new Error('视觉服务暂时不可用');
        }
    }


    // 生成纯文本响应（无上下文，无工具）
    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        try {
            const messages: ChatMessage[] = [];

            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });

            const executeWithFallback = async (options: any) => {
                try {
                    return await generateText({ ...options, model: this.model });
                } catch (error) {
                    console.warn('主模型连接失败，尝试备用模型:', error);
                    return await generateText({ ...options, model: this.modelalt });
                }
            };

            const result = await executeWithFallback({
                messages,
                temperature: this.temperature,
                maxOutputTokens: 2000,
            });

            return result.text;
        } catch (error) {
            console.error('AI 文本生成失败:', error);
            throw new Error('AI 服务暂时不可用');
        }
    }

    // 生成 JSON 响应（带重试和验证）
    async generateJsonResponse<T = any>(prompt: string, systemPrompt?: string, maxRetries: number = 3): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const text = await this.generateText(prompt, systemPrompt);

                // 尝试解析 JSON
                const parsed = JSON.parse(text);
                return parsed as T;

            } catch (error) {
                lastError = error as Error;
                console.warn(`JSON 解析失败 (尝试 ${attempt}/${maxRetries}):`, error);

                if (attempt < maxRetries) {
                    // 在重试时添加更明确的指令
                    prompt += '\n\n请确保返回有效的 JSON 格式，不要包含任何额外的文本或解释。';
                }
            }
        }

        console.error('所有 JSON 生成尝试都失败了:', lastError);
        throw new Error(`JSON 生成失败: ${lastError?.message}`);
    }

    // 结构化响应生成（带模式验证）
    async generateStructuredResponse<T>(
        prompt: string,
        schema: {
            description: string;
            properties: Record<string, any>;
            required?: string[];
        },
        systemPrompt?: string
    ): Promise<T> {
        const enhancedPrompt = `${prompt}

请严格按照以下 JSON 模式格式回复：

模式描述：${schema.description}

必需字段：${schema.required?.join(', ') || '无'}

JSON 格式示例：
${JSON.stringify(schema.properties, null, 2)}

请只返回符合模式的 JSON 数据，不要包含任何其他文本。`;

        const enhancedSystemPrompt = `${systemPrompt || ''}

你是一个严格的 JSON 响应生成器。你必须：
1. 只返回有效的 JSON 格式
2. 严格遵循提供的模式
3. 不添加任何额外的解释或文本
4. 确保所有必需字段都存在`;

        return this.generateJsonResponse<T>(enhancedPrompt, enhancedSystemPrompt);
    }

    // 评估式对话（适合判断、评分等场景）
    async evaluateWithContext(
        context: string,
        target: string,
        question: string,
        criteria: string[]
    ): Promise<any> {
        const prompt = `
上下文信息：
${context}

评估目标：
${target}

评估问题：
${question}

评估标准：
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

请基于上述信息进行客观评估，以 JSON 格式返回结果。`;

        return this.generateJsonResponse(prompt);
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

    // 获取模型实例（供 Agent 引擎使用）
    getModel(): LanguageModel {
        return this.model;
    }

    // 获取当前 temperature 配置
    getTemperature(): number {
        return this.temperature;
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

};