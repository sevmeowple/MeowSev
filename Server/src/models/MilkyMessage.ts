/**
 * Milky消息模型
 * 专门用于存储Milky协议的消息
 */
export interface MilkyMessage {
    id?: number;
    message_seq: number;           // Milky消息序列号
    message_scene: string;         // 消息场景 (group, friend, temp)
    sender_id: number;             // 发送者ID
    peer_id: number;               // 对端ID (群号或用户ID)
    content: string;               // 消息内容
    raw_content?: string;          // 原始消息JSON
    message_type: string;          // 消息类型 (text, image, reply等)
    platform: string;             // 平台 (milky)
    timestamp: number;             // 时间戳
    created_at?: string;           // 创建时间
    user_name?: string;            // 用户名
    channel_name?: string;         // 频道名
    group_name?: string;           // 群名
    is_bot?: boolean;              // 是否为Bot消息
}

export const MilkyMessageSchema = {
    tableName: 'milky_messages',
    createTable: `
        CREATE TABLE IF NOT EXISTS milky_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_seq INTEGER NOT NULL,
            message_scene TEXT NOT NULL,
            sender_id INTEGER NOT NULL,
            peer_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            raw_content TEXT,
            message_type TEXT DEFAULT 'text',
            platform TEXT DEFAULT 'milky',
            timestamp INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_name TEXT,
            channel_name TEXT,
            group_name TEXT,
            is_bot BOOLEAN DEFAULT FALSE
        )
    `
};
