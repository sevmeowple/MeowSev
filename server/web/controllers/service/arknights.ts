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
