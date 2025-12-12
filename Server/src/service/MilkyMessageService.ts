import { ConfigUnionType } from "../config/config";
import { DatabaseManager } from "../config/database";
import { MilkyMessage, MilkyMessageSchema } from "../models/MilkyMessage";
import Database from "bun:sqlite";
import * as milky from '@saltify/milky-types';

/**
 * Milky消息保存服务
 * 专门处理Milky协议的消息保存和查询
 */
export class MilkyMessageService {
    private db: Database;

    constructor(config: ConfigUnionType) {
        this.db = DatabaseManager.getConnection();
        this.initializeDatabase();
    }

    /**
     * 初始化数据库表
     */
    private initializeDatabase(): void {
        try {
            // 创建Milky消息表
            this.db.exec(MilkyMessageSchema.createTable);

            // 创建索引
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_milky_messages_peer_id ON milky_messages(peer_id);
                CREATE INDEX IF NOT EXISTS idx_milky_messages_sender_id ON milky_messages(sender_id);
                CREATE INDEX IF NOT EXISTS idx_milky_messages_timestamp ON milky_messages(timestamp);
                CREATE INDEX IF NOT EXISTS idx_milky_messages_message_scene ON milky_messages(message_scene);
            `);

            console.log('✅ MilkyMessageService 数据库初始化完成');
        } catch (error) {
            console.error('❌ MilkyMessageService 数据库初始化失败:', error);
        }
    }

    /**
     * 保存Milky消息
     * @param message Milky消息对象
     * @param context 消息上下文（可选）
     */
    async saveMessage(message: milky.IncomingMessage, context?: any): Promise<MilkyMessage> {
        try {
            // 提取消息内容
            const content = this.extractTextContent(message);
            const rawContent = JSON.stringify(message);

            // 提取用户和频道信息
            const userInfo = this.extractUserInfo(message, context);
            const channelInfo = this.extractChannelInfo(message, context);

            // 判断消息类型
            const messageType = this.determineMessageType(message);

            // 构建消息数据
            const messageData: Omit<MilkyMessage, 'id' | 'created_at'> = {
                message_seq: message.message_seq,
                message_scene: message.message_scene,
                sender_id: message.sender_id,
                peer_id: message.peer_id,
                content: content,
                raw_content: rawContent,
                message_type: messageType,
                platform: 'milky',
                timestamp: message.time,
                user_name: userInfo.userName,
                channel_name: channelInfo.channelName,
                group_name: channelInfo.groupName,
                is_bot: false // 这里可以根据实际情况判断是否为Bot消息
            };

            // 保存到数据库
            const savedMessage = await this.createMessage(messageData);

            console.log(`💾 消息已保存: ${userInfo.userName} 在 ${channelInfo.channelName} 说: ${content.substring(0, 50)}...`);

            return savedMessage;
        } catch (error) {
            console.error('❌ 保存Milky消息失败:', error);
            throw error;
        }
    }

    /**
     * 查询频道最近的消息
     * @param channelId 频道ID
     * @param limit 限制数量
     * @returns 消息列表
     */
    async getRecentChannelMessages(channelId: string, limit: number = 15): Promise<MilkyMessage[]> {
        try {
            const query = this.db.query(`
                SELECT * FROM milky_messages 
                WHERE peer_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `);

            const messages = query.all(channelId, limit) as MilkyMessage[];
            return messages.reverse(); // 按时间正序返回
        } catch (error) {
            console.error('❌ 查询频道消息失败:', error);
            return [];
        }
    }

    /**
     * 查询用户最近的消息
     * @param userId 用户ID
     * @param limit 限制数量
     * @returns 消息列表
     */
    async getRecentUserMessages(userId: string, limit: number = 10): Promise<MilkyMessage[]> {
        try {
            const query = this.db.query(`
                SELECT * FROM milky_messages 
                WHERE sender_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `);

            const messages = query.all(userId, limit) as MilkyMessage[];
            return messages.reverse(); // 按时间正序返回
        } catch (error) {
            console.error('❌ 查询用户消息失败:', error);
            return [];
        }
    }

    /**
     * 创建消息记录
     */
    private async createMessage(messageData: Omit<MilkyMessage, 'id' | 'created_at'>): Promise<MilkyMessage> {
        const query = this.db.query(`
            INSERT INTO milky_messages (
                message_seq, message_scene, sender_id, peer_id, content, raw_content,
                message_type, platform, timestamp, user_name, channel_name, group_name, is_bot
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = query.run(
            messageData.message_seq,
            messageData.message_scene,
            messageData.sender_id,
            messageData.peer_id,
            messageData.content,
            messageData.raw_content || null,
            messageData.message_type,
            messageData.platform,
            messageData.timestamp,
            messageData.user_name || null,
            messageData.channel_name || null,
            messageData.group_name || null,
            messageData.is_bot || false
        );

        return {
            id: result.lastInsertRowid as number,
            ...messageData,
            created_at: new Date().toISOString()
        };
    }

    /**
     * 从Milky消息中提取文本内容
     */
    private extractTextContent(message: milky.IncomingMessage): string {
        if (!message.segments) return '';

        return message.segments
            .filter(segment => segment.type === 'text')
            .map(segment => (segment as any).data.text)
            .join(' ')
            .trim();
    }

    /**
     * 提取用户信息
     */
    private extractUserInfo(message: milky.IncomingMessage, context?: any): { userName: string } {
        // 优先从context中获取
        if (context?.sender) {
            const sender = context.sender as any;
            return {
                userName: sender.nickname || sender.card || `用户${message.sender_id}`
            };
        }

        // 从消息中获取
        if (message.segments) {
            const atSegment = message.segments.find(segment => segment.type === 'mention');
            if (atSegment) {
                return {
                    userName: (atSegment as any).data.nickname || `用户${message.sender_id}`
                };
            }
        }

        return {
            userName: `用户${message.sender_id}`
        };
    }

    /**
     * 提取频道信息
     */
    private extractChannelInfo(message: milky.IncomingMessage, context?: any): { 
        channelName: string; 
        groupName?: string; 
    } {
        // 优先从context中获取
        if (context?.group) {
            const group = context.group as any;
            return {
                channelName: group.group_name || `群${message.peer_id}`,
                groupName: group.group_name
            };
        }

        // 根据消息场景确定频道名称
        if (message.message_scene === 'group') {
            return {
                channelName: `群${message.peer_id}`,
                groupName: `群${message.peer_id}`
            };
        } else if (message.message_scene === 'friend') {
            return {
                channelName: `私聊${message.sender_id}`
            };
        } else {
            return {
                channelName: `临时会话${message.peer_id}`
            };
        }
    }

    /**
     * 判断消息类型
     */
    private determineMessageType(message: milky.IncomingMessage): string {
        if (!message.segments) return 'text';

        const segmentTypes = message.segments.map(segment => segment.type);
        
        if (segmentTypes.includes('image')) return 'image';
        if (segmentTypes.includes('reply')) return 'reply';
        if (segmentTypes.includes('mention')) return 'at';
        if (segmentTypes.includes('forward')) return 'forward';
        
        return 'text';
    }

    /**
     * 获取消息统计信息
     */
    async getMessageStats(): Promise<{
        totalMessages: number;
        groupMessages: number;
        friendMessages: number;
        tempMessages: number;
    }> {
        try {
            const totalQuery = this.db.query('SELECT COUNT(*) as count FROM milky_messages');
            const groupQuery = this.db.query('SELECT COUNT(*) as count FROM milky_messages WHERE message_scene = "group"');
            const friendQuery = this.db.query('SELECT COUNT(*) as count FROM milky_messages WHERE message_scene = "friend"');
            const tempQuery = this.db.query('SELECT COUNT(*) as count FROM milky_messages WHERE message_scene = "temp"');

            const total = (totalQuery.get() as any).count;
            const group = (groupQuery.get() as any).count;
            const friend = (friendQuery.get() as any).count;
            const temp = (tempQuery.get() as any).count;

            return {
                totalMessages: total,
                groupMessages: group,
                friendMessages: friend,
                tempMessages: temp
            };
        } catch (error) {
            console.error('❌ 获取消息统计失败:', error);
            return {
                totalMessages: 0,
                groupMessages: 0,
                friendMessages: 0,
                tempMessages: 0
            };
        }
    }

    /**
     * 清理旧消息（可选功能）
     */
    async cleanupOldMessages(daysToKeep: number = 30): Promise<number> {
        try {
            const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
            
            const query = this.db.query('DELETE FROM milky_messages WHERE timestamp < ?');
            const result = query.run(cutoffTime);
            
            console.log(`🧹 清理了 ${result.changes} 条超过 ${daysToKeep} 天的消息`);
            return result.changes;
        } catch (error) {
            console.error('❌ 清理旧消息失败:', error);
            return 0;
        }
    }
}
