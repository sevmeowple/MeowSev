import { Context, h, Schema } from "koishi";
import * as axios from "axios";
import { pathToFileURL } from "url";

export const name = "ark";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

const baseURL = "http://127.0.0.1:4060/ark";
const AIURL = "http://127.0.0.1:4060/ai";

export function apply(ctx: Context) {
  // write your plugin here
  ctx.command("搜索 <keyword>").action((session, keyword) => {
    console.log("calling ark search");
    axios.default
      .post(`${baseURL}/search`, {
        keyword: keyword,
      })
      .then((res) => {
        session.session.send(
          h("img", { src: pathToFileURL(res.data.content).href })
        );
      })
      .catch((err) => {
        console.error(err);
        session.session.send("搜索失败喵");
      });
  });
  ctx.command("喵喵r <message> [on]").action((session, message, on) => {
    console.log("calling ai chat_R1");
    if (on) on = "true";
    else on = "false";
    axios.default
      .post(`${AIURL}/chat_R1`, {
        keyword: message,
        on: on,
      })
      .then((res) => {
        session.session.send(
          h("img", { src: pathToFileURL(res.data.content).href })
        );
      })
      .catch((err) => {
        session.session.send("喵喵r 失败喵");
      });
  });
}
