import path from "path";
import * as fs from "fs";

import { browserManager } from "@utils/browser";
class TOOLER {
  dir: string = path.join(process.cwd(), "data", "tooler");

  constructor() {
    // 检查目录是否存在
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  async lookup(url: string) {
    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    // url处理,如果没有http或者https开头,则加上
    if (!url.startsWith("http")) {
      url = `http://${url}`;
    }

    await page.goto(url);
    // wait for 5s, then take a screenshot, 这个browser没有相关等待时间的方法
    // 采用定时器的方式
    const ph = path.join(this.dir, "screenshot.png");

    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });

    const screenshot = await page.screenshot({
      path: ph,
    });

    await page.close();
    return ph;
  }


  async bilibili(content: string) {
    // 解析content,分离出url
    // const baseurl =  "https://www.bilibili.com/video/" || "https://b23.tv/";
    // 匹配content中的url
    const patterns = [
      // 完整链接格式
      /https?:\/\/(?:www\.)?bilibili\.com\/video\/(BV[a-zA-Z0-9]+)\/?/,
      // 短链接格式
      /https?:\/\/b23\.tv\/([a-zA-Z0-9]+)\/?/,
      // 移动端链接
      /https?:\/\/m\.bilibili\.com\/video\/(BV[a-zA-Z0-9]+)\/?/,
      // 带参数的链接
      /https?:\/\/(?:www\.)?bilibili\.com\/video\/(BV[a-zA-Z0-9]+)(?:\?.*?)?\/?/
    ];
  
    // 尝试所有匹配模式
    let match = null;
    for (const pattern of patterns) {
      match = content.match(pattern);
      if (match) break;
    }
  
    console.log('[Bilibili] Match result:', match);
    if (!match) {
      return;
    }

    const url = match[0];
    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    await page.goto(url);
    // wait for 5s, then take a screenshot, 这个browser没有相关等待时间的方法
    // 采用定时器的方式
    const ph = path.join(this.dir, "bilibili.png");
    
    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
    // 设置页面大小
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    const screenshot = await page.screenshot({
      path: ph,
    })

    await page.close();

    return ph;
  }

  async github(content: string) {
    const patterns = [
      /https?:\/\/github\.com\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\/?/,
      /https?:\/\/github\.com\/([a-zA-Z0-9-]+)\/?/,
    ];

    let match = null;
    for (const pattern of patterns) {
      match = content.match(pattern);
      if (match) break;
    }

    console.log('[Github] Match result:', match);
    if (!match) {
      return;
    }

    const url = match[0];
    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();

    await page.goto(url);
    // wait for 5s, then take a screenshot, 这个browser没有相关等待时间的方法
    // 采用定时器的方式
    const ph = path.join(this.dir, "github.png");
    
    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
    // 设置页面大小
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    const screenshot = await page.screenshot({
      path: ph,
      });

    await page.close();

    return ph;
  }
}

export const tooler = new TOOLER();
