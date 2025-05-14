import { prts } from "@/Arknights";
import { ark } from "@/plugin/arknights";
import type { BotResponse } from "@/type";

class PRTSService {
  async search(keyword: string): Promise<BotResponse> {
    const path = await prts.search(keyword);
    return {
      type: "image",
      content: path,
    };
  }

  async tagGacha(tags: string[]): Promise<BotResponse> {
    const result = await prts.tagGacha(tags);
    // 组合结果以" * "分隔
    let response = result.join(" * ");
    if(!response)
      response = "未找到匹配干员";
    // console.log("response", response);
    return {
      type: "quote",
      content: response,
    };
  }
}

class Ark_Service {
  async randomdice(n: number, m: number): Promise<BotResponse> {
    const random = await ark.RandomDice(n, m);
    return {
      type: "quote",
      content: random,
    };
  }


}

class ArkService {
  prts: PRTSService = new PRTSService();
  ark: Ark_Service = new Ark_Service();
}

export const arknights = new ArkService();
