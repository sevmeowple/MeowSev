import { turndown } from "@utils/turndown";
import { browserManager } from "@utils/browser";
import type { Tool, ToolParameters } from "fastmcp";
import { type } from "arktype";
import { string } from "arktype/internal/keywords/string.ts";
import { M3LogWrapper } from "@utils/m3log";
// https://wiki.biligame.com/arknights/%E8%95%BE%E7%BC%AA%E5%AE%89
class ArkTool {
    logger: M3LogWrapper = new M3LogWrapper(["ArkTool"], false, true);
    baseurl = "https://wiki.biligame.com/arknights/";
    async getCharInfo(char: string): Promise<string> {
        this.logger.debug(`获取信息: ${char}`);
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
            this.logger.error("没有找到搜索结果");
            page.close();
            return "没有找到搜索结果";
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
    description: "获取明日方舟角色、干员、活动等相关信息。请提供准确的中文名称。",
    parameters: type({
        keyword: "string",
    }),
    execute: async (args: any) => {
        return arkTool.getCharInfo(args.keyword);
    }
};

export { arkToolSchema }