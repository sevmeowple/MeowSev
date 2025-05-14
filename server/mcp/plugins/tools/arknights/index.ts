import { turndown } from "@utils/turndown";
import { browserManager } from "@utils/browser";
import type { Tool, ToolParameters } from "fastmcp";
import { type } from "arktype";
import { string } from "arktype/internal/keywords/string.ts";
// https://wiki.biligame.com/arknights/%E8%95%BE%E7%BC%AA%E5%AE%89
class ArkTool {
    baseurl = "https://wiki.biligame.com/arknights/";
    async getCharInfo(char: string): Promise<string> {
        const browser = await browserManager.getBrowser();
        const page = await browser.newPage();
        await page.goto(
            this.baseurl + encodeURIComponent(char), {
            waitUntil: "networkidle2",
            timeout: 30000,
        });

        // 检查是否存在搜索结果页
        const searchResults = await page.$("#mw-content-text");
        const element = searchResults || (await page.$("#mw-content-text"));
        if (!element) {
            throw new Error("No content element found");
        }
        let html: string = "";
        if (element) {
            html = await page.evaluate((el) => el.outerHTML, element);
        }
        // 6. 移除 inline style 属性
        const preprocessedHtml = html.replace(/\s*style=("[^"]*"|'[^']*')/g, '');

        const md = turndown.turndown(preprocessedHtml);
        page.close();
        return md;
    }
}
const arkTool = new ArkTool();
const arkToolSchema: Tool<undefined, ToolParameters> = {
    name: "arknights",
    description: "Get Arknights character info",
    parameters: type({
        char: "string",
    }),
    execute: async (args: any) => {
        return arkTool.getCharInfo(args.char);
    }
};

export { arkToolSchema }