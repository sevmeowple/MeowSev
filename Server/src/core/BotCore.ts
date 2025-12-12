import { MilkyClient } from '@saltify/milky-node-sdk';
import * as milky from '@saltify/milky-types';
import { MessageRouter } from '../message/MessageRouter';
import { MessageAdapter } from '../message/MessageAdapter';
import { MessageResultUtils } from '../message/MessageResult';
import { PluginManager } from './PluginManager';
import { RootPlugin } from '../plugin/RootPlugin';
import { ConfigUnion } from '../config/config';
import { MilkyMessageService } from '../service/MilkyMessageService';

/**
 * Bot核心类 - 替换原来的HTTP服务器
 * 负责连接MilkyClient、管理插件、处理消息
 */
export class BotCore {
    private client: MilkyClient;
    private router: MessageRouter;
    private pluginManager: PluginManager;
    private msgService: MilkyMessageService;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 5000;

    constructor(
        private host: string = '127.0.0.1',
        private port: number = 3099,
        private path: string = '/'
    ) {
        this.client = new MilkyClient(host, port, path);
        this.router = new MessageRouter();
        this.pluginManager = new PluginManager();
        this.msgService = new MilkyMessageService(ConfigUnion);
        
        this.setupEventListeners();
        // 注意：initializePlugins() 现在在 start() 方法中调用，确保所有插件都已注册
    }

    /**
     * 启动Bot
     */
    async start(): Promise<void> {
        try {
            console.log(`🤖 正在启动Bot...`);
            console.log(`📡 连接地址: ${this.host}:${this.port}${this.path}`);
            
            // 初始化插件（在连接前初始化，确保所有插件都已注册）
            this.initializePlugins();
            
            // 连接MilkyClient
            await this.connect();
            
            console.log(`✅ Bot启动成功！`);
            console.log(`🔌 已连接到Milky服务器`);
            console.log(`📋 已加载 ${this.pluginManager.getPluginCount()} 个插件`);
            console.log(`🛣️  已注册 ${this.router.routeCount} 个路由`);
            
        } catch (error) {
            console.error('❌ Bot启动失败:', error);
            throw error;
        }
    }

    /**
     * 停止Bot
     */
    async stop(): Promise<void> {
        try {
            console.log('🛑 正在停止Bot...');
            
            this.isConnected = false;
            
            // 销毁所有插件
            await this.pluginManager.destroyAll();
            
            // 断开连接
            if (this.client) {
                // MilkyClient可能没有disconnect方法，这里先注释
                // await this.client.disconnect();
            }
            
            console.log('✅ Bot已停止');
        } catch (error) {
            console.error('❌ Bot停止失败:', error);
        }
    }

    /**
     * 连接MilkyClient
     */
    private async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('连接超时'));
            }, 10000);

            // MilkyClient 可能不需要显式连接，直接标记为已连接
            // 如果后续发现需要连接，可以在这里添加连接逻辑
            setTimeout(() => {
                clearTimeout(timeout);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                console.log('✅ MilkyClient 连接就绪');
                resolve();
            }, 1000); // 给一点时间让事件监听器设置完成
        });
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        // 监听消息接收事件
        this.client.onEvent('message_receive', async (event) => {
            try {
                // console.log('📨 收到消息:', {
                //     scene: event.data.message_scene,
                //     sender: event.data.sender_id,
                //     peer: event.data.peer_id,
                //     seq: event.data.message_seq
                // });

                // 处理消息
                await this.handleMessage(event.data);
            } catch (error) {
                console.error('❌ 处理消息失败:', error);
            }
        });

        // 监听Bot离线事件
        this.client.onEvent('bot_offline', (event) => {
            console.log('🔌 Bot离线:', event.data.reason);
            this.isConnected = false;
            this.handleDisconnection();
        });
    }

    /**
     * 处理消息
     */
    private async handleMessage(message: milky.IncomingMessage): Promise<void> {
        try {
            // 首先保存消息到数据库
            await this.msgService.saveMessage(message);
            
            // 使用路由器处理消息
            const results = await this.router.process(message);
            
            // 只有当有结果时才发送响应
            if (results && results.length > 0) {
                for (const result of results) {
                    await this.sendMessage(result, message);
                }
            } else {
                // console.log('📝 消息无法处理，跳过发送响应');
            }
        } catch (error) {
            console.error('❌ 消息处理失败:', error);
            
            // 发送错误响应
            const errorResult = MessageResultUtils.error('处理失败，请稍后重试');
            await this.sendMessage(errorResult, message);
        }
    }

    /**
     * 发送消息
     */
    private async sendMessage(result: any, originalMessage: milky.IncomingMessage): Promise<void> {
        try {
            // 检查是否是视频消息，需要特殊处理
            if (result.type === 'video' && result.content?.uri) {
                await this.sendVideoMessage(result, originalMessage);
                return;
            }

            // 转换为Milky发送格式
            const sendFormat = MessageResultUtils.toMilkySendFormat(result, originalMessage);
            
            console.log('📤 发送消息:', {
                scene: originalMessage.message_scene,
                target: sendFormat.target,
                type: result.type,
                content: result.content
            });

            // 根据消息场景调用不同的API
            let apiResponse;
            if (originalMessage.message_scene === 'group') {
                // 发送群聊消息
                apiResponse = await this.client.callApi('send_group_message', {
                    group_id: originalMessage.peer_id,
                    message: sendFormat.segments
                });
            } else if (originalMessage.message_scene === 'friend') {
                // 发送私聊消息
                apiResponse = await this.client.callApi('send_private_message', {
                    user_id: originalMessage.sender_id,
                    message: sendFormat.segments
                });
            } else {
                // 临时会话消息，暂时按群聊处理
                apiResponse = await this.client.callApi('send_group_message', {
                    group_id: originalMessage.peer_id,
                    message: sendFormat.segments
                });
            }

            console.log('✅ 消息发送成功:', {
                message_seq: apiResponse.message_seq,
                time: apiResponse.time
            });
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
        }
    }

    /**
     * 获取消息目标
     */
    private getTarget(message: milky.IncomingMessage): string | number {
        if (message.message_scene === 'group') {
            return message.peer_id; // 群号
        } else if (message.message_scene === 'friend') {
            return message.sender_id; // 好友QQ号
        } else {
            return message.peer_id; // 临时会话
        }
    }

    /**
     * 处理断线重连
     */
    private async handleDisconnection(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ 重连次数超限，停止重连');
            return;
        }

        this.reconnectAttempts++;
        console.log(`🔄 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                console.error('❌ 重连失败:', error);
                this.handleDisconnection();
            }
        }, this.reconnectDelay);
    }

    /**
     * 使用插件 - 类似Elysia的.use()方法
     */
    use(plugin: any): BotCore {
        this.pluginManager.registerPlugin(plugin);
        return this;
    }

    /**
     * 初始化插件
     */
    private initializePlugins(): void {
        // 注意：现在插件通过.use()方法注册，这里不再硬编码注册插件
        // 注册所有插件的路由和命令
        const plugins = this.pluginManager.getAllPlugins();
        console.log(`🔧 开始初始化 ${plugins.length} 个插件...`);
        
        plugins.forEach(plugin => {
            console.log(`📦 初始化插件: ${plugin.name}`);
            
            // 注册传统路由
            const handlers = plugin.getHandlers();
            handlers.forEach(handler => {
                this.router.register(handler.pattern, handler.handler, handler.description);
            });

            // 注册命令（如果插件支持）
            if (typeof (plugin as any).registerCommands === 'function') {
                console.log(`🔗 注册插件命令: ${plugin.name}`);
                (plugin as any).registerCommands(this.router);
            }
        });

        console.log(`📦 已初始化 ${this.pluginManager.getPluginCount()} 个插件`);
    }

    /**
     * 发送视频消息 - 使用文件上传API
     */
    private async sendVideoMessage(result: any, originalMessage: milky.IncomingMessage): Promise<void> {
        try {
            const videoUri = result.content.uri;
            console.log('🎥 处理视频消息:', videoUri);

            // 从URI中提取文件路径和文件名
            let filePath: string;
            let fileName: string;

            if (videoUri.startsWith('file://')) {
                filePath = videoUri.substring(7); // 移除 'file://' 前缀
                fileName = filePath.split('/').pop() || 'video.mp4';
            } else {
                // 如果不是file://格式，直接使用
                filePath = videoUri;
                fileName = filePath.split('/').pop() || 'video.mp4';
            }

            // 清理文件名，移除特殊字符，避免上传失败
            const cleanFileName = fileName
                .replace(/[【】《》]/g, '') // 移除中文括号
                .replace(/[^\w\-_.]/g, '_') // 将特殊字符替换为下划线
                .substring(0, 100); // 限制文件名长度

            console.log('📁 文件路径:', filePath);
            console.log('📄 原文件名:', fileName);
            console.log('📄 清理后文件名:', cleanFileName);

            let fileId: string;

            if (originalMessage.message_scene === 'group') {
                // 上传群文件
                console.log('📤 上传群文件...');
                try {
                    const uploadResponse = await this.client.callApi('upload_group_file', {
                        group_id: originalMessage.peer_id,
                        parent_folder_id: '/',
                        file_uri: `file://${filePath}`,
                        file_name: cleanFileName
                    });
                    fileId = uploadResponse.file_id;
                    console.log('✅ 群文件上传成功，file_id:', fileId);
                } catch (uploadError) {
                    console.error('❌ 群文件上传失败:', uploadError);
                    // 尝试使用更简单的文件名
                    const simpleFileName = `video_${Date.now()}.mp4`;
                    console.log('🔄 尝试使用简单文件名:', simpleFileName);
                    const retryResponse = await this.client.callApi('upload_group_file', {
                        group_id: originalMessage.peer_id,
                        parent_folder_id: '/',
                        file_uri: `file://${filePath}`,
                        file_name: simpleFileName
                    });
                    fileId = retryResponse.file_id;
                    console.log('✅ 群文件上传成功（重试），file_id:', fileId);
                }
            } else if (originalMessage.message_scene === 'friend') {
                // 上传私聊文件
                console.log('📤 上传私聊文件...');
                try {
                    const uploadResponse = await this.client.callApi('upload_private_file', {
                        user_id: originalMessage.sender_id,
                        file_uri: `file://${filePath}`,
                        file_name: cleanFileName
                    });
                    fileId = uploadResponse.file_id;
                    console.log('✅ 私聊文件上传成功，file_id:', fileId);
                } catch (uploadError) {
                    console.error('❌ 私聊文件上传失败:', uploadError);
                    // 尝试使用更简单的文件名
                    const simpleFileName = `video_${Date.now()}.mp4`;
                    console.log('🔄 尝试使用简单文件名:', simpleFileName);
                    const retryResponse = await this.client.callApi('upload_private_file', {
                        user_id: originalMessage.sender_id,
                        file_uri: `file://${filePath}`,
                        file_name: simpleFileName
                    });
                    fileId = retryResponse.file_id;
                    console.log('✅ 私聊文件上传成功（重试），file_id:', fileId);
                }
            } else {
                throw new Error(`不支持的消息场景: ${originalMessage.message_scene}`);
            }

            // 发送成功消息，告知用户文件已上传
            const successMessage = {
                type: 'text' as const,
                data: {
                    text: `✅ 视频文件已上传成功！\n文件名: ${cleanFileName}\n文件ID: ${fileId}`
                }
            };

            console.log('📤 发送成功消息:', successMessage);

            let apiResponse;
            if (originalMessage.message_scene === 'group') {
                apiResponse = await this.client.callApi('send_group_message', {
                    group_id: originalMessage.peer_id,
                    message: [successMessage as any]
                });
            } else {
                apiResponse = await this.client.callApi('send_private_message', {
                    user_id: originalMessage.sender_id,
                    message: [successMessage as any]
                });
            }

            console.log('✅ 视频上传成功消息发送完成:', apiResponse);

        } catch (error) {
            console.error('❌ 发送视频消息失败:', error);
            // 发送错误消息
            const errorResult = MessageResultUtils.error('视频发送失败，请稍后重试');
            await this.sendMessage(errorResult, originalMessage);
        }
    }

    /**
     * 获取Bot状态
     */
    getStatus(): any {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            pluginCount: this.pluginManager.getPluginCount(),
            routeCount: this.router.routeCount,
            plugins: this.pluginManager.getAllPlugins().map(p => p.name)
        };
    }

    /**
     * 获取路由器（用于调试）
     */
    getRouter(): MessageRouter {
        return this.router;
    }

    /**
     * 获取插件管理器（用于调试）
     */
    getPluginManager(): PluginManager {
        return this.pluginManager;
    }
}
