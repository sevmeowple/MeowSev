# 喵喵 Bot

## 部署指南

WIP(也许会有吧...)

## 功能添加指南

指令式命令例如想要实现类似`喵喵 help`一般步骤为

- 在`src/service`创建对应文件:
  - _规范命名为_:`HelpService.ts`即首字母大写驼峰命名法
  - _如果 service 需要大量代码可以作为文件夹存放_:具体参照`Bilibili`实现
  - _service 编写可以依赖其他 service_:例如依赖`MsgService`来获取消息(注意不要循环依赖哦)
  - _通用的各个 service 依赖的工具又不会实现成命令的存放在`src/utils`下_:例如`browser.ts`
  - _最终请导出为一个统一的类_:`export class HelpService {...}`
- 在`src/controller`创建对应文件:
  - _规范命名为_:`HelpController.ts`即首字母大写驼峰命名法
  - _Controller 的职责是处理命令命名和命令参数和结果解析处理_

这里以 USTCController 为例

```typescript
import { Elysia } from "elysia";
import { USTCService } from "../service/USTCService";
import { RouteRegistry } from "../routes/registry";
import {
    MessageObject,
    extractRequestData,
    createErrorMessage
} from "../utils/message";
import path from "path";
//以上为必要的导入,对应不同controller可以替换上面的service的导入


// 注册USTC相关路由
// 这里命令注册是为了保证命令的唯一性和可扩展性
// 例如如果有多个相关的命令可以在这里注册
// 注意请保证下面实现路由仅从下面注册的命令中挑选
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
// 请使用post注册路由
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
    ...
```
