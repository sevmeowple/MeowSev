import { Context, Schema, Session, h } from "koishi";
import axios from "axios";
import type { BotResponse } from "../type";
import { MessageHandler } from "../utils/messageHandler";
const baseURL = "http://127.0.0.1:4060/tooler";

class TOOLER {
  static lookup = (ctx: Context) =>
    ctx.command("kk <keyword>").action(async (session, keyword) => {
      try {
        const url = `${baseURL}/lookup`;
        const res = await axios.post<BotResponse>(url, { keyword });
        await MessageHandler.handle(session.session, res.data);
      } catch (err) {
        console.error(err);
      }
    });

  /**
   * 监听信息,当消息中包含https://www.bilibili.com/video/ | https://b23.tv/ 
   * 时,调用返回略图
   * @param ctx
   * @returns
   */
  static bilibili = (session: Session) => {
    if (session.content.includes("https://www.bilibili.com/video/") || session.content.includes("https://b23.tv/")) {
      const url = `${baseURL}/bilibili`;
      axios.post<BotResponse>(url, {
        url: session.content,
      }).then(res => {
        MessageHandler.handle(session, res.data);
      }).catch(err => {
        console.error(err);
      });
    }
  }

  static github = (session: Session) => {
    if (session.content.includes("github")) {
      const url = `${baseURL}/github`;
      axios.post<BotResponse>(url, {
        url: session.content,
      }).then(res => {
        MessageHandler.handle(session, res.data);
      }).catch(err => {
        console.error(err);
      });
    }
  }



  static apply(ctx: Context) {
    TOOLER.lookup(ctx);
    // TOOLER.bilibili(ctx);
  }
}

export { TOOLER };
