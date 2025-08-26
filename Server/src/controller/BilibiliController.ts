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

// 注册B站相关路由
RouteRegistry.registerBatch([
    'bili',
    'bili-bv'
]);

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