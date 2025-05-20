import dotenv from "dotenv";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";

// 加载环境变量
dotenv.config();
const model = "BAAI/bge-m3";
const siliconflow_key = process.env.SILICONFLOW_KEY;
const CACHE_DIR = "./.embedding_cache"; // 缓存目录

// 确保缓存目录存在
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error("创建缓存目录失败:", error);
  }
}

// 初始化
ensureCacheDir();

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

/**
 * 获取文本嵌入向量
 * 先尝试从缓存获取，如果缓存不存在则调用API
 * 
 * @param text 待编码的文本
 * @param options 配置选项
 * @returns 嵌入向量
 */
export async function getVector(text: string, options?: {
  useCache?: boolean;  // 是否使用缓存，默认为true
  apiEndpoint?: string; // API端点，默认为中国区
  silent?: boolean;    // 是否静默模式，不输出日志
}): Promise<number[]> {
  if (!siliconflow_key) {
    throw new Error("SILICONFLOW_KEY 环境变量未设置");
  }

  const opts = {
    useCache: true,
    apiEndpoint: 'https://api.siliconflow.cn/v1/embeddings',
    silent: false,
    ...options
  };

  // 尝试从缓存加载
  if (opts.useCache) {
    const cachedEmbedding = await loadEmbeddingFromCache(text);
    if (cachedEmbedding) {
      if (!opts.silent) console.log("从缓存中加载嵌入向量");
      return cachedEmbedding;
    }
  }

  // 缓存中没有，调用API
  if (!opts.silent) console.log("调用API生成嵌入向量");
  
  const headers = {
    Authorization: `Bearer ${siliconflow_key}`,
    "Content-Type": "application/json"
  };

  const body = {
    model: model,
    input: text,
    encoding_format: "float"
  };

  const requestOptions = {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  };

  try {
    const response = await fetch(opts.apiEndpoint, requestOptions);
    const data = await response.json();

    if (data.code || data.error) {
      throw new Error(data.message || data.error || "API返回错误");
    }

    if (data.data && data.data[0] && data.data[0].embedding) {
      const embedding = data.data[0].embedding;
      
      // 如果使用缓存，保存到缓存
      if (opts.useCache) {
        await saveEmbeddingToCache(text, embedding);
      }
      
      return embedding;
    } else {
      throw new Error("无法从API响应中获取嵌入向量");
    }
  } catch (error) {
    console.error("API调用失败:", error);
    throw error;
  }
}

/**
 * 批量获取多个文本的嵌入向量
 * 
 * @param texts 文本数组
 * @param options 配置选项
 * @returns 嵌入向量数组
 */
export async function getVectors(texts: string[], options?: {
  useCache?: boolean;
  apiEndpoint?: string;
  silent?: boolean;
  delay?: number;      // 请求间隔延迟(毫秒)，默认为100
}): Promise<number[][]> {
  const opts = {
    delay: 100,
    ...options
  };
  
  const results: number[][] = [];
  
  for (let i = 0; i < texts.length; i++) {
    try {
      if (!opts.silent) {
        console.log(`处理文本 ${i + 1}/${texts.length}`);
      }
      
      const embedding = await getVector(texts[i], opts);
      results.push(embedding);
      
      // 除了最后一个请求，其他请求后添加延迟
      if (i < texts.length - 1 && opts.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, opts.delay));
      }
    } catch (error) {
      console.error(`获取文本 ${i + 1} 的向量失败:`, error);
      // 添加一个空数组作为占位符，保持索引一致性
      results.push([]);
    }
  }
  
  return results;
}

/**
 * 将字符串哈希为数字ID
 * 用于生成Qdrant等向量数据库的点ID
 * 
 * @param str 输入字符串
 * @returns 数字哈希值
 */
export function hashString(str: string): number {
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return parseInt(hash.substring(0, 8), 16);
}

// 如果作为主模块运行，测试API
if (require.main === module) {
  const testText = "这是一个测试文本，用于验证向量生成API是否正常工作。";
  
  (async () => {
    try {
      console.log("测试获取单个向量:");
      const embedding = await getVector(testText);
      console.log(`向量长度: ${embedding.length}`);
      console.log(`前5个元素: ${embedding.slice(0, 5).join(", ")}`);
      
      console.log("\n测试批量获取向量:");
      const texts = [
        "这是第一个测试文本。",
        "这是第二个测试文本。",
        "这是第三个测试文本。"
      ];
      const embeddings = await getVectors(texts, { delay: 500 });
      console.log(`获取了 ${embeddings.length} 个向量`);
      
      for (let i = 0; i < embeddings.length; i++) {
        if (embeddings[i].length > 0) {
          console.log(`文本 ${i + 1} 向量长度: ${embeddings[i].length}`);
        } else {
          console.log(`文本 ${i + 1} 向量获取失败`);
        }
      }
    } catch (error) {
      console.error("测试失败:", error);
    }
  })();
}