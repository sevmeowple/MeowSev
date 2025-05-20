import { turndown } from "@utils/turndown";
import type { Tool, ToolParameters } from "fastmcp";
import { type } from "arktype";
import { QdrantClient } from "@qdrant/js-client-rest";
import { M3LogWrapper } from "@utils/m3log";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();
const model = "BAAI/bge-m3";
const siliconflow_key = process.env.SILICON_API_KEY;

// 缓存目录
const CACHE_DIR = "./.embedding_cache";

// 搜索结果类型
type SearchResult = {
  id: string;
  score: number;
  charId: string;
  charName: string;
  segmentType: string;
  title: string;
  content: string;
  contentPreview: string;
};

class ArkMemo {
  logger: M3LogWrapper = new M3LogWrapper(["ArkMemo"], false, true);
  qdrantClient: QdrantClient;
  collectionName: string = "arknights_segments";
  arkstory: string = "arkstory";

  constructor() {
    // 确保缓存目录存在
    fs.mkdir(CACHE_DIR, { recursive: true }).catch(err => {
      this.logger.error(`创建缓存目录失败: ${err.message}`);
    });

    // 初始化Qdrant客户端
    this.qdrantClient = new QdrantClient({ host: "localhost", port: 6333 });

    // 检查API密钥是否存在
    if (!siliconflow_key) {
      this.logger.error("未设置 SILICONFLOW_KEY 环境变量");
    }
  }

  // 查询明日方舟角色/干员信息
  async queryInfo(keyword: string, limit: number = 5): Promise<string> {
    this.logger.debug(`执行查询: ${keyword}, 限制: ${limit}`);

    try {
      // 执行语义搜索
      const results = await this.semanticSearch(keyword, limit);

      if (results.length === 0) {
        return "抱歉，没有找到相关信息。";
      }

      // 构建回复信息
      let response = `## 查询结果: ${keyword}\n\n找到 ${results.length} 条相关信息:\n\n`;

      // 添加每个结果
      results.forEach((result, index) => {
        response += `### ${index + 1}. ${result.charName} (相关度: ${Math.round(result.score * 100)}%)\n`;
        response += `**类型**: ${this.formatSegmentType(result.segmentType)} - ${result.title}\n\n`;
        response += `${result.content}\n\n`;

        if (index < results.length - 1) {
          response += `---\n\n`;
        }
      });

      return response;
    } catch (error) {
      this.logger.error(`查询失败: ${error instanceof Error ? error.message : String(error)}`);
      return `查询失败: ${error instanceof Error ? error.message : "未知错误"}`;
    }
  }

  // 格式化段落类型为更友好的显示方式
  private formatSegmentType(segmentType: string): string {
    const types: Record<string, string> = {
      "basic_info": "基本信息",
      "story": "故事资料"
    };

    return types[segmentType] || segmentType;
  }

  // 生成内容哈希，用于缓存
  private contentHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  // 从缓存加载嵌入向量
  private async loadEmbeddingFromCache(text: string): Promise<number[] | null> {
    const hash = this.contentHash(text);
    const cachePath = path.join(CACHE_DIR, `${hash}.json`);

    try {
      const cacheData = await fs.readFile(cachePath, 'utf8');
      const embedding = JSON.parse(cacheData);
      return embedding;
    } catch (error) {
      // 如果文件不存在或读取失败，返回 null
      return null;
    }
  }

  // 保存嵌入向量到缓存
  private async saveEmbeddingToCache(text: string, embedding: number[]): Promise<void> {
    const hash = this.contentHash(text);
    const cachePath = path.join(CACHE_DIR, `${hash}.json`);

    try {
      await fs.writeFile(cachePath, JSON.stringify(embedding));
    } catch (error) {
      this.logger.error(`保存缓存失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 调用 API 获取嵌入向量，优先使用缓存
  private async getEmbedding(text: string): Promise<number[]> {
    // 首先尝试从缓存中加载
    const cachedEmbedding = await this.loadEmbeddingFromCache(text);
    if (cachedEmbedding) {
      this.logger.debug("从缓存中加载嵌入向量");
      return cachedEmbedding;
    }

    // 如果缓存中没有，则调用 API
    this.logger.debug("调用 API 生成嵌入向量");

    if (!siliconflow_key) {
      throw new Error("未设置 SILICONFLOW_KEY 环境变量");
    }

    const headers = {
      Authorization: `Bearer ${siliconflow_key}`,
      "Content-Type": "application/json"
    };

    const body = {
      model: model,
      input: text,
      encoding_format: "float"
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    };

    try {
      const response = await fetch('https://api.siliconflow.cn/v1/embeddings', options);
      const data = await response.json();

      if (data.code || data.error) {
        throw new Error(data.message || data.error || "API 返回错误");
      }

      if (data.data && data.data[0] && data.data[0].embedding) {
        const embedding = data.data[0].embedding;
        // 保存到缓存
        await this.saveEmbeddingToCache(text, embedding);
        return embedding;
      } else {
        throw new Error("无法从 API 响应中获取嵌入向量");
      }
    } catch (error) {
      this.logger.error(`API 调用失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // 执行语义搜索
  private async semanticSearch(query: string, limit: number = 5,collectionName = this.collectionName): Promise<SearchResult[]> {
    try {
      // 获取查询的嵌入向量
      const queryEmbedding = await this.getEmbedding(query);

      // 执行搜索
      const searchResponse = await this.qdrantClient.query(collectionName, {
        query: queryEmbedding,
        limit: limit,
        with_payload: true,
      });

      // 转换结果
      const results: SearchResult[] = searchResponse.points.map(result => {
        const payload = result.payload || {};
        const content = (payload.content as string) || "";
        // 生成预览，限制在200个字符内
        const contentPreview = content.length > 200
          ? content.substring(0, 200) + "..."
          : content;
        return {
          id: result.id.toString(),
          score: result.score,
          charId: (payload.char_id as string) || "",
          charName: (payload.char_name as string) || "",
          segmentType: (payload.segment_type as string) || "",
          title: (payload.title as string) || "",
          content: content,
          contentPreview: contentPreview
        };
      });

      return results;
    } catch (error) {
      this.logger.error(`搜索失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // 高级搜索函数 - 支持过滤特定角色
  async advancedSearch(
    query: string,
    filters?: { charId?: string; segmentType?: string },
    limit: number = 5
  ): Promise<SearchResult[]> {
    try {
      // 获取查询的嵌入向量
      const queryEmbedding = await this.getEmbedding(query);

      // 构建过滤条件
      let filter: any = {};
      if (filters) {
        const must: any[] = [];

        if (filters.charId) {
          must.push({
            key: "char_id",
            match: { value: filters.charId }
          });
        }

        if (filters.segmentType) {
          must.push({
            key: "segment_type",
            match: { value: filters.segmentType }
          });
        }

        if (must.length > 0) {
          filter = { must };
        }
      }

      // 执行搜索，带过滤
      const searchOptions: any = {
        query: queryEmbedding,
        limit: limit,
        with_payload: true,
      };

      // 如果有过滤条件，添加它
      if (Object.keys(filter).length > 0) {
        searchOptions.filter = filter;
      }

      const searchResponse = await this.qdrantClient.query(this.collectionName, searchOptions);

      // 转换结果
      const results = searchResponse.points.map(result => {
        const payload = result.payload || {};
        const content = (payload.content as string) || "";
        const contentPreview = content.length > 200
          ? content.substring(0, 200) + "..."
          : content;

        return {
          id: result.id.toString(),
          score: result.score,
          charId: (payload.char_id as string) || "",
          charName: (payload.char_name as string) || "",
          segmentType: (payload.segment_type as string) || "",
          title: (payload.title as string) || "",
          content: content,
          contentPreview: contentPreview
        };
      });

      return results;
    } catch (error) {
      this.logger.error(`高级搜索失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// 创建单例
const arkMemo = new ArkMemo();

// 定义 MCP 工具
const arkMemoSchema: Tool<undefined, ToolParameters> = {
  name: "arkmemo",
  description: `询明日方舟角色、干员资料和故事信息的语义搜索工具。提供关键词来查找相关内容。
  单角色查询推荐设置limit为5-7,多角色查询推荐设置limit为8-10`,
  parameters: type({
    keyword: "string",
    limit: "number?",  // 可选参数，限制返回结果数量
  }),
  execute: async (args: any) => {
    const keyword = args.keyword;
    const limit = args.limit || 5;  // 默认返回5个结果

    return arkMemo.queryInfo(keyword, limit);
  }
};

export { arkMemoSchema };