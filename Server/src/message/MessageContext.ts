import * as milky from '@saltify/milky-types';

/**
 * 消息上下文接口
 * 包含处理消息时需要的所有上下文信息
 */
export interface MessageContext {
    /** 原始消息对象 */
    message: milky.IncomingMessage;
    
    /** 提取的文本内容 */
    text: string;
    
    /** 发送者信息 */
    sender: milky.GroupMemberEntity | milky.FriendEntity | undefined;
    
    /** 群组信息 */
    group: milky.GroupEntity | undefined;
    
    /** 时间戳 */
    timestamp: number;
    
    /** 路由匹配的参数 */
    params?: string[];
    
    /** 匹配的命令 */
    command?: string;
    
    /** 匹配结果详情 */
    match?: {
        params: string[];
        command: string;
    };
}

/**
 * 发送者信息接口
 */
export interface SenderInfo {
    user_id: number;
    nickname: string;
    sex: string;
    group_id?: number;
    card?: string;
    title?: string;
    level?: number;
    role?: string;
    join_time?: number;
    last_sent_time?: number;
}

/**
 * 群组信息接口
 */
export interface GroupInfo {
    group_id: number;
    group_name: string;
    member_count: number;
    max_member_count: number;
}

/**
 * 消息场景类型
 */
export type MessageScene = 'group' | 'friend' | 'temp';

/**
 * 扩展的消息上下文，包含更多详细信息
 */
export interface ExtendedMessageContext extends MessageContext {
    /** 消息场景 */
    scene: MessageScene;
    
    /** 消息序列号 */
    messageSeq: number;
    
    /** 发送者详细信息 */
    senderInfo: SenderInfo;
    
    /** 群组详细信息 */
    groupInfo?: GroupInfo;
    
    /** 是否为管理员 */
    isAdmin: boolean;
    
    /** 是否为群主 */
    isOwner: boolean;
}

/**
 * 创建扩展消息上下文的工具函数
 */
export function createExtendedContext(context: MessageContext): ExtendedMessageContext {
    const message = context.message;
    
    return {
        ...context,
        scene: message.message_scene,
        messageSeq: message.message_seq,
        senderInfo: context.sender as any || {},
        groupInfo: context.group,
        isAdmin: (context.sender as any)?.role === 'admin',
        isOwner: (context.sender as any)?.role === 'owner'
    };
}
