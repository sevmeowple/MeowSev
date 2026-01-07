import { Elysia } from "elysia";
import { USTCService } from "../service/USTCService";
import { RouteRegistry } from "../routes/registry";
import {
    MessageObject,
    extractRequestData,
    createErrorMessage
} from "../utils/message";
import path from "path";
import { HelpRegistry } from "../utils/HelpRegistry";

// 注册USTC相关路由
RouteRegistry.registerBatch([
    'ustc-bus',
    'ustc-calendar',
    'ustc-bus-now',
    'ustc-bus-gx',
    'ustc-bus-xy',
    'bus',
    'holiday'
]);

// 注册帮助信息
HelpRegistry.register({
    command: 'ustc',
    description: '中国科学技术大学相关服务及节假日查询',
    usage: 'ustc-bus [类型], ustc-calendar 或 holiday [年份]',
    examples: ['ustc-bus 高新园区班车', 'ustc-calendar', 'bus (查看校车表)', 'holiday 2026'],
    details: '博士，这里是中国科学技术大学的相关信息服务。我可以为您查询校车时刻表、校历以及节假日安排，希望能对您的行程安排有所帮助。'
});

// 初始化服务
const ustcService = new USTCService();

export const ustcController = new Elysia()
    .post("/ustc-bus", async ({ body }): Promise<MessageObject[]> => {
        console.log('USTC Bus endpoint 收到请求:', JSON.stringify(body, null, 2));

        const { params, isValid } = extractRequestData(body);
        if (!isValid) {
            return [createErrorMessage("请求格式错误，需要 params 字段")];
        }

        if (params.length < 1) {
            return [createErrorMessage("请提供班车类型，例如：喵喵 ustc-bus 高新园区班车")];
        }

        try {
            const [type, start, end, week, isNow] = params;
            
            console.log(`🚌 查询班车: ${type}${start ? `, 起点: ${start}` : ''}${end ? `, 终点: ${end}` : ''}${week ? `, 时间: ${week}` : ''}${isNow === "now" ? ", 当前时间" : ""}`);

            const result = await ustcService.getBusTimetable(
                type as any,
                start as any,
                end as any,
                week as any,
                isNow === "now" ? "now" : "no"
            );

            if (!result) {
                return [createErrorMessage("❌ 获取班车时刻表失败")];
            }

            return [{
                type: "image",
                src: `file://${result}`,
                alt: "USTC校历",
                content: "📅 USTC校历"
            }];
        } catch (error) {
            console.error('USTC班车查询失败:', error);
            return [createErrorMessage(`❌ 查询失败: ${error instanceof Error ? error.message : String(error)}`)];
        }
    })

    .post("/ustc-calendar", async ({ body }): Promise<MessageObject[]> => {
        console.log('USTC Calendar endpoint 收到请求:', JSON.stringify(body, null, 2));

        try {
            const result = await ustcService.getCalendar();

            if (!result) {
                return [createErrorMessage("❌ 获取校历失败")];
            }

            return [{
                type: "image",
                src: `file://${result}`,
                alt: "USTC班车时刻表",
                content: "🚌 USTC班车时刻表"
            }];
        } catch (error) {
            console.error('USTC校历查询失败:', error);
            return [createErrorMessage(`❌ 查询失败: ${error instanceof Error ? error.message : String(error)}`)];
        }
    })

    .post("/bus", async ({ body }): Promise<MessageObject[]> => {
        const buspath = path.join(__dirname, "../../data/ustc/bus.jpg");
        return [{
            type: "image",
            src: `file://${buspath}`,
            alt: "USTC校车时刻表",
            content: "🚌 USTC校车时刻表"
        }];
    })

    .post("/ustc-bus-now", async ({ body }): Promise<MessageObject[]> => {
        console.log('USTC Bus Now endpoint 收到请求:', JSON.stringify(body, null, 2));

        const { params, isValid } = extractRequestData(body);
        let processedParams = ["高新园区班车", "全部", "全部", "工作日"];
        
        if (isValid && params.length >= 1) {
            processedParams = [
                params[0] || "高新园区班车",
                params[1] || "全部",
                params[2] || "全部",
                params[3] || "工作日"
            ];
        }

        try {
            const [type, start, end, week] = processedParams;
            
            console.log(`🚌 查询当前班车: ${type}, 起点: ${start}, 终点: ${end}, 时间: ${week}, 当前时间`);

            const result = await ustcService.getBusTimetable(
                type as any,
                start as any,
                end as any,
                week as any,
                "now"
            );

            if (!result) {
                return [createErrorMessage("❌ 获取当前班车时刻表失败")];
            }

            return [{
                type: "image",
                src: `file://${result}`,
                alt: "USTC当前班车时刻表",
                content: "🚌 USTC当前班车时刻表"
            }];
        } catch (error) {
            console.error('USTC当前班车查询失败:', error);
            return [createErrorMessage(`❌ 查询失败: ${error instanceof Error ? error.message : String(error)}`)];
        }
    })

    .post("/holiday", async ({ body }): Promise<MessageObject[]> => {
        console.log('Holiday endpoint 收到请求:', JSON.stringify(body, null, 2));

        const { params } = extractRequestData(body);
        let year = new Date().getFullYear();
        
        if (params.length > 0) {
            const parsedYear = parseInt(params[0]);
            if (!isNaN(parsedYear) && parsedYear > 2000 && parsedYear < 2100) {
                year = parsedYear;
            }
        }

        try {
            console.log(`📅 查询节假日日历: ${year}`);
            const result = await ustcService.getHolidayCalendar(year);

            if (!result) {
                return [createErrorMessage("❌ 获取节假日日历失败")];
            }

            return [{
                type: "image",
                src: `file://${result}`,
                alt: `${year}年节假日日历`,
                content: `📅 ${year}年节假日日历`
            }];
        } catch (error) {
            console.error('节假日日历查询失败:', error);
            return [createErrorMessage(`❌ 查询失败: ${error instanceof Error ? error.message : String(error)}`)];
        }
    });
