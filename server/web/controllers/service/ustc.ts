import { ustc } from "@/plugin";
import type { BotResponse } from "@/type";
import type { Location, Week, NOW, BusType } from "@/plugin/ustc";

class USTCService {
  async bus(
    choice: BusType = "高新园区班车",
    startpoint: Location = "全部",
    endpoint: Location = "全部",
    week: Week = "工作日",
    isnow: NOW = "no"
  ): Promise<BotResponse> {
    const path = await ustc.bus(choice, startpoint, endpoint, week, isnow);

    if (!path) {
      return {
        type: "string",
        content: "bus信息获取失败喵",
      };
    }

    return {
      type: "image",
      content: path,
    };
  }

  async calendar(): Promise<BotResponse> {
    const path = await ustc.calendar();

    if (!path) {
      return {
        type: "string",
        content: "未找到日历链接",
      };
    }

    return {
      type: "image",
      content: path,
    };
  }
}

export const ustcService = new USTCService();
