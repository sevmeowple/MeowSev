import { Context, Schema, h } from "koishi";
import axios from "axios";
import type { BotResponse } from "../type";
import { MessageHandler } from "../utils/messageHandler";
const baseURL = "http://127.0.0.1:4060/ustc";

// 定义请求参数接口
interface BusParams {
  choice: string;
  startpoint: string;
  endpoint: string;
  week: string;
  isnow: string;
}

// 定义默认值
const DEFAULT_BUS_PARAMS: BusParams = {
  choice: "高新园区班车",
  startpoint: "全部",
  endpoint: "全部",
  week: "工作日",
  isnow: "no",
} as const;

class USTC {
  static bus = (ctx: Context) =>
    ctx
      .command("bus [choice] [startpoint] [endpoint] [week] [isnow]")
      .usage(
        `
          查询校园班车信息
          可选参数：
          1. choice: 班车类型，默认为高新园区班车
            可以选择: 高新园区班车, 校园班车
          2. startpoint: 出发地，默认为全部
          3. endpoint: 目的地，默认为全部
            可以选择: 东区, 西区, 南区, 北区
          4. week: 星期，默认为工作日
            可以选择: 工作日, 节假日
          5. isnow: 是否查询当前时间，默认为no
            可以选择: now, no
        `
      )
      .action(async (session, choice, startpoint, endpoint, week, isnow) => {
        try {
          const params: BusParams = {
            choice: choice ?? DEFAULT_BUS_PARAMS.choice,
            startpoint: startpoint ?? DEFAULT_BUS_PARAMS.startpoint,
            endpoint: endpoint ?? DEFAULT_BUS_PARAMS.endpoint,
            week: week ?? DEFAULT_BUS_PARAMS.week,
            isnow: isnow ?? DEFAULT_BUS_PARAMS.isnow,
          };

          const url = `${baseURL}/bus`;
          const res = await axios.post<BotResponse>(url, params);
          await MessageHandler.handle(session.session, res.data);
        } catch (err) {
          console.error(err);
          await MessageHandler.handle(session.session, {
            type: "string",
            content: "bus信息获取失败喵",
          });
        }
      });

  static calendar = (ctx: Context) => {
    ctx.command("calendar").action(async (session) => {
      try {
        const url = `${baseURL}/calendar`;
        const res = await axios.post<BotResponse>(url);
        await MessageHandler.handle(session.session, res.data);
      } catch (err) {
        console.error(err);
        await MessageHandler.handle(session.session, {
          type: "string",
          content: "未找到日历链接",
        });
      }
    });
  };

  // 自动导出注册
  static apply(ctx: Context) {
    USTC.bus(ctx);
    USTC.calendar(ctx);
  }
}

export { USTC };
