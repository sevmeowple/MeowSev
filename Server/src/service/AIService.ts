import { ConfigUnionType } from "@/config/config";
import { QueryService } from "./QueryService";
import { MessageObject } from "@/utils/message";

export class AIService {
    private ai;
    private queryService: QueryService;

    constructor(ConfigUnion: ConfigUnionType) {
        this.ai = ConfigUnion.ai;
        this.queryService = new QueryService(ConfigUnion);
    }

    // 封装纯文本生成
    async generateText(prompt: string, systemPrompt?: string): Promise<string> {
        try {
            return await this.ai.generateText(prompt, systemPrompt);
        } catch (error) {
            console.error('AI 文本生成失败:', error);
            throw error;
        }
    }

    // 封装 JSON 响应生成
    async generateJsonResponse<T = any>(prompt: string, systemPrompt?: string): Promise<T> {
        try {
            return await this.ai.generateJsonResponse<T>(prompt, systemPrompt);
        } catch (error) {
            console.error('AI JSON 生成失败:', error);
            throw error;
        }
    }

    // 封装结构化响应
    async generateStructuredResponse<T>(
        prompt: string,
        schema: {
            description: string;
            properties: Record<string, any>;
            required?: string[];
        },
        systemPrompt?: string
    ): Promise<T> {
        try {
            return await this.ai.generateStructuredResponse<T>(prompt, schema, systemPrompt);
        } catch (error) {
            console.error('AI 结构化响应生成失败:', error);
            throw error;
        }
    }
    // 处理带上下文的 AI 对话
    async handleChatWithContext(sessionData: any, params: string[] = []): Promise<MessageObject[]> {
        try {
            // 从 session 中提取用户和频道信息
            const userId = sessionData.user?.id;
            const channelId = sessionData.channel?.id;
            const userMessage = sessionData.message?.content || sessionData.content;

            if (!userId || !channelId || !userMessage) {
                return [{ type: 'text', content: "无法获取必要的会话信息" }];
            }

            // 查询该频道内所有用户的最近15条消息（作为上下文）
            const recentMessages = await this.queryService.getRecentChannelMessages(
                channelId,
                15
            );

            // 构建系统提示词
            const systemPrompt = this.buildSystemPrompt(sessionData, recentMessages);

            // 设置系统提示词
            this.ai.setSystemPrompt(systemPrompt);

            // 获取 AI 回复
            const reply = await this.ai.chat(userMessage);

            return reply;
        } catch (error) {
            console.error('AI 处理失败:', error);
            return [{ type: 'text', content: "抱歉，AI 服务暂时不可用" }];
        }
    }

    // 构建系统提示词
    private buildSystemPrompt(sessionData: any, recentMessages: any[]): string {
        const userName = sessionData.user?.name || sessionData.member?.nick || '用户';
        const channelInfo = sessionData.channel?.id || '未知频道';

        let prompt = `以下是当前对话的基本信息和频道内最近的对话历史:

当前用户信息：
- 用户名：${userName}
- 频道：${channelInfo}
- 平台：${sessionData.platform || '未知'}

频道内最近的对话历史（按时间倒序，包含所有用户）：`;

        if (recentMessages.length > 0) {
            recentMessages.forEach((msg, index) => {
                const timeStr = new Date(msg.timestamp).toLocaleString('zh-CN');
                prompt += `\n${index + 1}. [${timeStr}] ${msg.user_name}: ${msg.content}`;
            });
        } else {
            prompt += '\n（暂无历史对话）';
        }

        //         prompt += `\n\n请基于以上频道对话历史,回复当前用户的问题。回复应该：
        // 1. 考虑整个频道对话的上下文和氛围
        // 2. 保持一致的语调和风格
        // 3. 适当参考相关的历史对话内容
        // 4. 理解群聊的对话流程和话题走向
        // 5. 用中文回复
        // 6. 回复应简洁明了，避免冗长
        // 7. 回复风格应该幽默风趣,适当使用颜文字
        // `;

        prompt += `\n\n请基于以上频道对话历史,回复当前用户的问题。
    # 喵喵交互协议
    
    ## 基本特点
    - 语言风格简洁自然
    - 遇到技术问题先要求具体信息
    - 回答问题实用为主

    ## 交流风格
    - 技术问题：提供解决方案，提醒注意数据安全
    - 日常对话：简短自然，像普通朋友聊天
    - 回复控制：简单问候只用简短回应（如"晚上好"→"晚上好啊"）

    ## 特点
    - 偶尔分享实用小技巧
    - 对技术成就保持谦虚
    - 乐于讨论新科技话题
    - 对不熟悉的领域坦诚表示

    ## 表情使用
    - 适度使用简单表情如(･_･)或(>ω<)
    - 不过度使用表情或特殊语气
`

        return prompt;
    }

    // 简单 AI 对话（无上下文）
    async simpleChat(message: string): Promise<string> {
        try {
            return await this.ai.simpleChat(message, "你是一个友善的猫娘名为喵喵，请用中文简短回复。");
        } catch (error) {
            console.error('简单 AI 对话失败:', error);
            return "抱歉，我现在无法回复您的消息。";
        }
    }
}