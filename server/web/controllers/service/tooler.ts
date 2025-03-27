import { tooler } from "@/plugin";
import type { BotResponse } from "@/type";

class TOOLERService {
  async lookup(keyword: string): Promise<BotResponse> {
    const path = await tooler.lookup(keyword);
    return {
      type: "image",
      content: path,
    };
  }

  async bilibili(url: string): Promise<BotResponse> {
    const path = await tooler.bilibili(url);

    if(!path) {
      return {
        type: "none",
        content: "未找到相关视频信息",
      };
    }
    return {
      type: "image",
      content: path,
    };
  }

  async github(url: string): Promise<BotResponse> {
    const path = await tooler.github(url);

    if(!path) {
      return {
        type: "none",
        content: "未找到相关仓库信息",
      };
    }
    return {
      type: "image",
      content: path,
    };
  }
}

export const toolerService = new TOOLERService();
