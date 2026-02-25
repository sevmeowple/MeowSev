import { ConfigUnionType } from "@/config/config";
import { MsgService } from "./MsgService";
import { AIService } from "./AIService";
import { MessageObject } from "@/utils/message";
import { SummaryCard, SummaryData } from "@/view/SummaryCard";
import { tsxToPic } from "@/utils/plugin/browser/tsxToPic";
import { Message } from "@/models/Message";

export class SummaryService {
  private msgService: MsgService;
  private aiService: AIService;

  constructor(ConfigUnion: ConfigUnionType) {
    this.msgService = new MsgService(ConfigUnion);
    this.aiService = new AIService(ConfigUnion);
  }

  async generateSummary(channelId: string, count: number): Promise<MessageObject> {
    const messages = await this.msgService.getMessagesByChannel(channelId, count);

    if (messages.length === 0) {
      return { type: "text", content: "❌ 当前频道暂无聊天记录" };
    }

    const formatted = this.formatMessages(messages);
    const summaryData = await this.callAI(formatted, messages.length);
    const picPath = await tsxToPic(SummaryCard, { data: summaryData }, { width: 700 });

    return { type: "image", src: `file://${picPath}` };
  }

  private formatMessages(messages: Message[]): string {
    return messages.map(msg => {
      const time = new Date(msg.timestamp).toLocaleString("zh-CN", {
        month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
      const name = msg.user_nick || msg.user_name;
      return `[${time}] ${name}: ${msg.content}`;
    }).join("\n");
  }

  private async callAI(formattedMessages: string, count: number): Promise<SummaryData> {
    const systemPrompt = `你是一个群聊分析助手。分析以下群聊消息并返回JSON格式的总结。
要求：
- topics: 提取3-5个主要话题，每个包含name和description
- participants: 提取最活跃的3-5个参与者，包含name、messageCount和highlight(一句代表性发言)
- highlights: 3-5个精彩对话片段的简短描述
- mood: 一个词描述整体氛围
- oneSentenceSummary: 一句话总结
- timeRange: 消息的时间范围
- messageCount: ${count}

严格返回JSON，不要包含markdown代码块。`;

    const prompt = `分析以下${count}条群聊消息:\n\n${formattedMessages}`;

    return await this.aiService.generateJsonResponse<SummaryData>(prompt, systemPrompt);
  }
}
