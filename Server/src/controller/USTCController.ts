import { Elysia } from "elysia";
import { USTCService } from "../service/USTCService";
import { RouteRegistry } from "../routes/registry";
import {
    MessageObject,
    extractRequestData,
    createErrorMessage
} from "../utils/message";
import path from "path";

// 注册USTC相关路由
RouteRegistry.registerBatch([
    'ustc-bus',
    'ustc-calendar',
    'ustc-bus-now',
    'ustc-bus-gx',
    'ustc-bus-xy',
    'bus'
]);

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
