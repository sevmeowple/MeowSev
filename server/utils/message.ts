import "reflect-metadata";
import { createConnection, Connection, Repository } from "typeorm";
import { PrivateMessage } from "./entities/PrivateMessage";
import { GroupMessage } from "./entities/GroupMessage";

enum MessageType {
    TEXT = 'text',
}

enum Place {
    GROUP = 'group',
    TARGET = 'target',
}

interface Message {
    type: MessageType;
    data: []
    place: Place;
}

/**
 * Unified message type combining both private and group message structures
 */
type UnifiedMessage = {
    // Common fields
    self_id: number;
    user_id: number;
    time: number;
    message_id: number;
    message_seq: number;
    real_id: number;
    real_seq: string | number;
    message_type: "private" | "group";
    sender: {
        user_id: number;
        nickname: string;
        card: string;
        role?: "owner" | "admin" | "member"; // Only present in group messages
    };
    raw_message: string;
    font: number;
    sub_type: "friend" | "normal" | string;
    message: Array<{
        type: string;
        data: Record<string, any>; // Using Record for generic object type
    }>;
    message_format: string;
    post_type: string;

    // Fields specific to private messages
    target_id?: number;

    // Fields specific to group messages
    group_id?: number;
};

class MessageProcess {
    private connection!: Connection;
    private privateMessageRepository!: Repository<PrivateMessage>;
    private groupMessageRepository!: Repository<GroupMessage>;
    private isConnected: boolean = false;

    constructor() {
        this.initDatabase();
    }

    private async initDatabase() {
        try {
            this.connection = await createConnection({
                type: "sqlite",
                database: process.cwd() + '/data/message.db',
                entities: [PrivateMessage, GroupMessage],
                synchronize: true, // 自动同步实体结构到数据库
                logging: false
            });

            this.privateMessageRepository = this.connection.getRepository(PrivateMessage);
            this.groupMessageRepository = this.connection.getRepository(GroupMessage);
            this.isConnected = true;
            console.log("Database connection established successfully");
        } catch (error) {
            console.error("Error connecting to the database:", error);
            throw error;
        }
    }

    private async ensureConnection() {
        if (!this.isConnected) {
            await this.initDatabase();
        }
    }

    async MessageHandler(message: UnifiedMessage) {
            // 忽略心跳帧、连接帧等非消息帧
        if (message.post_type !== "message") return;

        await this.ensureConnection();

        if (message.message_type === 'private') {
            await this.handlePrivateMessage(message);
        } else {
            await this.handleGroupMessage(message);
        }
    }

    async handlePrivateMessage(message: UnifiedMessage) {
        await this.ensureConnection();

        // 添加安全检查
        const senderName = message.sender?.nickname || message.sender?.user_id || "未知用户";
        const formattedMessage = `${senderName}: ${message.raw_message || ""}`;

        const privateMessage = new PrivateMessage();
        privateMessage.sender_id = String(message.sender?.user_id || "unknown");
        privateMessage.receiver_id = String(message.user_id || "unknown");
        privateMessage.content = message.raw_message || "";
        privateMessage.formatted_message = formattedMessage;
        privateMessage.timestamp = Date.now();

        await this.privateMessageRepository.save(privateMessage);
    }

    async handleGroupMessage(message: UnifiedMessage) {
        await this.ensureConnection();

        // 添加安全检查
        const senderName = message.sender?.nickname || message.sender?.user_id || "未知用户";
        const formattedMessage = `${senderName}: ${message.raw_message || ""}`;

        const groupMessage = new GroupMessage();
        groupMessage.sender_id = String(message.sender?.user_id || "unknown");
        groupMessage.group_id = String(message.group_id || "0");
        groupMessage.content = message.raw_message || "";
        groupMessage.formatted_message = formattedMessage;
        groupMessage.timestamp = Date.now();

        await this.groupMessageRepository.save(groupMessage);
    }

    // 查询私聊消息
    async getPrivateMessages(senderId: string, receiverId: string) {
        await this.ensureConnection();

        return this.privateMessageRepository.createQueryBuilder("msg")
            .where("(msg.sender_id = :senderId AND msg.receiver_id = :receiverId) OR (msg.sender_id = :receiverId AND msg.receiver_id = :senderId)",
                { senderId, receiverId })
            .orderBy("msg.timestamp", "ASC")
            .getMany();
    }

    // 查询群聊消息
    async getGroupMessages(groupId: string) {
        await this.ensureConnection();

        return this.groupMessageRepository.find({
            where: { group_id: groupId },
            order: { timestamp: "ASC" }
        });
    }

    // 查询n条群组消息
    async getGroupMessagesLimit(groupId: string, limit: number = 20) {
        await this.ensureConnection();

        return this.groupMessageRepository.find({
            where: { group_id: groupId },
            order: { timestamp: "DESC" },
            take: limit
        });
    }

    // 关闭数据库连接
    async close() {
        if (this.connection && this.isConnected) {
            await this.connection.close();
            this.isConnected = false;
            console.log("Database connection closed");
        }
    }
}

// 导出全局静态实例
export const messageProcess = new MessageProcess();

// 确保在进程退出前关闭连接
process.on('beforeExit', async () => {
    await messageProcess.close();
});