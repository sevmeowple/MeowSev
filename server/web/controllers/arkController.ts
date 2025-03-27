import { arknights } from "./service/arknights";

class ArkController {
  async search(req: Request) {
    const body = await req.json();
    const keyword = body.keyword;

    if (!keyword) {
      return new Response("Keyword not found", { status: 400 });
    }

    const result = await arknights.prts.search(keyword);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async randomdice(req: Request) {
    const body = await req.json();
    const n = body.n;
    let m = body.m;
    if (!n) {
      return new Response("Number not found", { status: 400 });
    }
    if (!m) m = 6;

    const result = await arknights.ark.randomdice(n, m);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export { ArkController };
