import * as milky from '@saltify/milky-types';

/**
 * 消息结果类型
 * 定义所有可能的响应消息类型
 */
export type MessageType = 'text' | 'image' | 'video' | 'at' | 'reply' | 'forward' | 'card' | 'file';

/**
 * 基础消息结果接口
 */
export interface MessageResult {
    /** 消息类型 */
    type: MessageType;
    
    /** 消息内容 */
    content: string | any;
    
    /** 目标用户/群组ID */
    target?: string | number;
    
    /** 是否@发送者 */
    atSender?: boolean;
    
    /** 回复的消息ID */
    replyTo?: number;
    
    /** 额外参数 */
    extra?: Record<string, any>;
}

/**
 * 文本消息结果
 */
export interface TextMessageResult extends MessageResult {
    type: 'text';
    content: string;
}

/**
 * 图片消息结果
 */
export interface ImageMessageResult extends MessageResult {
    type: 'image';
    content: {
        url?: string;
        path?: string;
        base64?: string;
        resource_id?: string;
        width?: number;
        height?: number;
        uri?: string;        // Milky格式的URI
        sub_type?: string;   // Milky格式的子类型
    };
}

/**
 * 视频消息结果
 */
export interface VideoMessageResult extends MessageResult {
    type: 'video';
    content: {
        url?: string;
        path?: string;
        uri?: string;        // Milky格式的URI
        thumb_uri?: string;  // 可选的封面图片URI
    };
}

/**
 * @消息结果
 */
export interface AtMessageResult extends MessageResult {
    type: 'at';
    content: {
        user_id: number;
        nickname?: string;
        message?: string;
    };
}

/**
 * 回复消息结果
 */
export interface ReplyMessageResult extends MessageResult {
    type: 'reply';
    content: string;
    replyTo: number;
}

/**
 * 转发消息结果
 */
export interface ForwardMessageResult extends MessageResult {
    type: 'forward';
    content: {
        messages: Array<{
            type: MessageType;
            content: any;
            sender?: string;
            time?: number;
        }>;
    };
}

/**
 * 卡片消息结果
 */
export interface CardMessageResult extends MessageResult {
    type: 'card';
    content: {
        title: string;
        content: string;
        image?: string;
        url?: string;
        buttons?: Array<{
            text: string;
            action: string;
        }>;
    };
}

/**
 * 文件消息结果
 */
export interface FileMessageResult extends MessageResult {
    type: 'file';
    content: {
        name: string;
        url?: string;
        path?: string;
        size?: number;
        type?: string;
    };
}

/**
 * 消息结果工具类
 */
export class MessageResultUtils {
    /**
     * 创建文本消息
     */
    static text(content: string, target?: string | number): TextMessageResult {
        return {
            type: 'text',
            content,
            target
        };
    }

    /**
     * 创建图片消息
     */
    static image(content: ImageMessageResult['content'], target?: string | number): ImageMessageResult {
        return {
            type: 'image',
            content,
            target
        };
    }

    /**
     * 创建@消息
     */
    static at(userId: number, message?: string, target?: string | number): AtMessageResult {
        return {
            type: 'at',
            content: {
                user_id: userId,
                message
            },
            target
        };
    }

    /**
     * 创建回复消息
     */
    static reply(content: string, replyTo: number, target?: string | number): ReplyMessageResult {
        return {
            type: 'reply',
            content,
            replyTo,
            target
        };
    }

    /**
     * 创建转发消息
     */
    static forward(messages: ForwardMessageResult['content']['messages'], target?: string | number): ForwardMessageResult {
        return {
            type: 'forward',
            content: { messages },
            target
        };
    }

    /**
     * 创建卡片消息
     */
    static card(content: CardMessageResult['content'], target?: string | number): CardMessageResult {
        return {
            type: 'card',
            content,
            target
        };
    }

    /**
     * 创建文件消息
     */
    static file(content: FileMessageResult['content'], target?: string | number): FileMessageResult {
        return {
            type: 'file',
            content,
            target
        };
    }

    /**
     * 创建错误消息
     */
    static error(message: string, target?: string | number): TextMessageResult {
        return this.text(`❌ ${message}`, target);
    }

    /**
     * 创建成功消息
     */
    static success(message: string, target?: string | number): TextMessageResult {
        return this.text(`✅ ${message}`, target);
    }

    /**
     * 创建警告消息
     */
    static warning(message: string, target?: string | number): TextMessageResult {
        return this.text(`⚠️ ${message}`, target);
    }

    /**
     * 创建信息消息
     */
    static info(message: string, target?: string | number): TextMessageResult {
        return this.text(`ℹ️ ${message}`, target);
    }

    /**
     * 验证消息结果格式
     */
    static validate(result: MessageResult): boolean {
        if (!result || typeof result !== 'object') {
            return false;
        }

        if (!result.type || typeof result.type !== 'string') {
            return false;
        }

        if (result.content === undefined || result.content === null) {
            return false;
        }

        return true;
    }

    /**
     * 转换为发送格式
     */
    static toSendFormat(result: MessageResult): any {
        if (!this.validate(result)) {
            throw new Error('Invalid message result format');
        }

        const base: any = {
            type: result.type,
            content: result.content
        };

        if (result.target) {
            base.target = result.target;
        }

        if (result.atSender) {
            base.at_sender = result.atSender;
        }

        if (result.replyTo) {
            base.reply_to = result.replyTo;
        }

        if (result.extra) {
            Object.assign(base, result.extra);
        }

        return base;
    }

    /**
     * 转换为Milky发送格式
     * 根据Milky协议转换为正确的发送格式
     */
    static toMilkySendFormat(result: MessageResult, originalMessage: any): any {
        const segments: any[] = [];

        switch (result.type) {
            case 'text':
                segments.push({
                    type: 'text',
                    data: {
                        text: result.content
                    }
                });
                break;

            case 'image':
                const imageContent = result.content as ImageMessageResult['content'];
                // 确保content存在且包含必要字段
                if (!imageContent) {
                    console.error('❌ 图像消息content为空');
                    break;
                }
                
                const uri = imageContent.uri || imageContent.url || '';
                if (!uri) {
                    console.error('❌ 图像消息缺少uri或url字段');
                    break;
                }
                
                segments.push({
                    type: 'image',
                    data: {
                        uri: uri,
                        sub_type: imageContent.sub_type || 'normal',
                        resource_id: imageContent.resource_id,
                        temp_url: imageContent.url,
                        width: imageContent.width,
                        height: imageContent.height
                    }
                });
                break;

            case 'video':
                const videoContent = result.content as VideoMessageResult['content'];
                // 确保content存在且包含必要字段
                if (!videoContent) {
                    console.error('❌ 视频消息content为空');
                    break;
                }
                
                const videoUri = videoContent.uri || videoContent.url || '';
                if (!videoUri) {
                    console.error('❌ 视频消息缺少uri或url字段');
                    break;
                }
                
                // 根据Milky文档，视频消息只需要uri和可选的thumb_uri
                const videoData: any = {
                    uri: videoUri
                };
                
                // 如果有封面图片，添加thumb_uri
                if (videoContent.thumb_uri) {
                    videoData.thumb_uri = videoContent.thumb_uri;
                }
                
                segments.push({
                    type: 'video',
                    data: videoData
                });
                break;

            case 'at':
                const atContent = result.content as AtMessageResult['content'];
                segments.push({
                    type: 'mention',
                    data: {
                        user_id: atContent.user_id
                    }
                });
                if (atContent.message) {
                    segments.push({
                        type: 'text',
                        data: {
                            text: atContent.message
                        }
                    });
                }
                break;

            case 'reply':
                const replyContent = result.content as string;
                segments.push({
                    type: 'reply',
                    data: {
                        message_seq: result.replyTo
                    }
                });
                segments.push({
                    type: 'text',
                    data: {
                        text: replyContent
                    }
                });
                break;

            default:
                // 其他类型暂时转换为文本
                segments.push({
                    type: 'text',
                    data: {
                        text: String(result.content)
                    }
                });
        }

        return {
            segments
        };
    }
}
