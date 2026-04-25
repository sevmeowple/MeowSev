import type { Message } from "@/models/Message";

/**
 * MessageFilter — 消息价值过滤器
 * 职责：零 LLM 开销地判断一条消息是否值得提取档案信息
 * 设计原则：宁可漏掉（ false negative ）也不错杀（ false positive ）
 */
export class MessageFilter {
  // 常见纯表情/无意义内容模式
  private static readonly EMOJI_PATTERN =
    /^[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2000}-\u{206F}\u{FE00}-\u{FE0F}]+$/u;

  // 触发档案提取的正向关键词（兴趣、技能、计划、身份等）
  private static readonly INTENT_KEYWORDS = [
    "我喜欢", "我爱", "我讨厌", "我不爱",
    "我是", "我在", "我工作", "我学", "我擅长",
    "我要", "我打算", "我计划", "我准备", "我想",
    "买了", "抽到", "通关", "过了", "失败了",
    "面试", "offer", "入职", "辞职", "跳槽",
    "生日", "节日", "放假", "旅游", "出差",
  ];

  // 复读检测缓存：user_id -> lastContent（简化的内存缓存）
  private lastMessages: Map<string, string> = new Map();

  /**
   * 判断消息是否值得处理
   */
  shouldProcess(msg: Message): boolean {
    const content = msg.content?.trim() || "";

    // 1. 长度过滤：过短的消息通常无价值
    if (content.length < 5) return false;

    // 2. 纯表情过滤
    if (MessageFilter.EMOJI_PATTERN.test(content)) return false;

    // 3. 复读检测：与上一条消息完全一致
    const last = this.lastMessages.get(msg.user_id);
    if (last === content) return false;
    this.lastMessages.set(msg.user_id, content);

    // 4. 常见水群短语过滤
    if (this.isFillerMessage(content)) return false;

    // 5. 正向触发条件（满足任一即处理）
    if (this.hasIntentKeywords(content)) return true;
    if (this.hasLink(content)) return true;
    if (this.isReply(msg)) return true;
    if (content.length > 50) return true; // 长消息通常有信息量

    // 默认：不过滤（保留中等长度消息）
    return true;
  }

  /**
   * 批量过滤，返回值得处理的消息列表
   */
  filterBatch(messages: Message[]): Message[] {
    // 先按时间排序，确保复读检测正确
    const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.filter(m => this.shouldProcess(m));
  }

  // ─── 私有判断方法 ───────────────────────────────────

  private isFillerMessage(content: string): boolean {
    const fillers = [
      /^[哈哼呵]+$/,
      /^[哦嗯啊]+$/,
      /^[6]+$/,
      /^\+1$/,
      /^\+\d+$/,
      /^[对对对]+$/,
      /^[好好好]+$/,
      /^[草艹]+$/,
      /^[笑死]+$/,
      /^\.{3,}$/,
      /^[？?]+$/,
      /^[！!]+$/,
      /^确实$/,
      /^正确的$/,
      /^正确的，直接的$/,
      /^中肯的$/,
      /^客观的$/,
      /^合理的$/,
      /^支持$/,
      /^不行$/,
      /^可以$/,
      /^没问题$/,
      /^好的$/,
      /^行$/,
      /^ok$/i,
      /^yes$/i,
      /^no$/i,
    ];
    return fillers.some(p => p.test(content));
  }

  private hasIntentKeywords(content: string): boolean {
    return MessageFilter.INTENT_KEYWORDS.some(kw => content.includes(kw));
  }

  private hasLink(content: string): boolean {
    return /https?:\/\/|www\.|\.com|\.cn|\.net|\.org|bilibili\.com|youtube\.com|github\.com/.test(content);
  }

  private isReply(msg: Message): boolean {
    return msg.message_type === "reply" || msg.message_type === "quote";
  }
}
