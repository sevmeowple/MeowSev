import { fomeowService } from "./service/fomeow";

class FomeowController {
  async random(req: Request) {
    const body = await req.json();
    // const keyword = body.keyword;

    // if (!keyword) {
    //   return new Response("Keyword not found", { status: 400 });
    // }

    const result = await fomeowService.random();

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async recommend(req: Request) {
    const result = await fomeowService.recommend();

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export { FomeowController };