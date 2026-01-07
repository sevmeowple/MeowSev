import path from "path";
import * as fs from "fs";
import axios from "axios";
import { browserManager } from "@/utils/browser";
import { tsxToPic } from "@/utils/plugin/browser/tsxToPic";
import { HolidayCalendar, HolidayData } from "@/view/HolidayCalendar";

type Location = "全部" | "东区" | "西区" | "南区" | "北区";
type Week = "工作日" | "节假日" | "当前时间";
type BusType = "校园班车" | "高新园区班车";
type NOW = "now" | "no";

export class USTCService {
  private readonly dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), "data", "ustc");
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async getBusTimetable(
    type: BusType = "高新园区班车",
    start?: Location,
    end?: Location,
    week?: Week,
    isNow?: NOW
  ): Promise<string | null> {
    return type === "高新园区班车" 
      ? await this.captureGxBus()
      : await this.captureXyBus(start, end, week, isNow);
  }

  async getHolidayCalendar(year: number = new Date().getFullYear()): Promise<string | null> {
    try {
      const response = await axios.get(`https://holiday.ailcc.com/api/holiday/year/${year}`);
      if (response.data.code !== 0) {
        console.error("Holiday API error:", response.data);
        return null;
      }
      
      const holidayData: HolidayData = response.data.holiday;
      
      const imagePath = await tsxToPic(HolidayCalendar, {
        year,
        data: holidayData
      }, {
        width: 1200,
        height: 1200, 
        outputFileName: `holiday_calendar_${year}.png`,
        outputDir: this.dataDir
      });
      
      return imagePath;
    } catch (e) {
      console.error("Failed to fetch holiday calendar:", e);
      return null;
    }
  }

  async getCalendar(): Promise<string | null> {
    const url = "https://www.teach.ustc.edu.cn/calendar";
    const page = await browserManager.newPage();
    
    try {
      await page.goto(url);
      await page.waitForSelector(".article-list");
      
      const info = await page.evaluate(() => {
        const link = document.querySelector(".article-list li:first-child a");
        return link ? { href: (link as HTMLAnchorElement).href } : null;
      });
      
      if (!info) return null;
      
      const filename = `calendar_${Date.now()}.png`;
      const filepath = path.join(this.dataDir, filename) as `${string}.png`;
      
      if (fs.existsSync(filepath)) return filepath;
      
      await page.goto(info.href);
      await page.waitForSelector(".table-wrap");
      
      const element = await page.$(".table-wrap");
      if (element) {
        await element.screenshot({ path: filepath });
        return filepath;
      }
      
      return null;
    } finally {
      await page.close();
    }
  }

  private async captureGxBus(): Promise<string | null> {
    const url = "https://weixine.ustc.edu.cn/ustcqy/mobile/busTimetable/xyy";
    return this.capturePage(url, "gxbus.png");
  }

  private async captureXyBus(
    start: Location = "全部",
    end: Location = "全部",
    week: Week = "工作日",
    isNow: NOW = "no"
  ): Promise<string | null> {
    const base = "https://weixine.ustc.edu.cn/ustcqy/mobile/busTimetable";
    const params = isNow === "now" 
      ? `?category=校园班车&endpoint=${end}&startpoint=${start}&week[]=${week}&week[]=当前时间`
      : `?category=校园班车&endpoint=${end}&startpoint=${start}&week[]=${week}`;
    
    return this.capturePage(base + params, "xybus.png");
  }

  private async capturePage(url: string, filename: string): Promise<string | null> {
    const page = await browserManager.newPage();
    
    try {
      await page.goto(url);
      await page.waitForSelector("body");
      
      const filepath = path.join(this.dataDir, filename) as `${string}.png`;
      
      await page.screenshot({
        path: filepath,
        fullPage: true
      });
      
      return filepath;
    } catch {
      return null;
    } finally {
      await page.close();
    }
  }
}

export type { Location, Week, BusType, NOW };