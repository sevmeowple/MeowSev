import type { ServerWebSocket, WebSocketHandler } from "bun";

import { messageProcess } from "@utils/message";

import { router } from "@web/router";
import { errorHandler } from "@web/middleware";
import { AIController, ArkController, HomeController } from "@web/controllers";
import { ToolerController } from "@web/controllers/toolerController";
import { USTCController } from "@web/controllers/ustcController";
import { FomeowController } from "@web/controllers/fomeowController";
import { BarController } from "@web/controllers/barController";

const homeController = new HomeController();
const arkController = new ArkController();
const aiController = new AIController();
const toolerController = new ToolerController();
const ustcController = new USTCController();
const fomeowController = new FomeowController();
const barController = new BarController();


router.get("/", homeController.index);
router.post("/ark/search", arkController.search);
router.post("/ark/randomdice", arkController.randomdice);

router.post("/ai/chat", aiController.chat);
router.post("/ai/chat_with_group", aiController.chat_with_group);
router.post("/ai/chat_R1", aiController.chat_R1);
router.post("/ai/chatARK", aiController.chatARK);

router.post("/tooler/lookup", toolerController.lookup);
router.post("/tooler/bilibili", toolerController.bilibili);
router.post("/tooler/github", toolerController.github);

router.post("/ustc/bus", ustcController.bus);
router.post("/ustc/calendar", ustcController.calendar);
router.post("/fomeow/random", fomeowController.random);
router.post("/fomeow/recommend", fomeowController.recommend);

router.post("/bar/chat_bar", barController.chat_bar);


Bun.serve({
  port: 4060,
  async fetch(request, server) {
    if (server.upgrade(request)) {
      return; // 如果是 WebSocket 请求并且升级成功，返回
    }

    try {
      const path = new URL(request.url).pathname;
      const route = router.getHandler(request.method, path);

      if (!route) {
        return new Response("Not Found", { status: 404 });
      }

      // 修改中间件链处理
      let currentRequest = request;
      for (const middleware of route.middlewares) {
        const result = await middleware(currentRequest, () =>
          route.handler(currentRequest)
        );
        if (result instanceof Response) {
          return result; // 如果中间件返回Response,直接返回
        }
        currentRequest = result as Request; // 否则更新request
      }

      return await route.handler(currentRequest);
    } catch (err: any) {
      return await errorHandler(err, request);
    }
  },
  websocket: {
    open(ws: ServerWebSocket) {
      console.log("WebSocket connection opened");
    },
    message(ws: ServerWebSocket, message: string | Buffer) {
      messageProcess.MessageHandler(JSON.parse(message.toString()));
    },
    close(ws: ServerWebSocket) {
      console.log("WebSocket connection closed");
    }
  }
});
