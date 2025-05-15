import { browserManager } from "@utils/browser";
import { M3LogWrapper } from "@utils/m3log";
import { turndown } from "@utils/turndown";
import type { Tool, ToolParameters } from "fastmcp";
import { type } from "arktype";

class GitHubTool {
  logger: M3LogWrapper = new M3LogWrapper(["GitHubTool"], false, true);
  
  async getGitHubInfo(url: string): Promise<string> {
    // 检查是否是 GitHub URL
    const patterns = [
        /github\.com\/([a-zA-Z0-9-_.]+)\/([a-zA-Z0-9-_.]+)/
      ];

    let match = null;
    for (const pattern of patterns) {
      match = url.match(pattern);
      if (match) break;
    }

    this.logger.info(`[GitHub] Match result: ${match}`);
    if (!match) {
      return "提供的不是有效的 GitHub URL";
    }

    try {
      const browser = await browserManager.getBrowser();
      const page = await browser.newPage();
      
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // 等待 article 元素加载
      await page.waitForSelector('article', { timeout: 10000 }).catch(() => null);

      // 提取 article 内容
      const articleElement = await page.$('article');
      if (!articleElement) {
        this.logger.warn("未找到 article 元素");
        
        // 获取页面的基本信息
        const title = await page.title();
        await page.close();
        
        return `未能找到 article 元素。\n页面标题: ${title}`;
      }

      // 提取 article 的 HTML
      const html = await page.evaluate(el => el.outerHTML, articleElement);
      
      // 转换 HTML 为 Markdown
      const md = turndown.turndown(html.replace(/\s*style=("[^"]*"|'[^']*')/g, ''));
      
      await page.close();
      
      return md;
    } catch (error) {
      this.logger.error(`GitHub 内容提取失败: ${error}`);
      return `获取 GitHub 内容失败: ${error}`;
    }
  }
}

const githubTool = new GitHubTool();

const githubToolSchema: Tool<undefined, ToolParameters> = {
  name: "github",
  description: "get github repo README content",
  parameters: type({
    url: "string"
  }),
  execute: async (args: any) => {
    return githubTool.getGitHubInfo(args.url);
  }
};

export { githubToolSchema };