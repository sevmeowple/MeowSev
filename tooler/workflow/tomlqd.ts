import { parse, stringify } from "smol-toml";
import * as fs from "fs/promises";
import * as path from "path";
import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";
import * as crypto from "crypto";

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

// 数据段类型定义
type DataSegment = {
    id: string;
    charId: string;
    charName: string;
    segmentType: string;
    title: string;
    content: string;
    embedding?: number[];
};

async function main() {
    try {
        // 确保缓存目录存在
        await fs.mkdir(CACHE_DIR, { recursive: true });

        const dir = "../gotool/output";
        await processDirectory(dir);

    } catch (error) {
        console.error("处理失败:", error);
    }
}

// 将角色数据分段处理
function segmentCharacterData(data: any): DataSegment[] {
    // 已有的实现，保持不变
    const segments: DataSegment[] = [];
    const charId = data.char_id || "";
    const charName = data.char_name || "Unknown";

    // 基本信息段落
    const basicInfo = [
        `角色ID: ${charId}`,
        `角色名称: ${charName}`,
        `限定角色: ${data.is_limited ? '是' : '否'}`
    ].join("\n");

    segments.push({
        id: `${charId}_basic`,
        charId,
        charName,
        segmentType: "basic_info",
        title: "基本信息",
        content: basicInfo
    });

    // 故事段落
    if (Array.isArray(data.story_text_audio)) {
        data.story_text_audio.forEach((section: any, sectionIndex: number) => {
            if (!section.story_title || !Array.isArray(section.stories)) return;

            section.stories.forEach((story: any, storyIndex: number) => {
                if (!story.story_text) return;

                segments.push({
                    id: `${charId}_story_${sectionIndex}_${storyIndex}`,
                    charId,
                    charName,
                    segmentType: "story",
                    title: section.story_title,
                    content: story.story_text
                });
            });
        });
    }

    return segments;
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

// 检查点是否已经存在于集合中
async function checkPointExists(client: QdrantClient, collectionName: string, pointId: number): Promise<boolean> {
    try {
        const response = await client.retrieve(collectionName, {
            ids: [pointId],
            with_payload: false,  // 我们只需要知道点是否存在，不需要载荷数据
            with_vector: false    // 不需要向量数据
        });

        return response.length > 0;
    } catch (error) {
        console.error("检查点存在性失败:", error);
        return false;  // 如有错误，假设点不存在
    }
}

// 存储段落到 Qdrant，添加检查避免重复
async function storeSegmentsToQdrant(segments: DataSegment[]): Promise<void> {
    try {
        const client = new QdrantClient({ host: "localhost", port: 6333 });
        const collectionName = "arknights_segments";

        // 创建或确认集合存在
        try {
            const vectorSize = segments.find(s => s.embedding)?.embedding?.length || 0;
            if (vectorSize === 0) throw new Error("没有可用的嵌入向量");

            await client.createCollection(collectionName, {
                vectors: {
                    size: vectorSize,
                    distance: "Cosine"
                }
            });
            console.log("创建集合成功");
        } catch (err) {
            // 集合可能已存在
        }

        // 准备批量上传点
        const pointsToAdd = [];
        let skippedPoints = 0;

        for (const segment of segments) {
            if (!segment.embedding || segment.embedding.length === 0) continue;

            const pointId = hashString(segment.id);

            // 检查点是否已经存在
            const exists = await checkPointExists(client, collectionName, pointId);
            if (exists) {
                console.log(`  跳过已存在的点: ${segment.id}`);
                skippedPoints++;
                continue;
            }

            // 添加新点
            pointsToAdd.push({
                id: pointId,
                vector: segment.embedding,
                payload: {
                    segment_id: segment.id,
                    char_id: segment.charId,
                    char_name: segment.charName,
                    segment_type: segment.segmentType,
                    title: segment.title,
                    content: segment.content
                }
            });
        }

        // 批量上传新点
        if (pointsToAdd.length > 0) {
            await client.upsert(collectionName, {
                wait: true,
                points: pointsToAdd
            });
            console.log(`成功存储 ${pointsToAdd.length} 个段落 (跳过了 ${skippedPoints} 个已存在段落)`);
        } else {
            console.log(`没有新段落需要存储 (跳过了 ${skippedPoints} 个已存在段落)`);
        }

    } catch (error) {
        console.error("存储到 Qdrant 失败:", error);
        throw error;
    }
}

// 将字符串转换为数字ID
function hashString(str: string): number {
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
}

// 处理目录中的所有TOML文件
async function processDirectory(directory: string): Promise<void> {
    try {
        const files = await fs.readdir(directory);
        const tomlFiles = files.filter(file => file.toLowerCase().endsWith('.toml'));

        console.log(`找到 ${tomlFiles.length} 个TOML文件`);

        let processed = 0;
        let successful = 0;
        let failed = 0;

        // 处理每个文件
        for (const file of tomlFiles) {  // 测试时可以限制数量
            try {
                console.log(`[${++processed}/${tomlFiles.length}] 处理文件: ${file}`);
                const filePath = `${directory}/${file}`;

                const fileContent = await fs.readFile(filePath, "utf8");
                const parsedData = parse(fileContent);
                const segments = segmentCharacterData(parsedData);
                console.log(`  生成了 ${segments.length} 个数据段`);

                // 为每个段生成嵌入向量
                for (let i = 0; i < segments.length; i++) {
                    try {
                        const segment = segments[i];
                        segment.embedding = await getEmbedding(segment.content);
                        console.log(`  处理段落 ${i + 1}/${segments.length}: ${segment.title}`);

                        if (i < segments.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100)); // 使用缓存后可以减少延迟
                        }
                    } catch (err) {
                        console.error(`  段落处理失败:`, err);
                    }
                }

                await storeSegmentsToQdrant(segments);
                successful++;

            } catch (error) {
                failed++;
                console.error(`  文件 ${file} 处理失败:`, error);
            }

            // 进度信息
            const progress = (processed / tomlFiles.length * 100).toFixed(2);
            console.log(`进度: ${progress}% (成功: ${successful}, 失败: ${failed})`);
        }

        console.log(`处理完成! 总计: ${processed}, 成功: ${successful}, 失败: ${failed}`);

    } catch (error) {
        console.error("处理目录失败:", error);
    }
}

// 运行主函数
main().catch(console.error);