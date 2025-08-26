import { ConfigUnionType } from "@/config/config";
import { AIService } from "../AIService";
import { searchBilibiliWbi, getPageList } from "./api";
import { downloadVideo } from "./video";
import { cleanTitle } from "./utils";
import { MessageObject } from "@/utils/message";
import type { BiliSearchVideo } from "./type";
import { VideoCacheManager, VideoCacheEntry } from './cache';
import { createDetailedVideoMessage, validateVideoFile } from '@utils/videoMessage';

export class BilibiliService {
    private aiService: AIService;
    private cacheManager: VideoCacheManager;
    constructor(configUnion: ConfigUnionType) {
        this.aiService = new AIService(configUnion);
        this.cacheManager = new VideoCacheManager();
    }

    /**
     * AI 自动筛选并下载视频
     * @param keyword 搜索关键词
     * @param userRequirement 用户需求描述（可选）
     * @returns 操作结果消息
     */
    async aiAutoDownload(keyword: string, userRequirement?: string): Promise<MessageObject[]> {
        try {
            console.log(`🔍 开始搜索: ${keyword}`);

            // 1. 搜索视频
            const videos = await searchBilibiliWbi(keyword);

            if (videos.length === 0) {
                return [{
                    type: 'text',
                    content: `❌ 没有找到关键词 "${keyword}" 的相关视频`
                }];
            }

            console.log(`📺 找到 ${videos.length} 个视频结果`);

            // 2. 使用 AI 筛选最合适的视频
            const selectedVideo = await this.selectBestVideoWithAI(videos, keyword, userRequirement);

            if (!selectedVideo) {
                return [{
                    type: 'text',
                    content: `🤔 AI 无法从搜索结果中选出合适的视频，请尝试更具体的关键词`
                }];
            }

            // 3. 检查缓存
            if (this.cacheManager.hasCachedVideo(selectedVideo.bvid)) {
                const cachedVideo = this.cacheManager.getCachedVideo(selectedVideo.bvid)!;
                console.log(`💾 使用缓存视频: ${selectedVideo.bvid}`);

                // 验证缓存文件
                const validation = validateVideoFile(cachedVideo.filePath);
                if (validation.isValid) {
                    return createDetailedVideoMessage(
                        cachedVideo.filePath,
                        cachedVideo.title,
                        cachedVideo.author,
                        cachedVideo.bvid,
                        cachedVideo.fileSize,
                        cachedVideo.quality,
                        cachedVideo.format
                    );
                } else {
                    console.warn(`⚠️ 缓存文件无效，重新下载: ${validation.error}`);
                    this.cacheManager.removeFromCache(selectedVideo.bvid);
                }
            }

            // 4. 下载新视频
            return await this.downloadAndCacheVideo(selectedVideo);

        } catch (error) {
            console.error('BilibiliService aiAutoDownload 错误:', error);
            return [{
                type: 'text',
                content: `❌ 处理过程中出现错误: ${error instanceof Error ? error.message : String(error)}`
            }];
        }
    }


    /**
     * 下载视频并添加到缓存
     */
    private async downloadAndCacheVideo(video: BiliSearchVideo): Promise<MessageObject[]> {
        try {
            // 获取视频详细信息
            const pageList = await getPageList(video.bvid);
            if (pageList.code !== 0 || pageList.data.length === 0) {
                return [{
                    type: 'text',
                    content: `❌ 获取视频 ${video.bvid} 的详细信息失败`
                }];
            }

            const firstPage = pageList.data[0];

            // 下载视频
            console.log(`⬇️ 开始下载: ${cleanTitle(video.title)}`);

            const downloadResult = await downloadVideo(
                video.bvid,
                firstPage.cid,
                video.title,
                'downloads'
            );

            if (downloadResult.success && downloadResult.outputPath) {
                // 添加到缓存
                const cacheEntry: VideoCacheEntry = {
                    bvid: video.bvid,
                    title: cleanTitle(video.title),
                    filePath: downloadResult.outputPath,
                    fileSize: downloadResult.fileSize || 'Unknown',
                    quality: downloadResult.quality || 0,
                    format: downloadResult.format || 'Unknown',
                    downloadTime: Date.now(),
                    author: video.author,
                    play: video.play
                };

                this.cacheManager.addToCache(cacheEntry);

                // 返回视频消息
                return createDetailedVideoMessage(
                    downloadResult.outputPath,
                    cleanTitle(video.title),
                    video.author,
                    video.bvid,
                    downloadResult.fileSize || 'Unknown',
                    downloadResult.quality || 0,
                    downloadResult.format || 'Unknown'
                );
            } else {
                return [{
                    type: 'text',
                    content: `❌ 下载失败: ${downloadResult.error}`
                }];
            }

        } catch (error) {
            return [{
                type: 'text',
                content: `❌ 下载过程中出现错误: ${error instanceof Error ? error.message : String(error)}`
            }];
        }
    }

    /**
     * 使用 AI 从视频列表中选择最合适的视频
     * @param videos 视频列表
     * @param keyword 搜索关键词
     * @param userRequirement 用户需求
     * @returns 选中的视频或null
     */
    private async selectBestVideoWithAI(
        videos: BiliSearchVideo[],
        keyword: string,
        userRequirement?: string
    ): Promise<BiliSearchVideo | null> {
        try {
            // 构造 AI 提示词
            const systemPrompt = `你是一个视频筛选助手。用户搜索了关键词，你需要从搜索结果中选择最合适的视频。

筛选标准：
1. 标题与关键词的相关性
2. 播放量（高播放量通常质量更好）
3. 视频描述的相关性
4. UP主是否可信（官方、知名UP等）
5. 用户的具体需求

请返回JSON格式：
{
    "selectedIndex": 数字（0-${videos.length - 1}），
    "reason": "选择理由"
}

如果所有视频都不合适，返回：
{
    "selectedIndex": -1,
    "reason": "不合适的原因"
}`;

            // 构造视频信息摘要
            const videoSummary = videos.map((video, index) => ({
                index,
                title: cleanTitle(video.title),
                author: video.author,
                play: video.play,
                duration: video.duration,
                description: video.description || '无描述',
                bvid: video.bvid
            }));

            const userPrompt = `搜索关键词: "${keyword}"
${userRequirement ? `用户具体需求: "${userRequirement}"` : ''}

搜索结果：
${videoSummary.map(v =>
                `${v.index}. 【${v.title}】
   UP主: ${v.author}
   播放量: ${v.play}
   时长: ${v.duration}
   描述: ${v.description.slice(0, 100)}${v.description.length > 100 ? '...' : ''}
   BVID: ${v.bvid}`
            ).join('\n\n')}

请选择最合适的视频。`;

            // 调用 AI
            const aiResponse = await this.aiService.generateJsonResponse<{
                selectedIndex: number;
                reason: string;
            }>(userPrompt, systemPrompt);

            console.log(`🤖 AI 选择结果: ${JSON.stringify(aiResponse)}`);

            if (aiResponse.selectedIndex >= 0 && aiResponse.selectedIndex < videos.length) {
                const selected = videos[aiResponse.selectedIndex];
                console.log(`✅ AI 选择了视频: ${cleanTitle(selected.title)} (${aiResponse.reason})`);
                return selected;
            } else {
                console.log(`❌ AI 未选择任何视频: ${aiResponse.reason}`);
                return null;
            }

        } catch (error) {
            console.error('AI 筛选视频失败:', error);
            // 降级策略：选择播放量最高的视频
            console.log('🔄 降级策略: 选择播放量最高的视频');
            return videos.reduce((max, current) =>
                current.play > max.play ? current : max
            );
        }
    }

    /**
     * 手动筛选视频（预留接口）
     * @param keyword 搜索关键词
     * @returns 搜索结果列表
     */
    async manualSearch(keyword: string): Promise<MessageObject[]> {
        try {
            const videos = await searchBilibiliWbi(keyword);

            if (videos.length === 0) {
                return [{
                    type: 'text',
                    content: `❌ 没有找到关键词 "${keyword}" 的相关视频`
                }];
            }

            // 格式化搜索结果供用户选择
            const resultText = videos.slice(0, 10).map((video, index) =>
                `${index + 1}. 【${cleanTitle(video.title)}】\n` +
                `   👤 UP主: ${video.author}\n` +
                `   👀 播放量: ${video.play}\n` +
                `   ⏱️ 时长: ${video.duration}\n` +
                `   🆔 BVID: ${video.bvid}\n`
            ).join('\n');

            return [{
                type: 'text',
                content: `🔍 搜索到 ${videos.length} 个结果（显示前10个）：\n\n${resultText}\n\n💡 请回复对应数字选择要下载的视频，或使用AI自动筛选功能。`
            }];

        } catch (error) {
            console.error('BilibiliService manualSearch 错误:', error);
            return [{
                type: 'text',
                content: `❌ 搜索失败: ${error instanceof Error ? error.message : String(error)}`
            }];
        }
    }

    /**
     * 根据BVID直接下载视频（支持缓存）
     */
    async downloadByBvid(bvid: string): Promise<MessageObject[]> {
        try {
            // 检查缓存
            if (this.cacheManager.hasCachedVideo(bvid)) {
                const cachedVideo = this.cacheManager.getCachedVideo(bvid)!;
                console.log(`💾 使用缓存视频: ${bvid}`);

                const validation = validateVideoFile(cachedVideo.filePath);
                if (validation.isValid) {
                    return createDetailedVideoMessage(
                        cachedVideo.filePath,
                        cachedVideo.title,
                        cachedVideo.author,
                        cachedVideo.bvid,
                        cachedVideo.fileSize,
                        cachedVideo.quality,
                        cachedVideo.format
                    );
                } else {
                    console.warn(`⚠️ 缓存文件无效，重新下载: ${validation.error}`);
                    this.cacheManager.removeFromCache(bvid);
                }
            }

            // 获取视频信息
            const pageList = await getPageList(bvid);
            if (pageList.code !== 0 || pageList.data.length === 0) {
                return [{
                    type: 'text',
                    content: `❌ 获取视频 ${bvid} 的信息失败`
                }];
            }

            const firstPage = pageList.data[0];
            const title = firstPage.part || 'Unknown';

            // 下载视频
            const downloadResult = await downloadVideo(bvid, firstPage.cid, title, 'downloads');

            if (downloadResult.success && downloadResult.outputPath) {
                // 添加到缓存
                const cacheEntry: VideoCacheEntry = {
                    bvid,
                    title: cleanTitle(title),
                    filePath: downloadResult.outputPath,
                    fileSize: downloadResult.fileSize || 'Unknown',
                    quality: downloadResult.quality || 0,
                    format: downloadResult.format || 'Unknown',
                    downloadTime: Date.now(),
                    author: 'Unknown',
                    play: 0
                };

                this.cacheManager.addToCache(cacheEntry);

                return createDetailedVideoMessage(
                    downloadResult.outputPath,
                    cleanTitle(title),
                    'Unknown',
                    bvid,
                    downloadResult.fileSize || 'Unknown',
                    downloadResult.quality || 0,
                    downloadResult.format || 'Unknown'
                );
            } else {
                return [{
                    type: 'text',
                    content: `❌ 下载失败: ${downloadResult.error}`
                }];
            }

        } catch (error) {
            console.error('BilibiliService downloadByBvid 错误:', error);
            return [{
                type: 'text',
                content: `❌ 下载失败: ${error instanceof Error ? error.message : String(error)}`
            }];
        }
    }

    /**
   * 获取缓存统计信息
   */
    getCacheStats(): MessageObject[] {
        const stats = this.cacheManager.getCacheStats();

        if (stats.totalVideos === 0) {
            return [{
                type: 'text',
                content: '📊 视频缓存统计\n\n💾 缓存视频: 0 个\n📁 总大小: 0 MB\n\n暂无缓存视频'
            }];
        }

        let content = `📊 视频缓存统计\n\n💾 缓存视频: ${stats.totalVideos} 个\n📁 总大小: ${stats.totalSize}`;

        if (stats.oldestVideo) {
            content += `\n\n📅 最早缓存: ${stats.oldestVideo.title}`;
        }

        if (stats.newestVideo) {
            content += `\n📅 最新缓存: ${stats.newestVideo.title}`;
        }

        return [{
            type: 'text',
            content
        }];
    }

    /**
     * 清理无效缓存
     */
    cleanupCache(): MessageObject[] {
        const removedCount = this.cacheManager.cleanupInvalidCache();

        return [{
            type: 'text',
            content: `🧹 缓存清理完成\n\n清理了 ${removedCount} 个无效缓存条目`
        }];
    }

}