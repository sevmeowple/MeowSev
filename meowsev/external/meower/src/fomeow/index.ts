import { Context, Schema, h } from "koishi";
import axios from "axios";
import type { BotResponse } from "../type";
import { MessageHandler } from "../utils/messageHandler";
const baseURL = "http://127.0.0.1:4060/fomeow";

class FOMEOW {
  static random = (ctx: Context) =>
    ctx.command("随机食物").action(async (session, keyword) => {
      try {
        const url = `${baseURL}/random`;
        const res = await axios.post<BotResponse>(url, { keyword });
        await MessageHandler.handle(session.session, res.data);
      } catch (err) {
        console.error(err);
      }
    });

  static recommend = (ctx: Context) =>
    ctx.command("吃").action(async (session, keyword) => {
      try {
        const url = `${baseURL}/recommend`;
        const res = await axios.post<BotResponse>(url, { keyword });
        await MessageHandler.handle(session.session, res.data);
      } catch (err) {
        console.error(err);
      }
    });

  static apply(ctx: Context) {
    FOMEOW.random(ctx);
    FOMEOW.recommend(ctx);
  }
}

export { FOMEOW };
