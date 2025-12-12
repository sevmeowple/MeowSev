import { MessageHandler } from './MessageHandler';
import { MessageContext } from './MessageContext';
import { MessageResult } from './MessageResult';
import * as milky from '@saltify/milky-types';

export interface Route {
    pattern: string | RegExp;
    handler: MessageHandler;
    description?: string;
}

export class MessageRouter {
    private routes: Route[] = [];
    private defaultHandler?: MessageHandler;
    private commandRegistry: Map<string, MessageHandler> = new Map();
    private fallbackHandler?: MessageHandler;

    /**
     * 注册路由
     * @param pattern 匹配模式，可以是字符串或正则
     * @param handler 处理函数
     * @param description 路由描述，用于帮助信息
     */
    register(pattern: string | RegExp, handler: MessageHandler, description?: string): void {
        this.routes.push({
            pattern,
            handler,
            description
        });
    }

    /**
     * 注册前缀路由，自动处理前缀后的参数
     * @param prefix 前缀字符串
     * @param handler 处理函数
     * @param description 路由描述
     */
    registerPrefix(prefix: string, handler: MessageHandler, description?: string): void {
        const pattern = new RegExp(`^${prefix}(?:\\s+(.+))?$`, 'i');
        this.routes.push({
            pattern,
            handler,
            description
        });
    }

    /**
     * 设置默认处理器（兜底路由）
     * @param handler 默认处理函数
     */
    setDefaultHandler(handler: MessageHandler): void {
        this.defaultHandler = handler;
    }

    /**
     * 注册命令到命令注册表
     * @param command 命令名称（不包含"喵喵"前缀）
     * @param handler 处理函数
     * @param description 命令描述
     */
    registerCommand(command: string, handler: MessageHandler, description?: string): void {
        this.commandRegistry.set(command, handler);
        console.log(`📝 注册命令: ${command} - ${description || '无描述'}`);
    }

    /**
     * 设置兜底处理器（当命令不在注册表中时使用）
     * @param handler 兜底处理函数
     */
    setFallbackHandler(handler: MessageHandler): void {
        this.fallbackHandler = handler;
        console.log('🔄 设置兜底处理器');
    }

    /**
     * 处理消息
     * @param message 原始消息对象
     * @returns 处理结果数组
     */
    async process(message: milky.IncomingMessage): Promise<MessageResult[]> {
        const context = this.createContext(message);
        const text = this.extractText(message);
        
        // 检查是否以"喵喵 "开头（必须有空格且后面有内容）
        const meowMatch = text.match(/^喵喵\s+(.+)$/i);
        if (!meowMatch) {
            // 不是以"喵喵 "开头的消息，使用传统路由匹配
            return this.processTraditionalRoutes(context, text);
        }

        // 提取命令和参数
        const commandText = meowMatch[1].trim();
        const [command, ...params] = commandText.split(/\s+/);
        
        console.log(`🔍 解析命令: "${command}", 参数: [${params.join(', ')}]`);

        // 在命令注册表中查找
        console.log(`🔍 查找命令: "${command}", 注册表大小: ${this.commandRegistry.size}`);
        console.log(`📋 已注册命令: [${Array.from(this.commandRegistry.keys()).join(', ')}]`);
        
        if (command && this.commandRegistry.has(command)) {
            const handler = this.commandRegistry.get(command)!;
            const routeContext = {
                ...context,
                params: params,
                command: command,
                match: { params: params, command: command }
            };
            
            try {
                console.log(`✅ 找到注册命令: ${command}`);
                const result = await handler(routeContext);
                return Array.isArray(result) ? result : [result];
            } catch (error) {
                console.error(`Command handler failed:`, error);
                return [{
                    type: 'text',
                    content: `❌ 处理失败: ${(error as Error).message}`
                }];
            }
        } else {
            console.log(`❌ 命令 "${command}" 未找到在注册表中`);
        }

        // 使用兜底处理器
        if (this.fallbackHandler) {
            const routeContext = {
                ...context,
                params: [commandText], // 将整个命令文本作为参数
                command: 'fallback',
                match: { params: [commandText], command: 'fallback' }
            };
            
            try {
                console.log(`🔄 使用兜底处理器处理: "${commandText}"`);
                const result = await this.fallbackHandler(routeContext);
                return Array.isArray(result) ? result : [result];
            } catch (error) {
                console.error(`Fallback handler failed:`, error);
                return [{
                    type: 'text',
                    content: `❌ 处理失败: ${(error as Error).message}`
                }];
            }
        }

        // 无法处理的消息不发送任何响应，避免自己触发自己
        return [];
    }

    /**
     * 处理传统路由（非"喵喵"开头的消息）
     */
    private async processTraditionalRoutes(context: MessageContext, text: string): Promise<MessageResult[]> {
        // 顺序匹配，第一个匹配的生效
        for (const route of this.routes) {
            const match = this.match(route.pattern, text);
            if (match) {
                const routeContext = {
                    ...context,
                    params: match.params || [],
                    command: match.command || '',
                    match: match
                };
                
                try {
                    const result = await route.handler(routeContext);
                    return Array.isArray(result) ? result : [result];
                } catch (error) {
                    console.error(`Route handler failed:`, error);
                    return [{
                        type: 'text',
                        content: `❌ 处理失败: ${(error as Error).message}`
                    }];
                }
            }
        }

        // 兜底处理
        if (this.defaultHandler) {
            try {
                const result = await this.defaultHandler(context);
                return Array.isArray(result) ? result : [result];
            } catch (error) {
                console.error(`Default handler failed:`, error);
                return [{
                    type: 'text',
                    content: `❌ 处理失败: ${(error as Error).message}`
                }];
            }
        }

        // 无法处理的消息不发送任何响应，避免自己触发自己
        return [];
    }

    /**
     * 获取所有路由信息，用于帮助信息
     */
    getRoutes(): Array<{ pattern: string; description?: string }> {
        return this.routes.map(route => ({
            pattern: route.pattern.toString(),
            description: route.description
        }));
    }

    /**
     * 清空所有路由
     */
    clear(): void {
        this.routes = [];
        this.defaultHandler = undefined;
    }

    /**
     * 获取路由数量
     */
    get routeCount(): number {
        return this.routes.length;
    }

    /**
     * 获取命令注册表信息
     */
    getCommandRegistry(): Array<{ command: string; description?: string }> {
        return Array.from(this.commandRegistry.keys()).map(command => ({
            command,
            description: `命令: ${command}`
        }));
    }

    /**
     * 获取所有注册的命令
     */
    getRegisteredCommands(): string[] {
        return Array.from(this.commandRegistry.keys());
    }

    /**
     * 创建消息上下文
     */
    private createContext(message: milky.IncomingMessage): MessageContext {
        return {
            message,
            text: this.extractText(message),
            sender: this.extractSender(message),
            group: this.extractGroup(message),
            timestamp: message.time
        };
    }

    /**
     * 从消息中提取文本内容
     */
    private extractText(message: milky.IncomingMessage): string {
        if (!message.segments) return '';
        
        return message.segments
            .filter((segment) => segment.type === 'text')
            .map((segment) => (segment as any).data.text)
            .join(' ')
            .trim();
    }

    /**
     * 提取发送者信息
     */
    private extractSender(message: milky.IncomingMessage): milky.GroupMemberEntity | milky.FriendEntity | undefined {
        if (message.message_scene === 'group') {
            return (message as any).group_member;
        } else if (message.message_scene === 'friend') {
            return (message as any).friend;
        }
        return undefined;
    }

    /**
     * 提取群组信息
     */
    private extractGroup(message: milky.IncomingMessage): milky.GroupEntity | undefined {
        if (message.message_scene === 'group') {
            return (message as any).group;
        }
        return undefined;
    }

    /**
     * 匹配路由模式
     */
    private match(pattern: string | RegExp, text: string): { params: string[]; command: string } | null {
        if (typeof pattern === 'string') {
            if (text === pattern) {
                return { params: [], command: pattern };
            }
            return null;
        }

        const match = text.match(pattern);
        if (match) {
            return {
                params: match.slice(1).filter(Boolean),
                command: match[0]
            };
        }

        return null;
    }
}
