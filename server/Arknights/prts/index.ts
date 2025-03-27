import { browserManager } from "@utils";
import * as fs from "fs";
import * as path from "path";
class PRTS {
  url: string = "https://prts.wiki/";

  // https://prts.wiki/index.php?search=%E6%8B%B1%E9%97%A8&title=%E7%89%B9%E6%AE%8A%3A%E6%90%9C%E7%B4%A2&go=%E5%89%8D%E5%BE%80
  /**
   *
   * @param keyword
   * @returns
   * @description 搜索关键字,返回搜索结果的截图的路径
   */
  async search(keyword: string): Promise<string> {
    const dir = path.join(process.cwd(), "data", "Arknights", "prts");

    // 确保目录存在,不存在则递归创建
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();
    await page.goto(
      `${this.url}index.php?search=${encodeURIComponent(
        keyword
      )}&title=特殊:搜索&go=前往`
    );

    console.log(
      `${this.url}index.php?search=${encodeURIComponent(
        keyword
      )}&title=特殊:搜索&go=前往`
    );
    // 截图class为searchresults的元素,存放到@data/Arknights/prts
    // 名称为searchresults.png
    // 等待任一元素出现
    await Promise.race([
      page.waitForSelector(".searchresults"),
      page.waitForSelector("#mw-content-text"),
    ]);

    // 检查是否存在搜索结果页
    const searchResults = await page.$(".searchresults");
    const element = searchResults || (await page.$("#mw-content-text"));

    if (!element) {
      throw new Error("No content element found");
    }

    const searchResultsPath = path.join(dir, "searchresults.png");
    await element.screenshot({ path: searchResultsPath });
    await page.close();

    return searchResultsPath;
  }
}

export const prts = new PRTS();
