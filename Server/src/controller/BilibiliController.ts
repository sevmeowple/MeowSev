import { Elysia } from "elysia";
import { BilibiliService } from "../service/Bilibili/BilibiliService";
import { RouteRegistry } from "../routes/registry";
import {
    MessageObject,
    extractRequestData,
    validateParams,
    createErrorMessage,
    createTextMessage
} from "../utils/message";
import { ConfigUnion } from "../config/config";
import { HelpRegistry } from "../utils/HelpRegistry";

// 注册B站相关路由
RouteRegistry.registerBatch([
    'bili',
    'bili-bv'
]);

// 注册帮助信息
HelpRegistry.register({
    command: 'bili',
    description: '智能搜索并下载B站视频',
    usage: 'bili [关键词] [需求描述?]',
    examples: ['bili 明日方舟', 'bili 危机合约 攻略'],
    details: '博士，如果您想看些视频放松一下，我可以帮您在 Bilibili 上搜索。您可以告诉我关键词，或者具体的需求，我会为您筛选最合适的内容。'
});

HelpRegistry.register({
    command: 'bili-bv',
    description: '通过 BV 号或链接下载视频',
    usage: 'bili-bv [BV号/链接]',
    examples: ['bili-bv BV1234567890', 'bili-bv https://www.bilibili.com/video/BV...'],
    details: '博士，如果您已经有了目标的 BV 号或链接，请直接交给我，我会立刻为您获取视频资源。'
});

// 初始化服务
const biliService = new BilibiliService(ConfigUnion);

export const biliController = new Elysia()
    .post("/bili", async ({ body }): Promise<MessageObject[]> => {
        console.log('Bili endpoint 收到请求:', JSON.stringify(body, null, 2));

        const { params, isValid } = extractRequestData(body);
        if (!isValid) {
            return [createErrorMessage("请求格式错误，需要 params 字段")];
        }

        const validation = validateParams(params, 1, "请提供搜索关键词，例如：喵喵 bili 搁浅");
        if (!validation.isValid) {
            return [validation.error!];
        }

        try {
            const [keyword, userRequirement] = params;
            console.log(`🔍 搜索关键词: ${keyword}${userRequirement ? `, 用户需求: ${userRequirement}` : ''}`);

            const result = await biliService.aiAutoDownload(keyword, userRequirement);
            return result;
        } catch (error) {
            console.error('Bili AI 处理失败:', error);
            return [createErrorMessage(`❌ 处理失败: ${error instanceof Error ? error.message : String(error)}`)];
        }
    })
    .post("/bili-bv", async ({ body }): Promise<MessageObject[]> => {
        console.log('Bili BV endpoint 收到请求:', JSON.stringify(body, null, 2));

        const { params, isValid } = extractRequestData(body);
        if (!isValid) {
            return [createErrorMessage("请求格式错误，需要 params 字段")];
        }

        const validation = validateParams(params, 1, "请提供BVID或B站链接，例如：\n喵喵 bili-bv BV1234567890\n喵喵 bili-bv https://www.bilibili.com/video/BV1234567890");
        if (!validation.isValid) {
            return [validation.error!];
        }

        try {
            const [input] = params;
            
            // 从输入中提取BVID（支持URL和直接BVID）
            let bvid = input.trim();
            
            // 检查是否是B站URL，提取BVID
            const urlMatch = input.match(/(?:bilibili\.com\/video\/)?(BV[a-zA-Z0-9]+)/);
            if (urlMatch) {
                bvid = urlMatch[1];
                console.log(`🔗 从URL提取BVID: ${bvid}`);
            } else if (input.match(/^BV[a-zA-Z0-9]+$/)) {
                console.log(`📥 直接使用BVID: ${bvid}`);
            } else {
                return [createErrorMessage("❌ 无效的BVID或B站链接格式")];
            }

            const result = await biliService.downloadByBvid(bvid);
            return result;
        } catch (error) {
            console.error('Bili BV 处理失败:', error);
            return [createErrorMessage(`❌ 处理失败: ${error instanceof Error ? error.message : String(error)}`)];
        }
    });