import path from "path";
import * as fs from "fs";

import { browserManager } from "@utils/browser";
type Location = "全部" | "东区" | "西区" | "南区" | "北区";
type Week = "工作日" | "节假日" | "当前时间";
type BusType = "校园班车" | "高新园区班车";
type NOW = "now" | "no";

class USTC {
  dir: string = path.join(process.cwd(), "data", "ustc");

  constructor() {
    // 检查目录是否存在
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private async getGxBusTimetable() {
    const gxbus = "https://weixine.ustc.edu.cn/ustcqy/mobile/busTimetable/xyy";

    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    await page.goto(gxbus);

    const ph = path.join(this.dir, "gxbus.png");

    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });

    await page.waitForSelector("body");

    // 获取页面实际高度
    const bodyHeight = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      return Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
    });

    // 设置视窗大小
    await page.setViewport({
      width: 1280,
      height: bodyHeight,
      deviceScaleFactor: 1,
    });

    const screenshot = await page.screenshot({
      path: ph,
      fullPage: true,
    });

    await page.close();

    return ph;
  }

  private async getXyBusTimetable(
    startpoint: Location = "全部",
    endpoint: Location = "全部",
    week: Week = "工作日",
    isnow: NOW = "no"
  ) {
    const baseURL = "https://weixine.ustc.edu.cn/ustcqy/mobile/busTimetable";
    let URL;

    switch (isnow) {
      case "now":
        URL = `${baseURL}?category=%E6%A0%A1%E5%9B%AD%E7%8F%AD%E8%BD%A6&endpoint=${endpoint}&startpoint=${startpoint}&week%5B%5D=${week}&week%5B%5D=当前时间`;
        break;
      case "no":
        URL = `${baseURL}?category=%E6%A0%A1%E5%9B%AD%E7%8F%AD%E8%BD%A6&endpoint=${endpoint}&startpoint=${startpoint}&week%5B%5D=${week}`;
        break;
      default:
        console.error("Invalid isnow parameter");
        return "Invalid isnow parameter";
    }

    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    await page.goto(URL);

    const ph = path.join(this.dir, "xybus.png");

    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });

    await page.waitForSelector("body");

    // 获取页面实际高度
    const bodyHeight = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      return Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
    });

    // 设置视窗大小
    await page.setViewport({
      width: 1280,
      height: bodyHeight,
      deviceScaleFactor: 1,
    });

    const screenshot = await page.screenshot({
      path: ph,
      fullPage: true,
    });

    await page.close();

    return ph;
  }

  // https://weixine.ustc.edu.cn/ustcqy/mobile/busTimetable?category=%E6%A0%A1%E5%9B%AD%E7%8F%AD%E8%BD%A6&endpoint=%E5%85%A8%E9%83%A8&startpoint=%E5%85%A8%E9%83%A8&week%5B%5D=%E5%B7%A5%E4%BD%9C%E6%97%A5&
  async bus(
    choice: BusType = "高新园区班车",
    startpoint: Location = "全部",
    endpoint: Location = "全部",
    week: Week = "工作日",
    isnow: NOW = "no"
  ) {
    let path;

    switch (choice) {
      case "高新园区班车":
        path = await this.getGxBusTimetable();
        break;

      case "校园班车":
        path = await this.getXyBusTimetable(startpoint, endpoint, week, isnow);
        break;

      default:
        console.error("Invalid bus type");
        return null;
    }

    return path;
  }

  // https://www.teach.ustc.edu.cn/calendar
  async calendar() {
    const calendar = "https://www.teach.ustc.edu.cn/calendar";
    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(calendar);
      await page.waitForSelector(".article-list");

      // 获取第一个链接和标题
      const calendarInfo = await page.evaluate(() => {
        const firstArticle = document.querySelector(
          ".article-list li:first-child"
        );
        const link = firstArticle?.querySelector("a");
        const titleSpan = firstArticle?.querySelector(".post");

        if (link instanceof HTMLAnchorElement) {
          return {
            href: link.href,
            title: titleSpan?.textContent?.trim() || "未知学期",
          };
        }
        return null;
      });

      if (!calendarInfo) {
        throw new Error("未找到日历链接");
      }

      // 生成文件名
      const fileName = `calendar_${calendarInfo.title.replace(
        /[\/\s]/g,
        "_"
      )}.png`;
      const ph = path.join(this.dir, fileName);

      // 检查缓存
      if (fs.existsSync(ph)) {
        return ph;
      }

      // 跳转到具体日历页面
      await page.goto(calendarInfo.href);
      await page.waitForSelector(".table-wrap");

      // 获取目标元素
      // 计算表格实际宽度和高度
      const tableDimensions = await page.evaluate(() => {
        const table = document.querySelector(".table-wrap");
        if (!table) return null;

        // 获取表格的完整尺寸,包括溢出部分
        const rect = table.getBoundingClientRect();
        return {
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
          scrollWidth: table.scrollWidth,
          scrollHeight: table.scrollHeight,
        };
      });

      if (!tableDimensions) {
        throw new Error("未找到日历表格");
      }

      // 设置足够大的视窗确保捕获完整内容
      await page.setViewport({
        width:
          Math.max(tableDimensions.width, tableDimensions.scrollWidth) + 100, // 额外留白
        height:
          Math.max(tableDimensions.height, tableDimensions.scrollHeight) + 100,
        deviceScaleFactor: 1,
      });

      // 截取表格元素
      const element = await page.$(".table-wrap");
      if (element) {
        await element.screenshot({
          path: ph,
          omitBackground: true, // 透明背景
        });
      }

      await page.close();
      return ph;
    } catch (error) {
      console.error("获取日历失败:", error);
      await page.close();
      return null;
    }
  }

  
}

export const ustc = new USTC();
export type { Location, Week, BusType, NOW };
