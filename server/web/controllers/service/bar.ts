import { bar } from "@/plugin";
import type { BotResponse } from "@/type";

class BARService {
  async chat_Bar(message: string, char: string): Promise<BotResponse> {
    const path = await bar.chat_Bar(message, char, false);
    if (path == "No char") {
      return {
        type: "at",
        content: "老大,快来解决这个问题喵",
      };
    }

    if (path == "fail") {
      return {
        type: "quote",
        content: "完成对话失败喵",
      };
    }

    return {
      type: "image",
      content: path,
    };
  }
}

export const barService = new BARService();
