import { ai } from "@/AI";
import type { BotResponse } from "@/type";
// import { fetch } from "undici"; // 使用undici获得更好的性能，但标准fetch也可以

class AIService {

  private mcpEndpoint: string;
  
  constructor(endpoint: string = "http://localhost:4061") {
    this.mcpEndpoint = endpoint;
  }

  async chat(message: string): Promise<BotResponse> {
    try {
      const response = await fetch(`${this.mcpEndpoint}/mcp/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyword: message }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MCP服务返回错误(${response.status}): ${errorText}`);
      }
      
      // 直接获取响应结果，这可能是一个字符串
      const result = await response.text();
      
      // 判断result是否是JSON格式的字符串
      let content: string;
      try {
        // 尝试解析JSON，如果成功，我们需要提取其中的文本内容
        const jsonResult = JSON.parse(result);
        // 如果解析后是字符串，直接使用
        if (typeof jsonResult === 'string') {
          content = jsonResult;
        } 
        // 如果是对象，可能需要从特定字段获取（根据API的实际返回格式调整）
        else if (jsonResult && typeof jsonResult === 'object') {
          // 假设返回格式是 { text: "回复内容" } 或 { content: "回复内容" }
          content = jsonResult.text || jsonResult.content || JSON.stringify(jsonResult);
        } else {
          content = String(jsonResult);
        }
      } catch (e) {
        // 如果解析失败，表示返回的已经是纯文本
        content = result;
      }
      
      return {
        type: "string",
        content: content,  // 确保content是字符串
      };
    } catch (error) {
      console.error("MCP聊天请求失败:", error);
      return {
        type: "string", 
        content: `聊天请求失败`
      };
    }
  }

  // async chat(message: string): Promise<BotResponse> {
  //   const response = await ai.chat(message);
  //   if (!response) {
  //     throw new Error("No response");
  //   }
  //   return {
  //     type: "string",
  //     content: response,
  //   };
  // }

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
