import * as fs from 'fs';
import * as path from 'path';

export interface VideoCacheEntry {
    bvid: string;
    title: string;
    filePath: string;
    fileSize: string;
    quality: number;
    format: string;
    downloadTime: number;
    author: string;
    play: number;
}

export class VideoCacheManager {
    private cacheFilePath: string;
    private downloadDir: string;
    private cache: Map<string, VideoCacheEntry> = new Map();

    constructor(downloadDir: string = 'downloads', cacheFile: string = 'video_cache.json') {
        this.downloadDir = path.resolve(downloadDir);
        this.cacheFilePath = path.join(this.downloadDir, cacheFile);
        this.loadCache();
    }

     /**
     * 加载缓存文件
     */
    private loadCache(): void {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const fileContent = fs.readFileSync(this.cacheFilePath, 'utf-8').trim();
                
                // 检查文件是否为空或只包含空白字符
                if (!fileContent) {
                    console.log('📋 缓存文件为空，初始化新的缓存');
                    this.cache = new Map();
                    return;
                }

                const cacheData = JSON.parse(fileContent);
                this.cache = new Map(Object.entries(cacheData));
                console.log(`📋 加载视频缓存: ${this.cache.size} 个条目`);
            } else {
                console.log('📋 缓存文件不存在，创建新的缓存');
                this.cache = new Map();
            }
        } catch (error) {
            console.warn('⚠️ 加载视频缓存失败:', error);
            console.log('📋 重置为空缓存');
            this.cache = new Map();
            // 重新保存一个空的缓存文件
            this.saveCache();
        }
    }

    /**
     * 保存缓存到文件
     */
    private saveCache(): void {
        try {
            if (!fs.existsSync(this.downloadDir)) {
                fs.mkdirSync(this.downloadDir, { recursive: true });
            }
            
            const cacheData = Object.fromEntries(this.cache);
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            console.error('❌ 保存视频缓存失败:', error);
        }
    }

    /**
     * 检查视频是否已缓存（文件存在且有效）
     */
    hasCachedVideo(bvid: string): boolean {
        const entry = this.cache.get(bvid);
        if (!entry) return false;

        // 检查文件是否仍然存在
        if (!fs.existsSync(entry.filePath)) {
            this.cache.delete(bvid);
            this.saveCache();
            return false;
        }

        return true;
    }

    /**
     * 获取缓存的视频信息
     */
    getCachedVideo(bvid: string): VideoCacheEntry | null {
        return this.cache.get(bvid) || null;
    }

    /**
     * 添加视频到缓存
     */
    addToCache(entry: VideoCacheEntry): void {
        this.cache.set(entry.bvid, entry);
        this.saveCache();
        console.log(`💾 视频已添加到缓存: ${entry.bvid} - ${entry.title}`);
    }

    /**
     * 清理无效缓存（文件不存在的条目）
     */
    cleanupInvalidCache(): number {
        let removedCount = 0;
        
        for (const [bvid, entry] of this.cache.entries()) {
            if (!fs.existsSync(entry.filePath)) {
                this.cache.delete(bvid);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            this.saveCache();
            console.log(`🧹 清理了 ${removedCount} 个无效缓存条目`);
        }

        return removedCount;
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats(): {
        totalVideos: number;
        totalSize: string;
        oldestVideo?: VideoCacheEntry;
        newestVideo?: VideoCacheEntry;
    } {
        if (this.cache.size === 0) {
            return { totalVideos: 0, totalSize: '0 MB' };
        }

        let totalBytes = 0;
        let oldest: VideoCacheEntry | undefined;
        let newest: VideoCacheEntry | undefined;

        for (const entry of this.cache.values()) {
            // 计算总大小（假设 fileSize 格式为 "XX.XX MB"）
            const sizeMatch = entry.fileSize.match(/(\d+\.?\d*)/);
            if (sizeMatch) {
                totalBytes += parseFloat(sizeMatch[1]);
            }

            if (!oldest || entry.downloadTime < oldest.downloadTime) {
                oldest = entry;
            }
            if (!newest || entry.downloadTime > newest.downloadTime) {
                newest = entry;
            }
        }

        return {
            totalVideos: this.cache.size,
            totalSize: `${totalBytes.toFixed(2)} MB`,
            oldestVideo: oldest,
            newestVideo: newest
        };
    }

    /**
     * 删除指定视频的缓存和文件
     */
    removeFromCache(bvid: string): boolean {
        const entry = this.cache.get(bvid);
        if (!entry) return false;

        try {
            if (fs.existsSync(entry.filePath)) {
                fs.unlinkSync(entry.filePath);
            }
            this.cache.delete(bvid);
            this.saveCache();
            console.log(`🗑️ 已删除缓存视频: ${bvid} - ${entry.title}`);
            return true;
        } catch (error) {
            console.error(`❌ 删除缓存视频失败 ${bvid}:`, error);
            return false;
        }
    }
}