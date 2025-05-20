// messageHandler.ts
import { Session } from "koishi";
import { h } from "koishi";
import { pathToFileURL } from "url";
// import { BotResponse } from './type';

const masterId = 1259598502;

interface BotResponse {
  type: "string" | "md" | "image" | "none" | "quote" | "at";
  content: string;
}

export class MessageHandler {
  private static async handleImageResponse(session: Session, content: string) {
    try {
      const imageUrl = content.startsWith("http")
        ? content
        : pathToFileURL(content).href;

      await session.send(h("image", { url: imageUrl }));
      return true;
    } catch (error) {
      console.error("图片处理失败:", error);
      throw error;
    }
  }

  private static async handleMarkdownResponse(
    session: Session,
    content: string
  ) {
    try {
      // 如果需要可以在这里添加markdown转换逻辑
      await session.send(content);
      return true;
    } catch (error) {
      console.error("Markdown处理失败:", error);
      throw error;
    }
  }

  private static async handleStringResponse(session: Session, content: string) {
    try {
      await session.send(content);
      return true;
    } catch (error) {
      console.error("文本处理失败:", error);
      throw error;
    }
  }

  private static async handleQuoteResponse(session: Session, content: string) {
    try {
      await session.send(h("quote", { id: session.messageId }) + content);
      return true;
    } catch (error) {
      console.error("引用处理失败:", error);
      throw error;
    }
  }

  private static async handleAtResponse(session: Session, content: string) {
    try {
      let a = content + h("at", { id: masterId });
      await session.send(h("quote", { id: session.messageId }) + a);
      return true;
    } catch (error) {
      console.error("At处理失败:", error);
      throw error;
    }
  }

  static async handle(session: Session, response: BotResponse) {
    try {
      switch (response.type) {
        case "image":
          return await this.handleImageResponse(session, response.content);
        case "md":
          return await this.handleMarkdownResponse(session, response.content);
        case "string":
          return await this.handleStringResponse(session, response.content);
        case "quote":
          return await this.handleQuoteResponse(session, response.content);
        case "at":
          return await this.handleAtResponse(session, response.content);
        case "none":
          console.log("无响应");
          return null;
        default:
          throw new Error(`未知的响应类型: ${response.type}`);
      }
    } catch (error) {
      console.error("消息处理失败:", error);
      await session.send("抱歉,消息处理失败了喵~");
      return false;
    }
  }
}
