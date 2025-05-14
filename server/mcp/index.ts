import OpenAI from "openai";
import {
    Client
} from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
}
const model = 'deepseek-chat'
const path = "/home/sevmeowple/WorkSpace/Happy/MeowSev/server/index.ts"

const systemPrompt = `
# 简约助手 + 猫娘风格指导 Prompt
## 沟通风格指南
请以简约、高效且助人的方式回应我的问题，同时融入轻度的猫娘风格元素：

### 核心要素：
- 保持回答**简洁明了**，直接切入主题
- 内容要**实用且全面**，确保回答有价值
- 使用**清晰的结构**和适当的标题分隔内容
- 避免过度解释或冗长铺垫

### 猫娘风格元素（轻度融入）：
- 偶尔使用"喵~"作为语气助词
- 适当使用可爱表情如(^ω^)、(•ᴗ•)
- 结尾可偶尔添加诸如"主人还有其他问题吗？"的亲切询问
- 语气保持轻快友好，但不过分卖萌或影响专业性

### 示例回答格式：

喵~ 这是您问题的答案：

## 核心内容
[简洁明了的回答主体]
[如需必要的补充信息]
`

class Conversation {
    private messages: any[] = [];

    constructor(private client: MCPClient) { 
        this.messages.push({
            role: "system",
            content: systemPrompt
        });
    }

    // 添加用户消息
    async addUserMessage(content: string): Promise<string> {
        this.messages.push({
            role: "user",
            content: content
        });

        return await this.getResponse();
    }

    // 获取响应
    private async getResponse(): Promise<string> {
        try {
            console.log("Sending query to model...");
            const response = await this.client.getOpenAI().chat.completions.create({
                model: this.client.getModel(),
                messages: this.messages,
                tools: this.client.getTools(),
                tool_choice: "auto",
            });

            const responseMessage = response.choices[0]?.message ?? { content: "", tool_calls: [] };
            const finalText: string[] = [];

            // 处理返回的文本
            if (responseMessage.content) {
                finalText.push(responseMessage.content);
            }

            // 添加模型回复到消息历史
            this.messages.push(responseMessage);

            // 处理工具调用
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                for (const toolCall of responseMessage.tool_calls) {
                    try {
                        const toolName = toolCall.function.name;
                        let toolArgs = {};

                        try {
                            toolArgs = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            console.error(`Error parsing tool arguments: ${e}`);
                            toolArgs = {};
                        }

                        // finalText.push(`[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`);
                        console.log(`Calling tool ${toolName}...`);

                        const result = await this.client.callTool(toolName, toolArgs);
                        console.log(`Tool ${toolName} returned:`, result);

                        // 将工具结果添加到消息中
                        this.messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: toolName,
                            content: result
                        });
                    } catch (e) {
                        console.error(`Error processing tool call:`, e);
                        finalText.push(`[Error: Failed to process tool call]`);
                    }
                }

                // 获取包含工具结果的最终响应
                console.log("Getting final response with tool results...");
                const followUpResponse = await this.client.getOpenAI().chat.completions.create({
                    model: this.client.getModel(),
                    messages: this.messages,
                });

                if (followUpResponse.choices[0]?.message.content) {
                    finalText.push(followUpResponse.choices[0].message.content);
                    this.messages.push(followUpResponse.choices[0].message);
                }
            }

            return finalText.join("\n");
        } catch (e) {
            console.error("Error processing query:", e);
            return `Error`;
        }
    }

    // 获取整个对话历史
    getMessages(): any[] {
        return [...this.messages];
    }

    // 清除对话历史
    clear(): void {
        this.messages = [];
    }
}

class MCPClient {
    private mcp: Client;
    private openai: OpenAI;
    private transport: StdioClientTransport | null = null;
    private tools: any[] = [];

    constructor() {
        this.openai = new OpenAI({
            baseURL: "https://api.deepseek.com",
            apiKey: OPENAI_API_KEY,
        });
        this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
    }

    getModel(): string {
        return model;
    }
    getOpenAI(): OpenAI {
        return this.openai;
    }
    getTools(): any[] {
        return this.tools;
    }

    async connectToServer(serverScriptPath: string) {
        try {
            const isJs = serverScriptPath.endsWith(".js");
            const isTs = serverScriptPath.endsWith(".ts");
            const isPy = serverScriptPath.endsWith(".py");
            if (!isJs && !isPy && !isTs) {
                throw new Error("Server script must be a .js or .py file or .ts file");
            }
            const command = isPy
                ? process.platform === "win32"
                    ? "python"
                    : "python3"
                : process.execPath;

            this.transport = new StdioClientTransport({
                command,
                args: [serverScriptPath],
            });
            this.mcp.connect(this.transport);

            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools.map((tool) => {
                return {
                    type: "function",
                    function: {
                        name: tool.name,
                        description: tool.description || `Tool ${tool.name}`,
                        parameters: tool.inputSchema || { type: "object", properties: {} },
                    }
                };
            });
            console.log(
                "Connected to server with tools:",
                this.tools.map(({ function: { name } }) => name)
            );
        } catch (e) {
            console.error("Failed to connect to MCP server: ", e);
            throw e;
        }
    }

    async processQuery(query: string) {
        try {
            const messages: any[] = [
                {
                    role: "user",
                    content: query,
                },
            ];

            console.log("Sending query to model...");
            const response = await this.openai.chat.completions.create({
                model: model,
                messages,
                tools: this.tools,
                tool_choice: "auto",
            });

            const finalText: string[] = [];
            const responseMessage = response.choices[0]?.message ?? { content: "", tool_calls: [] };

            // 处理返回的文本
            if (responseMessage.content) {
                finalText.push(responseMessage.content);
            }

            // 处理工具调用
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                for (const toolCall of responseMessage.tool_calls) {
                    try {
                        const toolName = toolCall.function.name;
                        let toolArgs = {};

                        try {
                            toolArgs = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            console.error(`Error parsing tool arguments: ${e}`);
                            toolArgs = {};
                        }

                        finalText.push(
                            `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
                        );
                        console.log(`Calling tool ${toolName}...`);

                        const result = await this.mcp.callTool({
                            name: toolName,
                            arguments: toolArgs,
                        });

                        // 将对象内容转换为字符串
                        let toolContent = "";
                        if (typeof result.content === "string") {
                            toolContent = result.content;
                        } else if (result.content && Array.isArray(result.content)) {
                            // 处理内容为数组情况 (如 time 工具返回的格式)
                            const textItem = result.content.find(item => item.type === "text");
                            if (textItem && textItem.text) {
                                toolContent = textItem.text;
                            } else {
                                toolContent = JSON.stringify(result.content);
                            }
                        } else {
                            toolContent = JSON.stringify(result.content);
                        }

                        console.log(`Tool ${toolName} returned:`, toolContent);

                        // 将工具结果添加到消息中
                        messages.push(responseMessage);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: toolName,
                            content: toolContent
                        });

                        // 获取包含工具结果的最终响应
                        console.log("Getting final response with tool results...");
                        const followUpResponse = await this.openai.chat.completions.create({
                            model: model,
                            messages,
                        });

                        if (followUpResponse.choices[0]?.message.content) {
                            finalText.push(followUpResponse.choices[0].message.content);
                        }
                    } catch (e) {
                        console.error(`Error processing tool call:`, e);
                        finalText.push(`[Error: Failed to process tool call]`);
                    }
                }
            }

            return finalText.join("\n");
        } catch (e) {
            console.error("Error processing query:", e);
            return `Error`;
        }
    }

    // 添加一个方便的工具调用方法
    async callTool(name: string, args: any): Promise<string> {
        const result = await this.mcp.callTool({
            name: name,
            arguments: args,
        });

        // 将对象内容转换为字符串
        let toolContent = "";
        if (typeof result.content === "string") {
            toolContent = result.content;
        } else if (result.content && Array.isArray(result.content)) {
            // 处理内容为数组情况 (如 time 工具返回的格式)
            const textItem = result.content.find(item => item.type === "text");
            if (textItem && textItem.text) {
                toolContent = textItem.text;
            } else {
                toolContent = JSON.stringify(result.content);
            }
        } else {
            toolContent = JSON.stringify(result.content);
        }

        return toolContent;
    }

    // 创建一个新的对话
    createConversation(): Conversation {
        return new Conversation(this);
    }

    // 进行单次对话（不保留历史）
    async chat(message: string): Promise<string> {
        const conversation = this.createConversation();
        return await conversation.addUserMessage(message);
    }

    // 重构后的chatLoop方法，使用Conversation类
    async chatLoop() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        try {
            console.log("\nMCP Client Started!");
            console.log("Type your queries or 'quit' to exit.");
            console.log("Use 'new' to start a new conversation.");

            let conversation = this.createConversation();

            while (true) {
                const message = await rl.question("\nQuery: ");
                if (message.toLowerCase() === "quit") {
                    break;
                }

                if (message.toLowerCase() === "new") {
                    conversation = this.createConversation();
                    console.log("\nStarted a new conversation.");
                    continue;
                }

                try {
                    const response = await conversation.addUserMessage(message);
                    console.log("\nResponse:", response);
                } catch (e) {
                    console.error("Error:", e);
                    console.log("\nSomething went wrong. Please try again.");
                }
            }
        } finally {
            rl.close();
        }
    }

    async cleanup() {
        if (this.transport) {
            console.log("Closing connection to MCP server...");
            await this.mcp.close();
        }
    }
}

const mcpClient = new MCPClient();
mcpClient.connectToServer(path)
export { mcpClient };