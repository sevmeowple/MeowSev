import { Elysia } from "elysia";
import { msgController } from "@controller/MsgController"
import { rootController } from "@controller/RootController";
import { memeController } from "@controller/MemeController";
import { trpgController } from "@controller/TRPGController";
import {gameController} from "@controller/GameController";
import { biliController } from "@controller/BilibiliController";
import { ustcController } from "@controller/USTCController";
import { templateController } from "@controller/TemplateController";
import { reportController } from "./controller/ReportController";
import { arknightsController } from "./controller/ArknightsController";
import { summaryController } from "./controller/SummaryController";
import { catController } from "./controller/CatController";
import { agentController } from "./controller/AgentController";
import { reservationController } from "./controller/ReservationController";
import { profileController } from "./controller/ProfileController";
import { adminProfileController } from "./controller/AdminProfileController";

import { ConfigUnion } from "./config/config";
import { authPlugin } from "./middleware/auth";
import { registerShutdown } from "./shutdown";

// 导入 Bilibili 缓存定时清理服务
import { startBilibiliCacheScheduler } from "./service/Bilibili/scheduler";

const app = new Elysia()
  .use(authPlugin) // 使用认证插件
  .use(msgController)
  .use(rootController)
  .use(memeController)
  .use(trpgController)
  .use(gameController)
  .use(biliController)
  .use(ustcController)  
  .use(templateController)
  .use(reportController)
  .use(arknightsController)
  .use(summaryController)
  .use(catController)
  .use(agentController)
  .use(reservationController)
  .use(profileController)
  .use(adminProfileController)
  .listen(6040);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

// 注册优雅关闭
registerShutdown(app);

// 启动 Bilibili 缓存定时清理任务（每日7:00清理超过2天的视频）
startBilibiliCacheScheduler();
