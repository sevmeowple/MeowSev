import { browserManager } from "../../utils/browser";
import { MessageObject } from "../../utils/message";
import path from "path";
import fs from "fs";

export class PrtsService {
  
  /**
   * 获取 PRTS Wiki 页面截图
   * @param queryKey 查询关键词
   * @returns MessageObject 格式的截图消息
   */
  async getWikiScreenshot(queryKey: string): Promise<MessageObject> {
    let page;
    try {
      const url = `https://prts.wiki/w/${encodeURIComponent(queryKey)}`;
      page = await browserManager.newPage();
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 确保 temp 目录存在
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `prts_${Date.now()}.png`;
      const filePath = path.join(tempDir, fileName);

      await page.screenshot({
        path: filePath as `${string}.png`,
        fullPage: true
      });
      
      return {
        type: "image",
        src: `file://${filePath}`,
        alt: `PRTS Wiki - ${queryKey}`,
        content: `📖 PRTS Wiki - ${queryKey}`
      };
      
    } catch (error) {
      console.error('PrtsService error:', error);
      return {
        type: "text",
        content: `❌ 获取 PRTS Wiki 截图时出现错误: ${error instanceof Error ? error.message : "未知错误"}`
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
}
