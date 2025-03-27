import { fomeow } from "@/plugin";
import type { BotResponse } from "@/type";

class FOMEOWService {
  async random(): Promise<BotResponse> {
    const res = await fomeow.randomFood();
    if (!res) {
      return {
        type: "string",
        content: "还没有添加任何食物呢喵~",
      };
    }
    return {
      type: "string",
      content: `今天吃 ${res.name} 吧喵\n ${res.description || "暂无描述"} 喵~`,
    };
  }

  async recommend(): Promise<BotResponse> {
    const res = await fomeow.recommend();
    if (!res) {
      return {
        type: "string",
        content: "还没有添加任何食谱喵~",
      };
    }
    return res;
  }
}

export const fomeowService = new FOMEOWService();
