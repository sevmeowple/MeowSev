import { ToolDefinition, ToolResult } from "..";
import { z } from "zod";
import { MessageObject } from "@/utils/message";
import { imageSearch } from "@mudbill/duckduckgo-images-api";

// 图片搜索结果接口
interface ImageResult {
    height: number;
    image: string;
    image_token: string;
    source: string;
    thumbnail: string;
    thumbnail_token: string;
    title: string;
    url: string;
    width: number;
}

// 图片搜索选项接口
interface ImageSearchOptions {
    query: string;
    safe: boolean;
    iterations: number;
    retries: number;
}

// 图片质量评分函数
function scoreImage(image: ImageResult): number {
    let score = 0;
    
    // 尺寸评分 (更大的图片得分更高)
    const resolution = image.width * image.height;
    if (resolution >= 1920 * 1080) score += 3; // 1080p+
    else if (resolution >= 1280 * 720) score += 2; // 720p+
    else if (resolution >= 800 * 600) score += 1; // 基础分辨率
    
    // 宽高比评分 (避免过于奇怪的比例)
    const aspectRatio = image.width / image.height;
    if (aspectRatio >= 0.5 && aspectRatio <= 2.0) score += 1;
    
    // 图片链接质量评分
    if (image.image.includes('.jpg') || image.image.includes('.png')) score += 1;
    if (!image.image.includes('thumbnail') && !image.image.includes('thumb')) score += 1;
    
    // 避免明显的低质量来源
    if (image.source === 'Bing' || image.source === 'Google') score += 1;
    
    return score;
}

// 从图片数组中智能选择一张图片
function selectBestImage(images: ImageResult[]): ImageResult | null {
    if (!images || images.length === 0) return null;
    
    // 过滤掉明显损坏的图片链接
    const validImages = images.filter(img => 
        img.image && 
        img.width > 0 && 
        img.height > 0 &&
        (img.image.startsWith('http://') || img.image.startsWith('https://'))
    );
    
    if (validImages.length === 0) return null;
    
    // 对所有图片进行评分
    const scoredImages = validImages.map(img => ({
        image: img,
        score: scoreImage(img)
    }));
    
    // 按评分排序
    scoredImages.sort((a, b) => b.score - a.score);
    
    // 从前30%的高质量图片中随机选择一张
    const topCount = Math.max(1, Math.floor(scoredImages.length * 0.3));
    const topImages = scoredImages.slice(0, topCount);
    const randomIndex = Math.floor(Math.random() * topImages.length);
    
    return topImages[randomIndex].image;
}

// 搜索图片函数
async function searchImages(query: string): Promise<ImageResult[]> {
    try {
        console.log(`🔍 搜索图片: "${query}"`);
        
        const options: ImageSearchOptions = {
            query: query,
            safe: true,
            iterations: 1, // 获取一组结果（每组最多100张）
            retries: 2
        };
        
        const results = await imageSearch(options);
        
        if (!results || !Array.isArray(results) || results.length === 0) {
            console.warn('图片搜索返回空结果');
            return [];
        }
        
        console.log(`✅ 找到 ${results.length} 张图片`);
        return results as ImageResult[];
        
    } catch (error) {
        console.error('图片搜索失败:', error);
        return [];
    }
}

// 导出图片搜索工具
export const picTool: ToolDefinition = {
    name: 'searchImage',
    description: '搜索指定关键词的图片并随机返回一张高质量图片',
    inputSchema: z.object({
        query: z.string().describe('搜索关键词，如：pikachu、cat、landscape等')
    }),
    execute: async ({ query }: { query: string }): Promise<ToolResult> => {
        console.log(`🖼️ 图片搜索请求: ${query}`);
        
        try {
            // 搜索图片
            const images = await searchImages(query.trim());
            
            if (images.length === 0) {
                return {
                    success: false,
                    errorInfo: `未找到关键词"${query}"的相关图片`,
                    aiResponse: `抱歉，我没有找到与"${query}"相关的图片。请尝试使用其他关键词。`
                };
            }
            
            // 智能选择最佳图片
            const selectedImage = selectBestImage(images);
            
            if (!selectedImage) {
                return {
                    success: false,
                    errorInfo: `找到图片但无法选择合适的图片`,
                    aiResponse: `找到了一些图片，但质量不够好。请尝试使用更具体的搜索词。`
                };
            }
            
            console.log(`✅ 选中图片: ${selectedImage.title} (${selectedImage.width}x${selectedImage.height})`);
            
            // 构建返回消息
            const userMessages: MessageObject[] = [
                {
                    type: 'image',
                    src: selectedImage.image,
                    alt: selectedImage.title || `${query}搜索结果`
                }
            ];
            
            // AI响应信息
            const imageInfo = `分辨率: ${selectedImage.width}x${selectedImage.height}`;
            const sourceInfo = selectedImage.source ? ` | 来源: ${selectedImage.source}` : '';
            const aiResponse = `已为你找到关于"${query}"的图片！${imageInfo}${sourceInfo}`;
            
            return {
                success: true,
                responseType: 'image',
                resUrl: selectedImage.image,
                aiResponse,
                userMessages
            };
            
        } catch (error) {
            console.error('图片搜索工具执行失败:', error);
            return {
                success: false,
                errorInfo: `搜索图片时发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
                aiResponse: '抱歉，搜索图片时发生了错误，请稍后重试。'
            };
        }
    }
};