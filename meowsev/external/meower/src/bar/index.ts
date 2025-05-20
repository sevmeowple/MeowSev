import { Context, Schema, Session, h } from "koishi";
import axios from "axios";
import type { BotResponse } from "../type";
import { MessageHandler } from "../utils/messageHandler";
const baseURL = "http://127.0.0.1:4060/bar";

class BAR {
  static chat_bar = (ctx: Context) =>
    ctx
      .command("bar <message> <char>")
      .action(async (session, message, char) => {
        try {
          const url = `${baseURL}/chat_bar`;
          const res = await axios.post<BotResponse>(url, { message, char });
          await MessageHandler.handle(session.session, res.data);
        } catch (err) {
          console.error(err);
        }
      });

  static apply(ctx: Context) {
    BAR.chat_bar(ctx);
    // TOOLER.bilibili(ctx);
  }
}

export { BAR };
