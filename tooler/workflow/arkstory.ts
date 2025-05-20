import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'smol-toml';
import { getVector, getVectors, hashString } from "utils/getvector";
import { QdrantClient } from '@qdrant/js-client-rest';

// 定义路径配置
const path_ = "../plugin/arkstory/output/main";
const COLLECTION_NAME = "arkstory";
const VECTOR_SIZE = 1024; // BGE-M3 的向量维度为 1024

// 定义数据结构
interface Dialog {
    character: string;
    text: string;
}

interface ArkStory {
    header: Record<string, any>;
    intro?: string;
    dialogs: Dialog[];
    filename?: string;  // 添加文件名以便追踪
}

interface StorySegment {
    id: string;
    title: string;
    content: string;
    metadata: {
        filename: string;
        path: string;
        chapter?: string;
        section?: string;
        suffix?: string;
        characters: string[];
    };
    embedding?: number[];
}

// Qdrant 客户端
const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333'
});

/**
 * 递归查找所有 TOML 文件
 */
async function findTomlFiles(dirPath: string): Promise<string[]> {
    const files = await fs.readdir(dirPath);
    const tomlFiles: string[] = [];

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
            const subDirFiles = await findTomlFiles(filePath);
            tomlFiles.push(...subDirFiles);
        } else if (file.toLowerCase().endsWith('.toml')) {
            tomlFiles.push(filePath);
        }
    }

    return tomlFiles;
}

/**
 * 从文件路径解析故事ID和名称
 */
/**
 * 从文件路径解析故事ID和名称
 */
function parseStoryInfo(filePath: string): { storyId: string, chapter: string, section: string, suffix: string } {
    // 处理路径，获取相对路径
    const relativePath = path.relative(path_, filePath);

    // 默认值
    const basename = path.basename(filePath, '.toml');
    let storyId = basename;
    let chapter = '';
    let section = '';
    let suffix = '';

    // 尝试从路径中提取信息
    const parts = relativePath.split(path.sep);
    if (parts.length >= 1) {
        const filename = parts[parts.length - 1];
        // 匹配格式为 level_main_01-03_beg.toml 或 level_main_10_end.toml
        const match = filename.match(/level_main_(\d+)[-_](\d+)_([a-z0-9]+)\.toml/i);

        if (match) {
            chapter = match[1];
            section = match[2];
            suffix = match[3]; // 保存后缀 (beg, end 等)
            storyId = `${chapter}-${section}_${suffix}`; // 确保ID包含后缀
        } else {
            // 尝试匹配其他格式，如 level_main_10_end.toml
            const altMatch = filename.match(/level_main_(\d+)_([a-z0-9]+)\.toml/i);
            if (altMatch) {
                chapter = altMatch[1];
                suffix = altMatch[2];
                storyId = `${chapter}_${suffix}`;
            }
        }
    }

    return { storyId, chapter, section, suffix };
}

/**
 * 处理单个故事文件
 */
async function processStoryFile(filePath: string): Promise<StorySegment[]> {
    try {
        // 读取并解析TOML文件
        const content = await fs.readFile(filePath, 'utf-8');
        const storyData = parse(content) as unknown as ArkStory;

        // 添加文件名
        storyData.filename = path.basename(filePath);

        // 解析故事ID和章节信息，现在包含suffix
        const { storyId, chapter, section, suffix } = parseStoryInfo(filePath);

        // 创建段落
        const segments: StorySegment[] = [];

        // 收集出现的所有角色
        const characters = new Set<string>();
        storyData.dialogs.forEach(dialog => {
            if (dialog.character) {
                characters.add(dialog.character);
            }
        });

        // 构建标题，包括后缀信息
        let titleBase = '';
        if (chapter) titleBase += `第${chapter}章`;
        if (section) titleBase += ` 第${section}节`;
        if (suffix) {
            // 根据后缀添加适当的描述
            switch (suffix.toLowerCase()) {
                case 'beg':
                    titleBase += ' 开始';
                    break;
                case 'end':
                    titleBase += ' 结束';
                    break;
                default:
                    titleBase += ` ${suffix}`;
            }
        }

        // 创建故事介绍段落
        if (storyData.intro) {
            const introSegment: StorySegment = {
                id: `${storyId}_intro`,
                title: `${titleBase} - 故事简介`,
                content: storyData.intro,
                metadata: {
                    filename: storyData.filename,
                    path: path.relative(path_, filePath),
                    chapter,
                    section,
                    suffix, // 添加suffix到元数据
                    characters: Array.from(characters)
                }
            };
            segments.push(introSegment);
        }

        // 创建对话段落 - 将对话按每50条分组
        const DIALOGS_PER_SEGMENT = 50;
        const totalDialogs = storyData.dialogs.length;

        for (let i = 0; i < totalDialogs; i += DIALOGS_PER_SEGMENT) {
            const dialogsSlice = storyData.dialogs.slice(i, i + DIALOGS_PER_SEGMENT);
            const dialogText = dialogsSlice.map(d => `${d.character}: ${d.text}`).join('\n\n');

            const partNumber = Math.floor(i / DIALOGS_PER_SEGMENT) + 1;
            const segmentId = `${storyId}_part_${partNumber}`;

            const dialogSegment: StorySegment = {
                id: segmentId,
                title: `${titleBase} - 对话片段 ${partNumber}/${Math.ceil(totalDialogs / DIALOGS_PER_SEGMENT)}`,
                content: dialogText,
                metadata: {
                    filename: storyData.filename,
                    path: path.relative(path_, filePath),
                    chapter,
                    section,
                    suffix, // 添加suffix到元数据
                    characters: Array.from(characters)
                }
            };

            segments.push(dialogSegment);
        }

        return segments;
    } catch (error) {
        console.error(`处理文件 ${filePath} 时出错:`, error);
        return [];
    }
}
/**
 * 确保 Qdrant 集合存在
 */
async function ensureCollection(collectionName: string, vectorSize: number): Promise<void> {
    try {
        // 检查集合是否存在
        const collections = await qdrantClient.getCollections();
        const collectionExists = collections.collections.some(c => c.name === collectionName);

        if (!collectionExists) {
            console.log(`创建集合 ${collectionName}`);
            await qdrantClient.createCollection(collectionName, {
                vectors: {
                    size: vectorSize,
                    distance: 'Cosine'
                },
                optimizers_config: {
                    default_segment_number: 2
                },
                replication_factor: 1
            });

            // 创建基本索引
            console.log(`为集合创建索引`);
            await qdrantClient.createPayloadIndex(collectionName, {
                field_name: 'metadata.characters',
                field_schema: 'keyword',
                wait: true
            });

            await qdrantClient.createPayloadIndex(collectionName, {
                field_name: 'metadata.chapter',
                field_schema: 'keyword',
                wait: true
            });

            await qdrantClient.createPayloadIndex(collectionName, {
                field_name: 'metadata.section',
                field_schema: 'keyword',
                wait: true
            });

            await qdrantClient.createPayloadIndex(collectionName, {
                field_name: 'title',
                field_schema: 'text',
                wait: true
            });
        } else {
            console.log(`集合 ${collectionName} 已存在`);
        }
    } catch (error) {
        console.error('确保集合存在时出错:', error);
        throw error;
    }
}

/**
 * 检查点是否已经存在于集合中
 */
async function checkPointExists(pointId: number): Promise<boolean> {
    try {
        const points = await qdrantClient.retrieve(COLLECTION_NAME, {
            ids: [pointId],
            with_payload: false,
            with_vector: false
        });
        return points.length > 0;
    } catch (error) {
        console.error(`检查点ID ${pointId} 是否存在时出错:`, error);
        return false;
    }
}

/**
 * 处理段落并保存到 Qdrant
 */
async function processAndStoreSegments(segments: StorySegment[]): Promise<void> {
    try {
        if (segments.length === 0) return;

        // 获取所有段落的文本
        const texts = segments.map(segment => segment.content);

        // 批量获取向量
        console.log(`获取 ${texts.length} 个段落的向量...`);
        const embeddings = await getVectors(texts, { delay: 300 });

        // 添加向量到段落
        for (let i = 0; i < segments.length; i++) {
            if (embeddings[i] && embeddings[i].length > 0) {
                segments[i].embedding = embeddings[i];
            }
        }

        // 过滤掉没有成功获取向量的段落
        const validSegments = segments.filter(segment => segment.embedding && segment.embedding.length > 0);

        if (validSegments.length === 0) {
            console.warn('没有段落成功获取向量，跳过保存');
            return;
        }

        console.log(`准备保存 ${validSegments.length} 个段落到 Qdrant...`);

        // 将段落转换为 Qdrant 点
        const points = await Promise.all(validSegments.map(async segment => {
            const pointId = hashString(segment.id);

            // 检查点是否存在
            const exists = await checkPointExists(pointId);
            if (exists) {
                console.log(`跳过已存在的点ID: ${pointId} (${segment.id})`);
                return null;
            }

            return {
                id: pointId,
                vector: segment.embedding!,
                payload: {
                    id: segment.id,
                    title: segment.title,
                    content: segment.content,
                    metadata: segment.metadata
                }
            };
        }));

        // 过滤掉已存在的点
        const newPoints = points.filter(p => p !== null);

        if (newPoints.length === 0) {
            console.log('所有点都已存在，无需添加');
            return;
        }

        // 批量添加到 Qdrant
        console.log(`添加 ${newPoints.length} 个新点到 Qdrant...`);
        await qdrantClient.upsert(COLLECTION_NAME, {
            points: newPoints as any[]
        });

        console.log(`成功保存 ${newPoints.length} 个段落到 Qdrant`);
    } catch (error) {
        console.error('处理和保存段落时出错:', error);
    }
}

/**
 * 主函数
 */
async function main() {
    try {
        // 确保 Qdrant 集合存在
        await ensureCollection(COLLECTION_NAME, VECTOR_SIZE);

        // 查找所有TOML文件
        const tomlFiles = await findTomlFiles(path_);
        console.log(`找到 ${tomlFiles.length} 个TOML文件`);

        // 依次处理每个文件
        let processedFiles = 0;
        for (const filePath of tomlFiles) {
            console.log(`\n处理文件 ${++processedFiles}/${tomlFiles.length}: ${filePath}`);

            // 处理文件获取段落
            const segments = await processStoryFile(filePath);
            console.log(`- 提取了 ${segments.length} 个段落`);

            // 批量处理段落
            await processAndStoreSegments(segments);
        }

        console.log('\n全部处理完成!');
    } catch (error) {
        console.error('主程序执行出错:', error);
    }
}

// 执行主函数
main().catch(console.error);