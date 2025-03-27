import { toolerService } from "./service/tooler";

class ToolerController {
  async lookup(req: Request) {
    const body = await req.json();
    const keyword = body.keyword;

    if (!keyword) {
      return new Response("Keyword not found", { status: 400 });
    }

    const result = await toolerService.lookup(keyword);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async bilibili(req: Request) {
    const body = await req.json();
    const url = body.url;

    if (!url) {
      return new Response("Url not found", { status: 400 });
    }

    const result = await toolerService.bilibili(url);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async github(req: Request) {
    const body = await req.json();
    const url = body.url;

    if (!url) {
      return new Response("Url not found", { status: 400 });
    }

    const result = await toolerService.github(url);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export { ToolerController };