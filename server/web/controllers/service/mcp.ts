import { mcpClient } from "@mcp/index";
import type { BotResponse } from "@/type";

class MCPService {
  async chat(message: string): Promise<BotResponse> {
    const path = await mcpClient.chat(message);
    return {
      type: "string",
      content: path,
    };
  }
}

export const mcpService = new MCPService();
