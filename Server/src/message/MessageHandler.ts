import { MessageContext } from './MessageContext';
import { MessageResult } from './MessageResult';

/**
 * 消息处理器接口
 * 所有消息处理函数都应该实现这个接口
 */
export type MessageHandler = (context: MessageContext) => Promise<MessageResult | MessageResult[]>;

/**
 * 插件接口
 * 每个插件都应该实现这个接口
 */
export interface Plugin {
    /** 插件名称 */
    name: string;
    
    /** 插件描述 */
    description?: string;
    
    /** 插件版本 */
    version?: string;
    
    /** 插件是否启用 */
    enabled?: boolean;
    
    /** 初始化插件 */
    init?(): Promise<void>;
    
    /** 销毁插件 */
    destroy?(): Promise<void>;
    
    /** 获取插件的路由处理器 */
    getHandlers(): PluginHandler[];
}

/**
 * 插件处理器接口
 */
export interface PluginHandler {
    /** 处理器名称 */
    name: string;
    
    /** 匹配模式 */
    pattern: string | RegExp;
    
    /** 处理函数 */
    handler: MessageHandler;
    
    /** 处理器描述 */
    description?: string;
    
    /** 是否启用 */
    enabled?: boolean;
}

/**
 * 基础插件类
 * 提供插件的基本功能
 */
export abstract class BasePlugin implements Plugin {
    public name: string;
    public description?: string;
    public version?: string;
    public enabled: boolean = true;

    constructor(name: string, description?: string, version?: string) {
        this.name = name;
        this.description = description;
        this.version = version;
    }

    async init(): Promise<void> {
        // 子类可以重写此方法
    }

    async destroy(): Promise<void> {
        // 子类可以重写此方法
    }

    abstract getHandlers(): PluginHandler[];

    /**
     * 创建处理器
     */
    protected createHandler(
        name: string,
        pattern: string | RegExp,
        handler: MessageHandler,
        description?: string
    ): PluginHandler {
        return {
            name,
            pattern,
            handler,
            description,
            enabled: true
        };
    }

    /**
     * 创建前缀处理器
     */
    protected createPrefixHandler(
        name: string,
        prefix: string,
        handler: MessageHandler,
        description?: string
    ): PluginHandler {
        const pattern = new RegExp(`^${prefix}(?:\\s+(.+))?$`, 'i');
        return this.createHandler(name, pattern, handler, description);
    }
}

/**
 * 消息处理器工具函数
 */
export class MessageHandlerUtils {
    /**
     * 创建简单的文本响应
     */
    static createTextResponse(content: string): MessageResult {
        return {
            type: 'text',
            content
        };
    }

    /**
     * 创建错误响应
     */
    static createErrorResponse(message: string): MessageResult {
        return {
            type: 'text',
            content: `❌ ${message}`
        };
    }

    /**
     * 创建成功响应
     */
    static createSuccessResponse(message: string): MessageResult {
        return {
            type: 'text',
            content: `✅ ${message}`
        };
    }

    static createImageResponse(imageData: { uri: string; sub_type?: string }): MessageResult {
        return {
            type: 'image',
            content: {
                uri: imageData.uri,
                sub_type: imageData.sub_type || 'normal'
            }
        };
    }

    static createVideoResponse(videoData: { uri: string; thumb_uri?: string }): MessageResult {
        return {
            type: 'video',
            content: {
                uri: videoData.uri,
                thumb_uri: videoData.thumb_uri
            }
        };
    }

    /**
     * 创建帮助响应
     */
    static createHelpResponse(commands: Array<{ command: string; description: string }>): MessageResult {
        const helpText = commands
            .map(cmd => `• ${cmd.command} - ${cmd.description}`)
            .join('\n');
        
        return {
            type: 'text',
            content: `📖 使用说明：\n${helpText}`
        };
    }

    /**
     * 检查用户权限
     */
    static checkPermission(context: MessageContext, requiredRole?: string): boolean {
        if (!requiredRole) return true;
        
        const userRole = context.sender?.role;
        const roleHierarchy = ['member', 'admin', 'owner'];
        
        const userLevel = roleHierarchy.indexOf(userRole || 'member');
        const requiredLevel = roleHierarchy.indexOf(requiredRole);
        
        return userLevel >= requiredLevel;
    }

    /**
     * 提取命令参数
     */
    static extractParams(context: MessageContext): string[] {
        return context.params || [];
    }

    /**
     * 提取命令后的文本
     */
    static extractTextAfterCommand(context: MessageContext): string {
        const params = this.extractParams(context);
        return params.join(' ').trim();
    }
}
