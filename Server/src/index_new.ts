import { BotCore } from './core/BotCore';
import { ConfigUnion } from './config/config';
import { RootPlugin } from './plugin/RootPlugin';
import { MemePlugin } from './plugin/MemePlugin';
import { USTCPlugin } from './plugin/USTCPlugin';
import { BiliPlugin } from './plugin/BiliPlugin';

/**
 * 新的Bot入口文件
 * 替换原来的HTTP服务器，使用MilkyClient直接连接
 * 支持插件系统，可以像旧版本Elysia一样使用.use()方法注册插件
 * 
 * 使用方式：
 * 1. 创建BotCore实例
 * 2. 使用链式调用注册插件：.use(new Plugin())
 * 3. 调用start()启动Bot
 * 
 * 示例：
 * const bot = new BotCore()
 *   .use(new RootPlugin())
 *   .use(new MemePlugin());
 * await bot.start();
 */

// 从配置中读取连接参数
const MILKY_HOST = process.env.MILKY_HOST || '127.0.0.1';
const MILKY_PORT = parseInt(process.env.MILKY_PORT || '3099');
const MILKY_PATH = process.env.MILKY_PATH || '/';

// 创建Bot实例并注册插件 - 像旧版本Elysia一样使用链式调用
const bot = new BotCore(MILKY_HOST, MILKY_PORT, MILKY_PATH)
  .use(new RootPlugin())
  .use(new MemePlugin())
  .use(new USTCPlugin())
  .use(new BiliPlugin());
  // 可以继续添加其他插件
  // .use(new TRPGPlugin())
  // .use(new GamePlugin())
  // .use(new TemplatePlugin())

// 优雅关闭处理
process.on('SIGINT', async () => {
    console.log('\n🛑 收到SIGINT信号，正在关闭Bot...');
    try {
        await bot.stop();
        process.exit(0);
    } catch (error) {
        console.error('❌ 关闭Bot失败:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 收到SIGTERM信号，正在关闭Bot...');
    try {
        await bot.stop();
        process.exit(0);
    } catch (error) {
        console.error('❌ 关闭Bot失败:', error);
        process.exit(1);
    }
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获异常:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的Promise拒绝:', reason);
    process.exit(1);
});

// 启动Bot
async function startBot() {
    try {
        console.log('🚀 启动MeowSev Bot...');
        console.log('📋 配置信息:');
        console.log(`   - Milky服务器: ${MILKY_HOST}:${MILKY_PORT}${MILKY_PATH}`);
        console.log(`   - 配置文件: ${ConfigUnion ? '已加载' : '未加载'}`);
        
        await bot.start();
        
        console.log(`🦊 Bot is running and connected to Milky at ${MILKY_HOST}:${MILKY_PORT}${MILKY_PATH}`);
        
        // 定期输出状态信息
        setInterval(() => {
            const status = bot.getStatus();
            console.log('📊 Bot状态:', {
                connected: status.connected,
                plugins: status.pluginCount,
                routes: status.routeCount
            });
        }, 600000); // 每10分钟输出一次
        
    } catch (error) {
        console.error('❌ 启动Bot失败:', error);
        process.exit(1);
    }
}

// 启动
startBot();
