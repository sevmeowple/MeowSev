import { MessageResult, MessageResultUtils } from './MessageResult';
import * as milky from '@saltify/milky-types';

/**
 * 消息适配器
 * 负责在不同消息格式之间进行转换
 */
export class MessageAdapter {
    /**
     * 将新协议消息转换为内部格式
     * @param milkyMessage 来自MilkyClient的消息
     * @returns 内部消息格式
     */
    static fromMilkyMessage(milkyMessage: milky.IncomingMessage): InternalMessage {
        const data = milkyMessage;
        
        // 根据消息场景提取不同的信息
        let sender: any = {};
        let group: any = undefined;
        
        if (data.message_scene === 'group') {
            const groupMsg = data as any;
            sender = {
                user_id: data.sender_id,
                nickname: groupMsg.group_member?.nickname || 'Unknown',
                role: groupMsg.group_member?.role || 'member',
                group_id: data.peer_id,
                card: groupMsg.group_member?.card,
                title: groupMsg.group_member?.title,
                level: groupMsg.group_member?.level,
                join_time: groupMsg.group_member?.join_time,
                last_sent_time: groupMsg.group_member?.last_sent_time
            };
            group = groupMsg.group ? {
                group_id: groupMsg.group.group_id,
                group_name: groupMsg.group.group_name,
                member_count: groupMsg.group.member_count,
                max_member_count: groupMsg.group.max_member_count
            } : undefined;
        } else if (data.message_scene === 'friend') {
            const friendMsg = data as any;
            sender = {
                user_id: data.sender_id,
                nickname: friendMsg.friend?.nickname || 'Unknown',
                role: 'friend'
            };
        }
        
        return {
            id: data.message_seq,
            type: 'message_receive',
            scene: data.message_scene,
            sender,
            group,
            content: this.parseSegments(data.segments || []),
            timestamp: data.time,
            raw: milkyMessage
        };
    }

    /**
     * 将内部消息格式转换为发送格式
     * @param message 内部消息格式
     * @returns 发送格式
     */
    static toSendFormat(message: InternalMessage): any {
        return {
            target: message.group?.group_id || message.sender.user_id,
            content: this.formatContent(message.content),
            type: message.scene
        };
    }

    /**
     * 将MessageResult转换为发送格式
     * @param result 消息结果
     * @param target 目标ID
     * @returns 发送格式
     */
    static resultToSendFormat(result: MessageResult, target?: string | number): any {
        const sendFormat: any = {
            target: target || result.target,
            type: result.type,
            content: result.content
        };

        if (result.atSender) {
            sendFormat.at_sender = true;
        }

        if (result.replyTo) {
            sendFormat.reply_to = result.replyTo;
        }

        if (result.extra) {
            Object.assign(sendFormat, result.extra);
        }

        return sendFormat;
    }

    /**
     * 解析消息段
     * @param segments 消息段数组
     * @returns 解析后的内容
     */
    private static parseSegments(segments: milky.IncomingSegment[]): MessageContent {
        const content: MessageContent = {
            text: '',
            segments: [],
            hasImage: false,
            hasAt: false,
            hasReply: false
        };

        for (const segment of segments) {
            switch (segment.type) {
                case 'text':
                    content.text += (segment as any).data.text;
                    content.segments.push({
                        type: 'text',
                        content: (segment as any).data.text
                    });
                    break;
                
                case 'image':
                    content.hasImage = true;
                    const imageData = (segment as any).data;
                    content.segments.push({
                        type: 'image',
                        content: {
                            url: imageData.temp_url,
                            resource_id: imageData.resource_id,
                            width: imageData.width,
                            height: imageData.height
                        }
                    });
                    break;
                
                case 'mention':
                    content.hasAt = true;
                    const mentionData = (segment as any).data;
                    content.segments.push({
                        type: 'at',
                        content: {
                            user_id: mentionData.user_id,
                            nickname: mentionData.nickname
                        }
                    });
                    break;
                
                case 'reply':
                    content.hasReply = true;
                    const replyData = (segment as any).data;
                    content.seplyTo = replyData.message_seq;
                    content.segments.push({
                        type: 'reply',
                        content: {
                            message_id: replyData.message_seq,
                            content: replyData.content || ''
                        }
                    });
                    break;
                
                default:
                    content.segments.push(segment as any);
            }
        }

        content.text = content.text.trim();
        return content;
    }

    /**
     * 格式化内容为发送格式
     * @param content 消息内容
     * @returns 发送格式的内容
     */
    private static formatContent(content: MessageContent): any {
        if (content.segments.length === 1 && content.segments[0].type === 'text') {
            return content.text;
        }

        return content.segments.map(segment => {
            switch (segment.type) {
                case 'text':
                    return { type: 'text', content: segment.content };
                case 'image':
                    return { type: 'image', ...segment.content };
                case 'at':
                    return { type: 'at', ...segment.content };
                case 'reply':
                    return { type: 'reply', ...segment.content };
                default:
                    return segment;
            }
        });
    }

    /**
     * 创建回复消息
     * @param originalMessage 原始消息
     * @param replyContent 回复内容
     * @returns 回复消息
     */
    static createReply(originalMessage: InternalMessage, replyContent: string): any {
        return {
            target: originalMessage.group?.group_id || originalMessage.sender.user_id,
            type: 'reply',
            content: replyContent,
            reply_to: originalMessage.id
        };
    }

    /**
     * 创建@消息
     * @param target 目标用户ID
     * @param content 消息内容
     * @param groupId 群组ID
     * @returns @消息
     */
    static createAtMessage(target: number, content: string, groupId?: number): any {
        return {
            target: groupId || target,
            type: 'at',
            content: {
                user_id: target,
                message: content
            }
        };
    }
}

/**
 * 内部消息格式
 */
export interface InternalMessage {
    id: number;
    type: string;
    scene: 'group' | 'friend' | 'temp';
    sender: {
        user_id: number;
        nickname: string;
        role: string;
        group_id?: number;
        card?: string;
        title?: string;
        level?: number;
        join_time?: number;
        last_sent_time?: number;
    };
    group?: {
        group_id: number;
        group_name: string;
        member_count: number;
        max_member_count: number;
    };
    content: MessageContent;
    timestamp: number;
    raw: milky.IncomingMessage;
}

/**
 * 消息内容格式
 */
export interface MessageContent {
    text: string;
    segments: Array<{
        type: string;
        content: any;
    }>;
    hasImage: boolean;
    hasAt: boolean;
    hasReply: boolean;
    seplyTo?: number;
}
