import { ToolDefinition, ToolResult } from "..";
import { z } from "zod";
import { getMemeManager } from "../../plugins/meme";
import path from "path";

export const memeTool: ToolDefinition = {
    name: 'send_meme',
    description: 'Send a meme image based on keywords or description. Use this when you want to express an emotion or reaction with an image.',
    inputSchema: z.object({
        keywords: z.string().describe('Keywords to search for a meme, e.g., "cute", "angry", "miku"'),
    }),
    execute: async ({ keywords }: { keywords: string }): Promise<ToolResult> => {
        const memeManager = getMemeManager();
        // 搜索表情包，并过滤出允许 AI 发送的表情包
        const memes = memeManager.search(keywords).filter(meme => meme.allowAI === true);

        if (memes.length === 0) {
            return {
                success: false,
                aiResponse: `Sorry, I couldn't find a meme matching "${keywords}" that I am allowed to send.`,
                errorInfo: 'No allowed meme found'
            };
        }

        // 从结果中随机选择一张
        const meme = memes[Math.floor(Math.random() * memes.length)];
        
        // 构建绝对路径
        // 假设图片位于 public/meme 目录下 (根据你的目录结构推断)
        const imagePath = path.resolve(process.cwd(), 'public/meme', meme.filePath);

        return {
            success: true,
            // 使用 'text' 类型并附带 userMessages，这样 AI 可以继续生成文本回复，同时发送图片
            responseType: 'text', 
            aiResponse: `I sent a meme: ${meme.name} (${meme.description})`,
            userMessages: [{
                type: 'image',
                url: `file://${imagePath}`
            }]
        };
    }
};
