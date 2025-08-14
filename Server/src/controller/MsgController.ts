import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { MsgService } from "@service/MsgService";
import { ConfigUnion } from "@/config/config";
import { createXiaohongshuProcessor } from "@/service/message/processors/xhsProcessor";
const msgService = new MsgService(ConfigUnion);

// msgService.registerProcessor(createXiaohongshuProcessor(ConfigUnion))
// 注册当前控制器的路由
RouteRegistry.registerBatch(['message']);

//   ctx.on('message', async (session) => {
//     // 所有的message转发到/message端点下面
//     const endpoint = 'message'
//     const url = `http://127.0.0.1:6040/${endpoint}`
//     const query = { content: session.content }
//     // 只发送请求不处理响应
//     try {
//       await axios.get(url, { params: query })
//     }
//     catch (err: any) {
//       console.error(`转发消息失败：${err.message}`)
//     }
//   })

export const msgController = new Elysia()
    .post("/message", ({ body }) => {  // 改为读取 body
        // console.log('Received body:', body);

        // 处理收到的消息
        if (body && typeof body === 'object' && 'data' in body) {
            // console.debug('Received message data:', body.data);
            msgService.handleMessage(body.data as any);
            // return {
            //     success: true,
            //     message: "Message handled successfully"
            // };
        }

        // return {
        //     success: false,
        //     message: "Invalid message format"
        // };
    });