import { Elysia } from "elysia";
import { msgController } from "@controller/MsgController"
import { rootController } from "@controller/RootController";

import { ConfigUnion } from "./config/config";

const app = new Elysia()
  .use(msgController)
  .use(rootController)
  .listen(6040);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
