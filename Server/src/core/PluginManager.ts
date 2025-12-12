import { Plugin, BasePlugin } from '../message/MessageHandler';

/**
 * 插件管理器
 * 负责插件的注册、初始化、销毁等生命周期管理
 */
export class PluginManager {
    private plugins: Map<string, Plugin> = new Map();
    private initialized: boolean = false;

    /**
     * 注册插件
     */
    async registerPlugin(plugin: Plugin): Promise<void> {
        if (this.plugins.has(plugin.name)) {
            console.warn(`⚠️ 插件 ${plugin.name} 已存在，将被覆盖`);
        }

        this.plugins.set(plugin.name, plugin);
        console.log(`📦 注册插件: ${plugin.name}`);

        // 如果已经初始化，立即初始化新插件
        if (this.initialized && plugin.init) {
            try {
                await plugin.init();
                console.log(`✅ 插件 ${plugin.name} 初始化完成`);
            } catch (error) {
                console.error(`❌ 插件 ${plugin.name} 初始化失败:`, error);
            }
        }
    }

    /**
     * 注销插件
     */
    async unregisterPlugin(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            console.warn(`⚠️ 插件 ${pluginName} 不存在`);
            return;
        }

        // 销毁插件
        if (plugin.destroy) {
            try {
                await plugin.destroy();
                console.log(`✅ 插件 ${pluginName} 销毁完成`);
            } catch (error) {
                console.error(`❌ 插件 ${pluginName} 销毁失败:`, error);
            }
        }

        this.plugins.delete(pluginName);
        console.log(`🗑️ 注销插件: ${pluginName}`);
    }

    /**
     * 获取插件
     */
    getPlugin(pluginName: string): Plugin | undefined {
        return this.plugins.get(pluginName);
    }

    /**
     * 获取所有插件
     */
    getAllPlugins(): Plugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * 获取启用的插件
     */
    getEnabledPlugins(): Plugin[] {
        return this.getAllPlugins().filter(plugin => plugin.enabled !== false);
    }

    /**
     * 获取插件数量
     */
    getPluginCount(): number {
        return this.plugins.size;
    }

    /**
     * 检查插件是否存在
     */
    hasPlugin(pluginName: string): boolean {
        return this.plugins.has(pluginName);
    }

    /**
     * 启用插件
     */
    async enablePlugin(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`插件 ${pluginName} 不存在`);
        }

        plugin.enabled = true;
        console.log(`✅ 启用插件: ${pluginName}`);
    }

    /**
     * 禁用插件
     */
    async disablePlugin(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`插件 ${pluginName} 不存在`);
        }

        plugin.enabled = false;
        console.log(`❌ 禁用插件: ${pluginName}`);
    }

    /**
     * 初始化所有插件
     */
    async initializeAll(): Promise<void> {
        if (this.initialized) {
            console.warn('⚠️ 插件管理器已经初始化');
            return;
        }

        console.log(`🚀 开始初始化 ${this.plugins.size} 个插件...`);

        const initPromises = Array.from(this.plugins.values()).map(async (plugin) => {
            if (plugin.init) {
                try {
                    await plugin.init();
                    console.log(`✅ 插件 ${plugin.name} 初始化完成`);
                } catch (error) {
                    console.error(`❌ 插件 ${plugin.name} 初始化失败:`, error);
                    throw error;
                }
            }
        });

        await Promise.all(initPromises);
        this.initialized = true;
        console.log(`🎉 所有插件初始化完成`);
    }

    /**
     * 销毁所有插件
     */
    async destroyAll(): Promise<void> {
        console.log(`🛑 开始销毁 ${this.plugins.size} 个插件...`);

        const destroyPromises = Array.from(this.plugins.values()).map(async (plugin) => {
            if (plugin.destroy) {
                try {
                    await plugin.destroy();
                    console.log(`✅ 插件 ${plugin.name} 销毁完成`);
                } catch (error) {
                    console.error(`❌ 插件 ${plugin.name} 销毁失败:`, error);
                }
            }
        });

        await Promise.all(destroyPromises);
        this.initialized = false;
        console.log(`🎉 所有插件销毁完成`);
    }

    /**
     * 重新加载插件
     */
    async reloadPlugin(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`插件 ${pluginName} 不存在`);
        }

        console.log(`🔄 重新加载插件: ${pluginName}`);

        // 销毁插件
        if (plugin.destroy) {
            try {
                await plugin.destroy();
            } catch (error) {
                console.error(`❌ 插件 ${pluginName} 销毁失败:`, error);
            }
        }

        // 重新初始化插件
        if (plugin.init) {
            try {
                await plugin.init();
                console.log(`✅ 插件 ${pluginName} 重新加载完成`);
            } catch (error) {
                console.error(`❌ 插件 ${pluginName} 重新加载失败:`, error);
                throw error;
            }
        }
    }

    /**
     * 获取插件信息
     */
    getPluginInfo(pluginName: string): any {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            return null;
        }

        return {
            name: plugin.name,
            description: plugin.description,
            version: plugin.version,
            enabled: plugin.enabled,
            handlers: plugin.getHandlers().map(handler => ({
                name: handler.name,
                pattern: handler.pattern.toString(),
                description: handler.description,
                enabled: handler.enabled
            }))
        };
    }

    /**
     * 获取所有插件信息
     */
    getAllPluginInfo(): any[] {
        return Array.from(this.plugins.keys()).map(name => this.getPluginInfo(name));
    }

    /**
     * 清空所有插件
     */
    async clear(): Promise<void> {
        await this.destroyAll();
        this.plugins.clear();
        console.log('🗑️ 已清空所有插件');
    }

    /**
     * 检查是否已初始化
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}
