import { Elysia } from "elysia";
import { msgController } from "@controller/MsgController"
import { rootController } from "@controller/RootController";
import { memeController } from "@controller/MemeController";
import { trpgController } from "@controller/TRPGController";
import {gameController} from "@controller/GameController";
import { biliController } from "@controller/BilibiliController";


import { ConfigUnion } from "./config/config";
import { authPlugin } from "./middleware/auth";

const app = new Elysia()
  .use(authPlugin) // 使用认证插件
  .use(msgController)
  .use(rootController)
  .use(memeController)
  .use(trpgController)
  .use(gameController)
  .use(biliController)
  .listen(6040);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
