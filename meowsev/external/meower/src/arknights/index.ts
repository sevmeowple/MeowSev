import { Context, Schema, h } from "koishi";
import axios from "axios";
import type { BotResponse } from "../type";
import { MessageHandler } from "../utils/messageHandler";
const baseURL = "http://127.0.0.1:4060/ark";


class ARK {
  static randomdice = (ctx: Context) =>
    ctx.command("骰子 [n] [m]").action(async (session, n, m) => {
      try {
        const url = `${baseURL}/randomdice`;
        if (!n) n = "1";
        if (!m) m = "6";
        const res = await axios.post<BotResponse>(url, { n, m });
        await MessageHandler.handle(session.session, res.data);
      } catch (err) {
        console.error(err);
      }
    });

  static tagGacha = (ctx: Context) => 
    ctx.command("公招 [...tags]").action(async (session, ...tags) => {
      try {
        const url = `${baseURL}/tagGacha`;
        const res = await axios.post<BotResponse>(url, { tags });
        await MessageHandler.handle(session.session, res.data);
      } catch (err) {
        console.error(err);
      }
    });

  static apply(ctx: Context) {
    ARK.randomdice(ctx);
    ARK.tagGacha(ctx);
  }
}

export { ARK };
