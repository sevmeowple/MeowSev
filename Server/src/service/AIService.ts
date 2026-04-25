import { ConfigUnionType, AppConfig } from "@/config/config";
import { MsgService } from "./MsgService";
import { MessageObject, SessionData } from "@/utils/message";
import { Message } from "@/models/Message";
import { extractImagesFromQuote } from "@/utils/imageUtils";
import { profileService } from "@/service/Profile/instance";

export class AIService {
  private ai;
  private msgService: MsgService;
  private config: AppConfig;

  constructor(ConfigUnion: ConfigUnionType) {
    this.ai = ConfigUnion.ai;
    this.msgService = new MsgService(ConfigUnion);
    this.config = ConfigUnion.app;
  }

  // 封装纯文本生成
  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      return await this.ai.generateText(prompt, systemPrompt);
    } catch (error) {
      console.error("AI 文本生成失败:", error);
      throw error;
    }
  }

  // 封装 JSON 响应生成
  async generateJsonResponse<T = any>(
    prompt: string,
    systemPrompt?: string
  ): Promise<T> {
    try {
      return await this.ai.generateJsonResponse<T>(prompt, systemPrompt);
    } catch (error) {
      console.error("AI JSON 生成失败:", error);
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
      return await this.ai.generateStructuredResponse<T>(
        prompt,
        schema,
        systemPrompt
      );
    } catch (error) {
      console.error("AI 结构化响应生成失败:", error);
      throw error;
    }
  }
  // 处理带上下文的 AI 对话
  async handleChatWithContext(
    sessionData: any,
    params: string[] = []
  ): Promise<MessageObject[]> {
    try {
      // 从 session 中提取用户和频道信息
      const userId = sessionData.user?.id;
      const channelId = sessionData.channel?.id;
      const userMessage = sessionData.message?.content || sessionData.content;

      if (!userId || !channelId || !userMessage) {
        return [{ type: "text", content: "无法获取必要的会话信息" }];
      }

      // 检查是否引用了包含图片的消息
      const quotedImages = this.extractQuotedImages(sessionData);
      if (quotedImages.length > 0) {
        console.log(`🖼️ 检测到引用消息中包含 ${quotedImages.length} 张图片`);
        return this.handleVisionChat(sessionData, userMessage, quotedImages);
      }

      // 查询该频道内所有用户的最近15条消息（作为上下文）
      const allMessages = await this.msgService.getMessages();
      const recentMessages = allMessages
        .filter((msg) => msg.channel_id === channelId)
        .slice(0, 15);

      // 构建系统提示词（含用户画像注入）
      const systemPrompt = await this.buildSystemPrompt(sessionData, recentMessages);

      // 设置系统提示词
      this.ai.setSystemPrompt(systemPrompt);

      // 获取 AI 回复（启用工具，传递session）
      const reply = await this.ai.chat(userMessage, true, false, false, sessionData);

      return reply;
    } catch (error) {
      console.error("AI 处理失败:", error);
      return [{ type: "text", content: "抱歉，AI 服务暂时不可用" }];
    }
  }

  /**
   * 从 session 数据中提取引用消息中的图片
   */
  private extractQuotedImages(sessionData: any): string[] {
    const quote = sessionData.message?.quote;
    if (!quote) return [];

    return extractImagesFromQuote(quote);
  }

  /**
   * 处理带图片的视觉对话
   */
  private async handleVisionChat(
    sessionData: any,
    userMessage: string,
    imageUrls: string[]
  ): Promise<MessageObject[]> {
    try {
      const userName = sessionData.user?.name || sessionData.member?.nick || "用户";
      const channelId = sessionData.channel?.id;

      // 查询该频道内所有用户的最近10条消息（作为上下文，减少视觉对话的上下文长度）
      const allMessages = await this.msgService.getMessages();
      const recentMessages = allMessages
        .filter((msg) => msg.channel_id === channelId)
        .slice(0, 10);

      // 构建视觉对话的系统提示词
      const systemPrompt = this.buildVisionSystemPrompt(sessionData, recentMessages);

      // 构建分析提示词
      const visionPrompt = `${userName} 引用了图片：${userMessage ? `「${userMessage}」` : "未附文字"}

请分析图片内容并回应。如有多个图片，分别说明后再简要总结。`;

      // 使用主模型进行视觉分析（kimi2.5 支持视觉）
      const visionResponse = await this.ai.analyzeImages(imageUrls, visionPrompt, {
        useMainModel: true, // 使用主模型（kimi2.5）
        systemPrompt
      });

      return [{ type: "text", content: visionResponse }];
    } catch (error) {
      console.error("视觉对话处理失败:", error);
      return [{ type: "text", content: "抱歉，图片分析暂时不可用，请稍后再试" }];
    }
  }

  /**
   * 构建视觉对话的系统提示词
   */
  private buildVisionSystemPrompt(
    sessionData: any,
    recentMessages: Message[]
  ): string {
    const userName =
      sessionData.user?.name || sessionData.member?.nick || "用户";
    const channelInfo = sessionData.channel?.id || "未知频道";
    const channelId = sessionData.channel?.id;

    // 获取群组特定的人格设置
    const persona =
      channelId && this.config.personas?.groups?.[channelId]
        ? this.config.personas.groups[channelId]
        : this.config.personas?.default || " ";

    let prompt = `
${persona}
你正在分析用户引用的图片。以下是当前对话的基本信息和频道内最近的对话历史:

当前用户信息：
- 用户名：${userName}
- 频道：${channelInfo}
- 平台：${sessionData.platform || "未知"}

频道内最近的对话历史（按时间倒序，包含所有用户）：`;

    if (recentMessages.length > 0) {
      recentMessages.forEach((msg, index) => {
        const timeStr = new Date(msg.timestamp).toLocaleString("zh-CN");
        const msgUserName = msg.user_name || `用户${msg.user_id}`;
        const content = msg.content || "";
        prompt += `\n${index + 1}. [${timeStr}] ${msgUserName}: ${content}`;
      });
    } else {
      prompt += "\n（暂无历史对话）";
    }

    prompt += `\n\n请基于以上频道对话历史，分析用户引用的图片内容。
    # 喵喵视觉交互协议

    ## 基本特点
    - 语言风格简洁自然
    - 回答实用为主，不冗长
    - 使用中文回复

    ## 图片分析风格
    - 技术类图片：说明关键信息，提醒注意细节
    - 表情包/梗图：描述内容，解释传达的情绪或梗的含义
    - 日常照片：简要描述场景，自然回应
    - 多张图片：分别简要说明，再总结关联

    ## 交流风格
    - 像普通朋友聊天，不机械
    - 简单问候只用简短回应
    - 对不确定的内容坦诚表示

    ## 表情使用
    - 适度使用简单表情如(･_･)或(>ω<)
    - 不过度使用表情或特殊语气`;

    return prompt;
  }

  // 构建系统提示词
  private async buildSystemPrompt(
    sessionData: any,
    recentMessages: Message[]
  ): Promise<string> {
    const userName =
      sessionData.user?.name || sessionData.member?.nick || "用户";
    const userId = sessionData.user?.id;
    const channelInfo = sessionData.channel?.id || "未知频道";
    const channelId = sessionData.channel?.id;
    // 获取群组特定的人格设置，如果没有则使用默认设置
    const persona =
      channelId && this.config.personas?.groups?.[channelId]
        ? this.config.personas.groups[channelId]
        : this.config.personas?.default || " ";

    // ─── 注入用户画像 ───────────────────────────────
    let profileInject = "";
    if (userId && profileService) {
      try {
        const identity = await profileService.getUserIdentity(userId);
        if (identity) {
          const recent = await profileService.getUserRecentContext(userId, 7);
          profileInject = `
【用户档案】
- 昵称：${identity.name}
- 认识时长：${identity.knownSince}
- 标签：${identity.tags.join("、") || "暂无"}
- 近期动态：${recent}
`;
        }
      } catch (e) {
        // 档案查询失败不影响主流程
        console.warn("[AIService] 用户画像注入失败:", e);
      }
    }

    let prompt = `
    ${persona}
    以下是当前对话的基本信息和频道内最近的对话历史:

当前用户信息：
- 用户名：${userName}
- 用户ID：${userId || "未知"}
- 频道：${channelInfo}
- 平台：${sessionData.platform || "未知"}
${profileInject}
频道内最近的对话历史（按时间倒序，包含所有用户）：`;

    if (recentMessages.length > 0) {
      recentMessages.forEach((msg, index) => {
        const timeStr = new Date(msg.timestamp).toLocaleString("zh-CN");
        // 适配Message的数据结构
        const userName = msg.user_name || `用户${msg.user_id}`;
        const content = msg.content || "";
        prompt += `\n${index + 1}. [${timeStr}] ${userName}: ${content}`;
      });
    } else {
      prompt += "\n（暂无历史对话）";
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
`;

    return prompt;
  }

  // 简单 AI 对话（无上下文）
  async simpleChat(message: string): Promise<string> {
    try {
      return await this.ai.simpleChat(
        message,
        "你是一个友善的猫娘名为喵喵，请用中文简短回复。"
      );
    } catch (error) {
      console.error("简单 AI 对话失败:", error);
      return "抱歉，我现在无法回复您的消息。";
    }
  }
  // 图片分析功能
  async analyzeImage(
    imageUrl: string,
    prompt: string = "请描述这张图片",
    useMainModel: boolean = true
  ): Promise<string> {
    try {
      return await this.ai.analyzeImage(imageUrl, prompt, {
        useMainModel
      });
    } catch (error) {
      console.error("图片分析失败:", error);
      throw new Error("视觉服务暂时不可用");
    }
  }

  // 批量图片分析功能
  async analyzeImages(
    imageUrls: string[],
    prompt: string = "请描述这些图片",
    useMainModel: boolean = true
  ): Promise<string> {
    try {
      return await this.ai.analyzeImages(imageUrls, prompt, {
        useMainModel
      });
    } catch (error) {
      console.error("批量图片分析失败:", error);
      throw new Error("视觉服务暂时不可用");
    }
  }
}
