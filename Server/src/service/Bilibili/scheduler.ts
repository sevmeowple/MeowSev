import { TimerService } from '../Base/TimerService';
import { VideoCacheManager } from './cache';
import dayjs from 'dayjs';

/**
 * Bilibili 视频缓存定时清理服务
 * 每日 7:00 自动清理超过2天的视频缓存
 */
export class BilibiliCacheScheduler {
    private timerService: TimerService;
    private cacheManager: VideoCacheManager;
    private readonly CLEANUP_HOUR = 7; // 每天7点执行
    private readonly MAX_AGE_DAYS = 2; // 保留2天

    constructor() {
        this.timerService = new TimerService();
        this.cacheManager = new VideoCacheManager();
    }

    /**
     * 启动定时清理任务
     */
    start(): void {
        // 计算下一次7:00的时间
        const nextTrigger = this.calculateNext7AM();
        
        console.log(`📅 Bilibili缓存清理任务已注册`);
        console.log(`   ⏰ 下次执行时间: ${nextTrigger.format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`   📁 保留期限: ${this.MAX_AGE_DAYS}天`);

        // 创建每日循环任务
        this.timerService.createTask(
            'bilibili-cache-cleanup',
            `每日${this.CLEANUP_HOUR}:00清理超过${this.MAX_AGE_DAYS}天的B站视频缓存`,
            () => this.runCleanup(),
            nextTrigger.toDate(),
            '24h' // 每24小时执行一次
        );

        // 启动时也执行一次清理（可选）
        console.log(`🔄 启动时执行一次缓存清理...`);
        this.runCleanup();
    }

    /**
     * 计算下一次7:00的时间
     */
    private calculateNext7AM(): dayjs.Dayjs {
        const now = dayjs();
        let next7AM = now.hour(this.CLEANUP_HOUR).minute(0).second(0).millisecond(0);
        
        // 如果今天7点已过，则设置为明天7点
        if (next7AM.isBefore(now)) {
            next7AM = next7AM.add(1, 'day');
        }
        
        return next7AM;
    }

    /**
     * 执行清理任务
     */
    private runCleanup(): void {
        console.log(`\n🧹 [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 开始执行Bilibili缓存清理...`);
        
        try {
            // 清理过期视频
            const expiredCount = this.cacheManager.cleanupExpiredCache(this.MAX_AGE_DAYS);
            
            // 同时清理无效缓存（文件已不存在的条目）
            const invalidCount = this.cacheManager.cleanupInvalidCache();
            
            console.log(`✅ 清理完成: ${expiredCount}个过期 + ${invalidCount}个无效`);
        } catch (error) {
            console.error('❌ 缓存清理失败:', error);
        }
    }

    /**
     * 停止定时任务
     */
    stop(): void {
        this.timerService.cleanup();
        console.log('⏹️ Bilibili缓存清理任务已停止');
    }

    /**
     * 手动触发清理
     */
    manualCleanup(): number {
        console.log('🔧 手动触发缓存清理...');
        return this.cacheManager.cleanupExpiredCache(this.MAX_AGE_DAYS);
    }
}

// 导出单例
let schedulerInstance: BilibiliCacheScheduler | null = null;

export function startBilibiliCacheScheduler(): BilibiliCacheScheduler {
    if (!schedulerInstance) {
        schedulerInstance = new BilibiliCacheScheduler();
        schedulerInstance.start();
    }
    return schedulerInstance;
}

export function getBilibiliCacheScheduler(): BilibiliCacheScheduler | null {
    return schedulerInstance;
}
