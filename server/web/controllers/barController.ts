import { barService } from "./service/bar";

class BarController {
  async chat_bar(req: Request) {
    const body = await req.json();
    const message = body.message;
    const char = body.char;

    const result = await barService.chat_Bar(message, char);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export { BarController };
