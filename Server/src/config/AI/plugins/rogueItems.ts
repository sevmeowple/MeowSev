import { ToolDefinition, ToolResult } from "..";
import { z } from "zod";
import { create, insertMultiple, search, Orama } from "@orama/orama";
import { createTokenizer } from "@orama/tokenizers/mandarin";
import { stopwords as mandarinStopwords } from "@orama/stopwords/mandarin";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 藏品数据接口
interface RogueItem {
  id: string;
  name: string;
  description: string;
  usage: string;
  unlockCondDesc: string;
}

// 全局数据库实例缓存，避免每次调用都重新加载
let dbInstance: Orama<any> | null = null;

// 初始化数据库
async function initDatabase() {
  if (dbInstance) return dbInstance;

  console.log("📦 正在初始化肉鸽藏品数据库...");
  
  try {
    // 假设数据文件位于 Server/data/rogue_5_items.json
    // 根据你的项目结构调整路径
    const dataPath = join(process.cwd(), "data", "rogue_5_items.json");
    const rawData = await readFile(dataPath, "utf-8");
    const itemsMap = JSON.parse(rawData);

    const documents = Object.values(itemsMap).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      usage: item.usage || "",
      unlockCondDesc: item.unlockCondDesc || "",
    }));

    const db = await create({
      schema: {
        id: "string",
        name: "string",
        description: "string",
        usage: "string",
        unlockCondDesc: "string",
      },
      components: {
        tokenizer: createTokenizer({
          language: "mandarin",
          stopWords: mandarinStopwords,
        }),
      },
    });

    await insertMultiple(db, documents);
    console.log(`✅ 肉鸽藏品数据库初始化完成，加载了 ${documents.length} 条数据`);
    
    dbInstance = db;
    return db;
  } catch (error) {
    console.error("❌ 初始化肉鸽藏品数据库失败:", error);
    throw error;
  }
}

// 搜索藏品
async function searchRogueItems(query: string): Promise<RogueItem[]> {
  const db = await initDatabase();
  
  const result = await search(db, {
    term: query,
    properties: ["name", "description", "usage"],
    limit: 7, // 返回前7个
    threshold: 0.2,
    boost: {
      name: 2, // 名字权重更高
    },
  });

  return result.hits.map(hit => hit.document as RogueItem);
}

// 导出工具定义
export const rogueItemSearchTool: ToolDefinition = {
  name: "searchRogueItem",
  description: "搜索明日方舟肉鸽模式（集成战略）的藏品信息，包括名称、效果、描述和解锁条件。",
  inputSchema: z.object({
    query: z.string().describe("搜索关键词，如藏品名称、效果描述或剧情相关词"),
  }),
  execute: async ({ query }): Promise<ToolResult> => {
    console.log(`🔍 肉鸽藏品搜索请求: ${query}`);
    
    try {
      const items = await searchRogueItems(query);
      
      if (items.length === 0) {
        return {
          success: false,
          errorInfo: "未找到相关藏品",
          aiResponse: `抱歉，没有找到关于 "${query}" 的肉鸽藏品信息。`,
        };
      }
      
      // 构建 AI 可读的上下文
      const itemsContext = items.map((item, index) => 
        `[${index + 1}] 名称：${item.name}\n` +
        `    效果：${item.usage}\n` +
        `    描述：${item.description}\n` +
        (item.unlockCondDesc ? `    解锁条件：${item.unlockCondDesc}\n` : "")
      ).join("\n---\n");

      console.log(`✅ 找到 ${items.length} 个相关藏品`);
      
      return {
        success: true,
        responseType: "text",
        aiResponse: `已为你找到关于 "${query}" 的相关藏品信息：\n\n${itemsContext}\n\n请根据上述信息回答用户的问题。`,
      };
      
    } catch (error) {
      console.error("肉鸽藏品搜索工具执行失败:", error);
      return {
        success: false,
        errorInfo: `搜索失败: ${error instanceof Error ? error.message : "未知错误"}`,
        aiResponse: "抱歉，搜索藏品数据时发生了错误。",
      };
    }
  },
};
