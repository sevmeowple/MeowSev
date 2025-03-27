// import { ai } from "./service/arknights";
import { AIservice } from "./service/ai";

class AIController {
  async chat(req: Request) {
    const body = await req.json();
    const keyword = body.keyword;

    if (!keyword) {
      return new Response("Keyword not found", { status: 400 });
    }

    const result = await AIservice.chat(keyword);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async chat_with_group(req: Request) {
    const body = await req.json();
    const keyword = body.keyword;

    if (!keyword) {
      return new Response("Keyword not found", { status: 400 });
    }

    const result = await AIservice.chat_with_group(keyword);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async chat_R1(req: Request) {
    const body = await req.json();
    const keyword = body.keyword;
    let on = false;
    if (body.on == "true") {
      on = body.on;
    } else on = false;
    if (!keyword) {
      return new Response("Keyword not found", { status: 400 });
    }

    const result = await AIservice.chat_R1(keyword, on);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async chatARK(req: Request) {
    const body = await req.json();
    const keyword = body.keyword;
    const charactor = body.charactor;
    let charactor2;
    if (body.charactor2) {
      charactor2 = body.charactor2;
    } else charactor2 = undefined;

    if (!keyword) {
      return new Response("Keyword not found", { status: 400 });
    }

    const result = await AIservice.chatARK(keyword, charactor, charactor2);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export { AIController };
