import { ConfigUnionType } from "@/config/config";
import Database from "bun:sqlite";

// 游戏会话接口
export interface GameSession {
    sessionId: string;
    platform: string;
    selfId: string;
    channelId: string;
    gameType: string;
    state: string;
    data: Record<string, any>;  // 保持通用，由具体游戏定义结构
    createdBy: string;
    participants: string[];
    createdAt: Date;
    lastActiveAt: Date;
    expiresAt: Date;
}


// 游戏处理结果
export interface GameResult {
    success: boolean;
    message: string;
    newState?: string;
    updateData?: Record<string, any>;
    shouldEnd?: boolean;
    broadcastToAll?: boolean;
}

// 游戏处理器接口
export interface GameHandler {
    gameType: string;
    initialState: string;
    maxParticipants: number;
    timeoutMinutes: number;

    // 核心方法
    handleCommand(session: GameSession, userId: string, command: string, params: string[]): Promise<GameResult>;

    // 生命周期方法
    initializeGameData?(): Record<string, any>;
    onSessionCreated?(session: GameSession): Promise<void>;
    onSessionEnded?(session: GameSession): Promise<void>;

    // 状态管理
    getValidStates(): string[];
    getStateDescription(state: string): string;
    validateTransition(fromState: string, toState: string): boolean;

    // 扩展功能
    handlePrivateCommand?(gameId: string, userId: string, command: string, params: string[]): Promise<GameResult>;
    getGameStatus?(session: GameSession): string;
    canUserJoin?(session: GameSession, userId: string): boolean;
}

// 会话管理器
export class ContextService {
    private db: Database;
    private sessions: Map<string, GameSession> = new Map();
    private gameHandlers: Map<string, GameHandler> = new Map();
    private cleanupInterval: Timer;

    constructor(ConfigUnion: ConfigUnionType) {
        this.db = ConfigUnion.database;
        this.initDatabase();
        this.loadActiveSessions();

        // 每5分钟清理一次过期会话
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }

    private initDatabase() {
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS game_sessions (
        session_id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        self_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        game_type TEXT NOT NULL,
        state TEXT NOT NULL,
        data TEXT NOT NULL,
        created_by TEXT NOT NULL,
        participants TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        last_active_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL
      )
    `;
        this.db.exec(createTableSQL);
    }

    // 生成会话唯一标识
    private generateSessionId(platform: string, selfId: string, channelId: string): string {
        return `${platform}:${selfId}:${channelId}`;
    }

    // 检查用户权限
    private checkPermission(session: GameSession, userId: string, action: string): boolean {
        switch (action) {
            case 'CREATE':
                return !this.hasActiveSession(session.platform, session.selfId, session.channelId);

            case 'JOIN':
                return !session.participants.includes(userId) &&
                    session.participants.length < this.gameHandlers.get(session.gameType)?.maxParticipants!;

            case 'MANAGE':
                return session.createdBy === userId;

            case 'PARTICIPATE':
                return session.participants.includes(userId);

            case 'END':
                return session.createdBy === userId || session.participants.includes(userId);

            default:
                return false;
        }
    }

     // 添加根据游戏ID查找会话的方法
    private findSessionByGameId(gameId: string): GameSession | undefined {
        for (const session of this.sessions.values()) {
            const data = session.data as any;
            if (data && data.gameId === gameId) {
                return session;
            }
        }
        return undefined;
    }

    async handlePrivateCommand(gameId: string, userId: string, command: string, params: string[]): Promise<GameResult> {
        const session = this.findSessionByGameId(gameId);
        if (!session) {
            return {
                success: false,
                message: "❌ 游戏会话不存在或已结束"
            };
        }

        const handler = this.gameHandlers.get(session.gameType);
        if (!handler || !handler.handlePrivateCommand) {
            return {
                success: false,
                message: "❌ 该游戏不支持私聊命令"
            };
        }

        return handler.handlePrivateCommand(gameId, userId, command, params);
    }

    // 注册游戏处理器
    registerGameHandler(handler: GameHandler): void {
        this.gameHandlers.set(handler.gameType, handler);


        // 如果是海龟汤处理器，设置会话查找器
        if (handler.gameType === 'turtle-soup' && 'setSessionFinder' in handler) {
            (handler as any).setSessionFinder((gameId: string) => this.findSessionByGameId(gameId));
        }
        console.log(`✅ 注册游戏类型: ${handler.gameType}`);
    }

    // 检查是否有活跃会话
    hasActiveSession(platform: string, selfId: string, channelId: string): boolean {
        const sessionId = this.generateSessionId(platform, selfId, channelId);
        return this.sessions.has(sessionId);
    }

    // 获取活跃会话
    getActiveSession(platform: string, selfId: string, channelId: string): GameSession | null {
        const sessionId = this.generateSessionId(platform, selfId, channelId);
        return this.sessions.get(sessionId) || null;
    }

    // 创建新会话
    async createSession(
        platform: string,
        selfId: string,
        channelId: string,
        gameType: string,
        createdBy: string
    ): Promise<GameResult> {
        const sessionId = this.generateSessionId(platform, selfId, channelId);

        // 检查是否已有活跃会话
        if (this.sessions.has(sessionId)) {
            return {
                success: false,
                message: "❌ 当前群聊已有进行中的游戏，请先结束当前游戏"
            };
        }

        // 检查游戏类型是否存在
        const handler = this.gameHandlers.get(gameType);
        if (!handler) {
            return {
                success: false,
                message: `❌ 不支持的游戏类型: ${gameType}`
            };
        }

        const now = new Date();
        const session: GameSession = {
            sessionId,
            platform,
            selfId,
            channelId,
            gameType,
            state: handler.initialState,
            data: handler.initializeGameData ? handler.initializeGameData() : {},
            createdBy,
            participants: [createdBy],
            createdAt: now,
            lastActiveAt: now,
            expiresAt: new Date(now.getTime() + handler.timeoutMinutes * 60 * 1000)
        };
        if (handler.onSessionCreated) {
            await handler.onSessionCreated(session);
        }
        // 保存到内存和数据库
        this.sessions.set(sessionId, session);
        await this.saveSession(session);

        console.log(`🎮 创建新游戏会话: ${gameType} in ${sessionId}`);

        return {
            success: true,
            message: `✅ 成功创建 ${gameType} 游戏会话`,
            updateData: session.data
        };
    }

    // 处理游戏命令
    async handleGameCommand(
        platform: string,
        selfId: string,
        channelId: string,
        userId: string,
        command: string,
        params: string[]
    ): Promise<GameResult> {
        const sessionId = this.generateSessionId(platform, selfId, channelId);
        const session = this.sessions.get(sessionId);

        if (!session) {
            return {
                success: false,
                message: "❌ 当前群聊没有进行中的游戏会话"
            };
        }

        // 检查会话是否过期
        if (new Date() > session.expiresAt) {
            await this.endSession(sessionId);
            return {
                success: false,
                message: "⏰ 游戏会话已过期"
            };
        }

        const handler = this.gameHandlers.get(session.gameType);
        if (!handler) {
            return {
                success: false,
                message: "❌ 游戏处理器不存在"
            };
        }

        try {
            // 调用游戏处理器
            const result = await handler.handleCommand(session, userId, command, params);

            // 更新会话状态
            if (result.success) {
                session.lastActiveAt = new Date();

                if (result.newState) {
                    session.state = result.newState;
                }

                if (result.updateData) {
                    session.data = { ...session.data, ...result.updateData };
                }

                await this.saveSession(session);

                // 检查是否需要结束会话
                if (result.shouldEnd) {
                    await this.endSession(sessionId);
                }
            }

            return result;

        } catch (error) {
            console.error(`游戏命令处理失败:`, error);
            return {
                success: false,
                message: "❌ 游戏命令处理失败"
            };
        }
    }

    // 加入游戏
    async joinGame(
        platform: string,
        selfId: string,
        channelId: string,
        userId: string
    ): Promise<GameResult> {
        const sessionId = this.generateSessionId(platform, selfId, channelId);
        const session = this.sessions.get(sessionId);

        if (!session) {
            return {
                success: false,
                message: "❌ 当前群聊没有进行中的游戏会话"
            };
        }

        if (!this.checkPermission(session, userId, 'JOIN')) {
            if (session.participants.includes(userId)) {
                return {
                    success: false,
                    message: "❌ 您已经在游戏中了"
                };
            } else {
                return {
                    success: false,
                    message: "❌ 游戏人数已满或不允许加入"
                };
            }
        }

        session.participants.push(userId);
        session.lastActiveAt = new Date();
        await this.saveSession(session);

        return {
            success: true,
            message: `✅ 成功加入 ${session.gameType} 游戏\n👥 当前参与者: ${session.participants.length}人`,
            broadcastToAll: true
        };
    }

    // 结束会话
    async endSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            // 从内存中删除
            this.sessions.delete(sessionId);

            // 从数据库中删除
            const deleteQuery = this.db.query("DELETE FROM game_sessions WHERE session_id = ?");
            deleteQuery.run(sessionId);

            console.log(`🏁 结束游戏会话: ${sessionId}`);
        }
    }

    // 获取会话状态
    getSessionStatus(platform: string, selfId: string, channelId: string): string {
        const session = this.getActiveSession(platform, selfId, channelId);
        if (!session) {
            return "📝 当前群聊没有进行中的游戏";
        }

        const handler = this.gameHandlers.get(session.gameType);
        const stateDesc = handler?.getStateDescription(session.state) || session.state;

        return `🎮 游戏类型: ${session.gameType}\n📊 当前状态: ${stateDesc}\n👤 创建者: ${session.createdBy}\n👥 参与者: ${session.participants.length}人\n⏰ 创建时间: ${session.createdAt.toLocaleString()}`;
    }

    // 获取支持的游戏列表
    getAvailableGames(): string {
        const games = Array.from(this.gameHandlers.values());
        if (games.length === 0) {
            return "📋 暂无可用游戏";
        }

        const gameList = games.map((game, index) =>
            `${index + 1}. ${game.gameType} (最多${game.maxParticipants}人, ${game.timeoutMinutes}分钟)`
        ).join('\n');

        return `🎮 可用游戏列表:\n${gameList}`;
    }

    // 保存会话到数据库
    private async saveSession(session: GameSession): Promise<void> {
        const query = this.db.query(`
      INSERT OR REPLACE INTO game_sessions (
        session_id, platform, self_id, channel_id, game_type, state, data,
        created_by, participants, created_at, last_active_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        query.run(
            session.sessionId,
            session.platform,
            session.selfId,
            session.channelId,
            session.gameType,
            session.state,
            JSON.stringify(session.data),
            session.createdBy,
            JSON.stringify(session.participants),
            session.createdAt.toISOString(),
            session.lastActiveAt.toISOString(),
            session.expiresAt.toISOString()
        );
    }

    // 从数据库加载活跃会话
    private loadActiveSessions(): void {
        const query = this.db.query("SELECT * FROM game_sessions WHERE expires_at > datetime('now')");
        const rows = query.all() as any[];

        for (const row of rows) {
            const session: GameSession = {
                sessionId: row.session_id,
                platform: row.platform,
                selfId: row.self_id,
                channelId: row.channel_id,
                gameType: row.game_type,
                state: row.state,
                data: JSON.parse(row.data),
                createdBy: row.created_by,
                participants: JSON.parse(row.participants),
                createdAt: new Date(row.created_at),
                lastActiveAt: new Date(row.last_active_at),
                expiresAt: new Date(row.expires_at)
            };

            this.sessions.set(session.sessionId, session);
        }

        console.log(`📁 加载了 ${rows.length} 个活跃游戏会话`);
    }

    // 清理过期会话
    private cleanupExpiredSessions(): void {
        const now = new Date();
        let cleaned = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now > session.expiresAt) {
                this.endSession(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 清理了 ${cleaned} 个过期游戏会话`);
        }
    }

    // 清理资源
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}