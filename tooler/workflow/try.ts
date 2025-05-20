import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

// 加载环境变量
dotenv.config();
const model = "BAAI/bge-m3";
const siliconflow_key = process.env.SILICONFLOW_KEY;

if (!siliconflow_key) {
  console.error("错误: 未设置 SILICONFLOW_KEY 环境变量");
  process.exit(1);
}

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
  contentPreview: string; // 内容预览，可能会被截断
};

async function main() {
  try {
    // 确保缓存目录存在
    await fs.mkdir(CACHE_DIR, { recursive: true });
    
    // 测试查询
    const query = "生日1月1日";
    console.log(`执行查询: "${query}"`);
    
    // 查询结果
    const results = await semanticSearch(query, 10);
    
    // 显示结果
    console.log(`\n找到 ${results.length} 个相关结果:\n`);
    
    results.forEach((result, index) => {
      console.log(`结果 ${index + 1} (分数: ${result.score.toFixed(4)}):`);
      console.log(`角色: ${result.charName} (${result.charId})`);
      console.log(`类型: ${result.segmentType} - ${result.title}`);
      console.log(`内容预览: ${result.contentPreview}`);
      console.log("----------------------------------------");
    });
    
  } catch (error) {
    console.error("查询失败:", error);
  }
}

// 生成内容哈希，用于缓存
function contentHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// 从缓存加载嵌入向量
async function loadEmbeddingFromCache(text: string): Promise<number[] | null> {
  const hash = contentHash(text);
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
async function saveEmbeddingToCache(text: string, embedding: number[]): Promise<void> {
  const hash = contentHash(text);
  const cachePath = path.join(CACHE_DIR, `${hash}.json`);
  
  await fs.writeFile(cachePath, JSON.stringify(embedding));
}

// 调用 API 获取嵌入向量，优先使用缓存
async function getEmbedding(text: string): Promise<number[]> {
  // 首先尝试从缓存中加载
  const cachedEmbedding = await loadEmbeddingFromCache(text);
  if (cachedEmbedding) {
    console.log("  从缓存中加载嵌入向量");
    return cachedEmbedding;
  }
  
  // 如果缓存中没有，则调用 API
  console.log("  调用 API 生成嵌入向量");
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
      await saveEmbeddingToCache(text, embedding);
      return embedding;
    } else {
      throw new Error("无法从 API 响应中获取嵌入向量");
    }
  } catch (error) {
    console.error("API 调用失败:", error);
    throw error;
  }
}

// 执行语义搜索
async function semanticSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
  try {
    // 连接到 Qdrant
    const client = new QdrantClient({ host: "localhost", port: 6333 });
    const collectionName = "arknights_segments";
    
    // 获取查询的嵌入向量
    const queryEmbedding = await getEmbedding(query);
    
    // 执行搜索
    const searchResponse = await client.query(collectionName, {
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
    console.error("搜索失败:", error);
    throw error;
  }
}

// 高级搜索函数 - 支持过滤特定角色
async function advancedSearch(
  query: string, 
  filters?: { charId?: string; segmentType?: string },
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    const client = new QdrantClient({ host: "localhost", port: 6333 });
    const collectionName = "arknights_segments";
    
    // 获取查询的嵌入向量
    const queryEmbedding = await getEmbedding(query);
    
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
    
    const searchResponse = await client.query(collectionName, searchOptions);
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
        charId: (payload?.char_id as string) || "",
        charName: (payload?.char_name as string) || "",
        segmentType: (payload?.segment_type as string) || "",
        title: (payload?.title as string) || "",
        content: content,
        contentPreview: contentPreview
      };
    });
    
    return results;
  } catch (error) {
    console.error("高级搜索失败:", error);
    throw error;
  }
}

// 比较搜索结果，显示差异
async function compareQueries(queries: string[], limit: number = 3): Promise<void> {
  console.log("比较不同查询的搜索结果:");
  
  for (const query of queries) {
    console.log(`\n查询: "${query}"`);
    const results = await semanticSearch(query, limit);
    
    console.log(`结果摘要:`);
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.charName} - ${result.title} (分数: ${result.score.toFixed(4)})`);
    });
  }
}

// 添加一个只为阿米娅搜索的专门函数
async function searchAmiya(): Promise<void> {
  const query = "阿米娅";
  console.log(`特定搜索: "${query}" (只在阿米娅的资料中搜索)`);
  
  // 使用带过滤的高级搜索
  const results = await advancedSearch(query, { charId: "char_002_amiya" }, 5);
  
  console.log(`\n找到 ${results.length} 个关于阿米娅的相关结果:\n`);
  
  results.forEach((result, index) => {
    console.log(`结果 ${index + 1} (分数: ${result.score.toFixed(4)}):`);
    console.log(`标题: ${result.title}`);
    console.log(`内容预览: ${result.contentPreview}`);
    console.log("----------------------------------------");
  });
}

// 运行测试查询
main()
//   .then(() => {
//     // 执行额外的查询比较
//     return compareQueries([
//       "阿米娅",
//       "阿米娅和博士",
//       "兔子干员"
//     ]);
//   })
//   .then(() => {
//     // 执行专门针对阿米娅的查询
//     return searchAmiya();
//   })
  .catch(console.error);