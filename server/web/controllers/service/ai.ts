import { ai } from "@/AI";
import type { BotResponse } from "@/type";

class AIService {
  async chat(message: string): Promise<BotResponse> {
    const response = await ai.chat(message);
    if (!response) {
      throw new Error("No response");
    }
    return {
      type: "string",
      content: response,
    };
  }

  async chat_with_group(group_id:string): Promise<BotResponse> {
    const response = await ai.chat_with_group(group_id);
    if (!response) {
      throw new Error("No response");
    }
    return {
      type: "string",
      content: response,
    };
  }
  

  async chatARK(
    message: string,
    charactor: string,
    character2?: string
  ): Promise<BotResponse> {
    const response = await ai.chatARK(message, charactor, character2);
    if (!response) {
      throw new Error("No response");
    }
    return {
      type: "image",
      content: response,
    };
  }

  async chat_R1(message: string,on:boolean): Promise<BotResponse> {
    const response = await ai.chat_R1(message,on);
    if (!response) {
      throw new Error("No response");
    }
    return {
      type: "image",
      content: response,
    };
  }
}

export const AIservice = new AIService();
