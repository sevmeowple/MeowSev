import type { BusType, Location, NOW, Week } from "@/plugin";
import { ustcService } from "./service/ustc";

// types.ts
interface BusQueryParams {
  choice?: BusType;
  startpoint?: Location;
  endpoint?: Location;
  week?: Week;
  isnow?: NOW;
}

class USTCController {
  async bus(req: Request) {
    const body = (await req.json()) as BusQueryParams;
    const choice = body.choice ?? "高新园区班车";
    const startpoint = body.startpoint ?? "全部";
    const endpoint = body.endpoint ?? "全部";
    const week = body.week ?? "工作日";
    const isnow = body.isnow ?? "no";

    const result = await ustcService.bus(
      choice,
      startpoint,
      endpoint,
      week,
      isnow
    );

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async calendar(req: Request) {
    const result = await ustcService.calendar();

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export { USTCController };
