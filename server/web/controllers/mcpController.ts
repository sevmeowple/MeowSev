import { mcpService } from "./service/mcp";

class MCPController {
    async chat(req: Request) {
        const body = await req.json();
        const keyword = body.keyword;

        if (!keyword) {
            return new Response("Keyword not found", { status: 400 });
        }

        const result = await mcpService.chat(keyword);

        return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
        });
    }
}
export { MCPController };