import { Context, Schema } from "koishi";
import { TOOLER } from "./tooler";
import { USTC } from "./ustc";
import { FOMEOW } from "./fomeow";
import { ARK } from "./arknights";
import { BAR } from "./bar";
import axios from "axios";
import { MessageHandler } from "./utils/messageHandler";
import type { BotResponse } from "./type";
const baseURL = "http://127.0.0.1:4060/tooler";

export const name = "meower";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {
  // write your plugin here
  TOOLER.lookup(ctx);
  USTC.apply(ctx);
  FOMEOW.apply(ctx);
  ARK.apply(ctx);
  BAR.apply(ctx);

  ctx.on("message", async (session) => {
    TOOLER.bilibili(session);
    TOOLER.github(session);
  });
}
