import { MessageObject } from "../../utils/message";
import dayjs, { Dayjs } from "dayjs";
import ms from "ms";

export interface TimerTask {
    id: string;
    name: string;
    description: string;
    callback: () => void | Promise<void>;
    triggerAt?: Dayjs; // 指定日期触发
    interval?: number; // 间隔时间触发（毫秒）
    isActive: boolean;
    createdAt: Dayjs;
    lastTriggered?: Dayjs;
    nextTrigger?: Dayjs;
}

export class TimerService {
    private tasks: Map<string, TimerTask> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();

    /**
     * 创建定时任务
     * @param name 任务名称
     * @param description 任务描述
     * @param callback 回调函数
     * @param triggerAt 指定触发时间（可选）
     * @param interval 间隔时间（可选，支持 ms 格式如 '5m', '1h', '30s'）
     * @returns MessageObject 格式的结果消息
     */
    createTask(
        name: string,
        description: string,
        callback: () => void | Promise<void>,
        triggerAt?: string | Date | Dayjs,
        interval?: ms.StringValue | number
    ): MessageObject {
        try {
            const taskId = this.generateId();
            let parsedTriggerAt: Dayjs | undefined;
            let parsedInterval: number | undefined;

            // 解析触发时间
            if (triggerAt) {
                if (typeof triggerAt === 'string') {
                    parsedTriggerAt = dayjs(triggerAt);
                } else if (triggerAt instanceof Date) {
                    parsedTriggerAt = dayjs(triggerAt);
                } else {
                    parsedTriggerAt = triggerAt;
                }

                if (!parsedTriggerAt.isValid()) {
                    return {
                        type: "text",
                        content: "❌ 无效的触发时间格式"
                    };
                }

                if (parsedTriggerAt.isBefore(dayjs())) {
                    return {
                        type: "text",
                        content: "❌ 触发时间不能早于当前时间"
                    };
                }
            }

            // 解析间隔时间
            if (interval) {
                if (typeof interval === 'string') {
                    const parsed = ms(interval);
                    if (parsed === undefined || parsed === null || Number.isNaN(parsed)) {
                        return {
                            type: "text",
                            content: "❌ 无效的间隔时间格式，请使用如 '5m', '1h', '30s' 的格式"
                        };
                    }
                    parsedInterval = parsed;
                } else {
                    parsedInterval = interval;
                }

                if (parsedInterval <= 0) {
                    return {
                        type: "text",
                        content: "❌ 间隔时间必须大于 0"
                    };
                }
            }

            // 至少需要指定一种触发方式
            if (!parsedTriggerAt && !parsedInterval) {
                return {
                    type: "text",
                    content: "❌ 必须指定触发时间或间隔时间"
                };
            }

            const task: TimerTask = {
                id: taskId,
                name,
                description,
                callback,
                triggerAt: parsedTriggerAt,
                interval: parsedInterval,
                isActive: true,
                createdAt: dayjs(),
                nextTrigger: parsedTriggerAt || (parsedInterval ? dayjs().add(parsedInterval, 'millisecond') : undefined)
            };

            this.tasks.set(taskId, task);
            this.scheduleTask(task);

            const triggerInfo = parsedTriggerAt
                ? `时间: ${parsedTriggerAt.format('YYYY-MM-DD HH:mm:ss')}`
                : `间隔: ${parsedInterval ? ms(parsedInterval, { long: true }) : '未知'}`;

            return {
                type: "text",
                content: `✅ 定时任务创建成功\n📋 任务ID: ${taskId}\n🏷️ 名称: ${name}\n📝 描述: ${description}\n⏰ ${triggerInfo}`
            };

        } catch (error) {
            console.error('TimerService createTask error:', error);
            return {
                type: "text",
                content: "❌ 创建定时任务时出现错误"
            };
        }
    }

    /**
     * 获取所有任务列表
     * @returns MessageObject 格式的任务列表
     */
    getTasks(): MessageObject {
        try {
            if (this.tasks.size === 0) {
                return {
                    type: "text",
                    content: "📋 暂无定时任务"
                };
            }

            const taskList = Array.from(this.tasks.values()).map(task => {
                const status = task.isActive ? "🟢 运行中" : "🔴 已停止";
                const triggerInfo = task.triggerAt
                    ? `指定时间: ${task.triggerAt.format('YYYY-MM-DD HH:mm:ss')}`
                    : `间隔: ${ms(task.interval!, { long: true })}`;
                const nextTrigger = task.nextTrigger
                    ? `下次触发: ${task.nextTrigger.format('YYYY-MM-DD HH:mm:ss')}`
                    : '';

                return `📋 ${task.name} (${task.id})\n   ${status}\n   📝 ${task.description}\n   ⏰ ${triggerInfo}\n   ${nextTrigger}`;
            }).join('\n\n');

            return {
                type: "text",
                content: `📋 定时任务列表：\n\n${taskList}`
            };

        } catch (error) {
            console.error('TimerService getTasks error:', error);
            return {
                type: "text",
                content: "❌ 获取任务列表时出现错误"
            };
        }
    }

    /**
     * 停止任务
     * @param taskId 任务ID
     * @returns MessageObject 格式的结果消息
     */
    stopTask(taskId: string): MessageObject {
        try {
            const task = this.tasks.get(taskId);
            if (!task) {
                return {
                    type: "text",
                    content: `❌ 未找到任务 ID: ${taskId}`
                };
            }

            if (!task.isActive) {
                return {
                    type: "text",
                    content: `⚠️ 任务 "${task.name}" 已经是停止状态`
                };
            }

            task.isActive = false;
            this.clearTimer(taskId);

            return {
                type: "text",
                content: `⏹️ 任务 "${task.name}" 已停止`
            };

        } catch (error) {
            console.error('TimerService stopTask error:', error);
            return {
                type: "text",
                content: "❌ 停止任务时出现错误"
            };
        }
    }

    /**
     * 启动任务
     * @param taskId 任务ID
     * @returns MessageObject 格式的结果消息
     */
    startTask(taskId: string): MessageObject {
        try {
            const task = this.tasks.get(taskId);
            if (!task) {
                return {
                    type: "text",
                    content: `❌ 未找到任务 ID: ${taskId}`
                };
            }

            if (task.isActive) {
                return {
                    type: "text",
                    content: `⚠️ 任务 "${task.name}" 已经在运行中`
                };
            }

            // 检查单次任务是否已过期
            if (task.triggerAt && !task.interval && task.triggerAt.isBefore(dayjs())) {
                return {
                    type: "text",
                    content: `⚠️ 任务 "${task.name}" 的触发时间已过期，无法重新启动`
                };
            }

            task.isActive = true;
            this.scheduleTask(task);

            return {
                type: "text",
                content: `▶️ 任务 "${task.name}" 已启动`
            };

        } catch (error) {
            console.error('TimerService startTask error:', error);
            return {
                type: "text",
                content: "❌ 启动任务时出现错误"
            };
        }
    }

    /**
     * 删除任务
     * @param taskId 任务ID
     * @returns MessageObject 格式的结果消息
     */
    deleteTask(taskId: string): MessageObject {
        try {
            const task = this.tasks.get(taskId);
            if (!task) {
                return {
                    type: "text",
                    content: `❌ 未找到任务 ID: ${taskId}`
                };
            }

            this.clearTimer(taskId);
            this.tasks.delete(taskId);

            return {
                type: "text",
                content: `🗑️ 任务 "${task.name}" 已删除`
            };

        } catch (error) {
            console.error('TimerService deleteTask error:', error);
            return {
                type: "text",
                content: "❌ 删除任务时出现错误"
            };
        }
    }

    /**
     * 调度任务
     */
    private scheduleTask(task: TimerTask): void {
        if (!task.isActive) return;

        this.clearTimer(task.id);

        let delay: number;

        if (task.triggerAt && task.triggerAt.isAfter(dayjs())) {
            // 指定时间触发
            delay = task.triggerAt.diff(dayjs());
            task.nextTrigger = task.triggerAt;
        } else if (task.interval) {
            // 间隔时间触发
            delay = task.interval;
            task.nextTrigger = dayjs().add(task.interval, 'millisecond');
        } else {
            return;
        }

        const timer = setTimeout(async () => {
            if (!task.isActive) return;

            try {
                await task.callback();
                task.lastTriggered = dayjs();

                // 如果是间隔任务，继续调度下一次
                if (task.interval && task.isActive) {
                    this.scheduleTask(task);
                } else {
                    // 单次任务执行完成后自动停止
                    task.isActive = false;
                    task.nextTrigger = undefined;
                }
            } catch (error) {
                console.error(`Timer task "${task.name}" execution error:`, error);
            }
        }, delay);

        this.timers.set(task.id, timer);
    }

    /**
     * 清除定时器
     */
    private clearTimer(taskId: string): void {
        const timer = this.timers.get(taskId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(taskId);
        }
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 清理所有任务
     */
    cleanup(): void {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.tasks.clear();
    }
}