import path from "path";
import * as fs from "fs";
import { SQLiteManager } from "@utils/sqlite";
import { MarkdownToImage } from "@utils/md2image";

import type { FoodInfo, FoodTable } from "./type";
import type { BotResponse } from "@/type";

class FOMEOW {
  private db: SQLiteManager;
  private mdtool: MarkdownToImage;
  dir: string = path.join(process.cwd(), "data", "food");
  dishPath: string = path.join(this.dir, "HowToCook", "dishes");
  dbPath: string = path.join(this.dir, "fomeow.db");

  constructor() {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }

    this.db = new SQLiteManager(this.dbPath);
    this.mdtool = new MarkdownToImage();
    this.initDB();
  }

  private initDB() {
    this.db
      .query(
        `
          CREATE TABLE IF NOT EXISTS food (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `
      )
      .run();
  }

  private getAllMarkdownFiles(dirPath: string): string[] {
    let results: string[] = [];

    // 读取目录内容
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // 排除template目录
        if (!item.includes('template')) {
          // 递归读取子目录
          results = results.concat(this.getAllMarkdownFiles(fullPath));
        }
      } else if (
        stat.isFile() && 
        item.toLowerCase().endsWith('.md')
      ) {
        // 收集markdown文件的相对路径
        results.push(fullPath);
      }
    }

    return results;
  }

  // 添加食物
  async addFood(name: string, description: string): Promise<boolean> {
    try {
      this.db
        .prepare("INSERT INTO food (name, description) VALUES (?, ?)")
        .run(name, description);
      return true;
    } catch (error) {
      console.error("添加食物失败:", error);
      return false;
    }
  }

  // 随机获取食物
  async randomFood(): Promise<FoodInfo | null> {
    try {
      const food = this.db
        .query("SELECT * FROM food ORDER BY RANDOM() LIMIT 1")
        .get() as FoodTable;
      if (!food) return null;

      this.db
        .prepare("UPDATE food SET count = count + 1 WHERE id = ?")
        .run(food.id);

      return {
        name: food.name,
        description: food.description,
      };
    } catch (error) {
      console.error("随机获取食物失败:", error);
      return null;
    }
  }

  async getFoodStats() {
    return this.db
      .query("SELECT COUNT(*) as count, SUM(count) as total_selected FROM food")
      .get();
  }

  /**
   * 食物推荐,for real from dishpath
   * @returns {Promise<BotResponse>}
   */
  async recommend(): Promise<BotResponse> {
    try {
      const files = this.getAllMarkdownFiles(this.dishPath);

      if (files.length === 0) {
        return {
          type: "string",
          content: "还没有添加任何食谱喵~"
        };
      }

      // 随机选择一个文件
      const randomFile = files[Math.floor(Math.random() * files.length)];
      
      // 确保输出目录存在
      if (!fs.existsSync(this.dir)) {
        fs.mkdirSync(this.dir, { recursive: true });
      }

      // 读取并转换
      const content = fs.readFileSync(randomFile, "utf-8");
      
      // 生成唯一文件名
      const timestamp = Date.now();
      const outputDir = path.join(this.dir, 'output');
      const outputPath = path.join(outputDir, `recipe_${timestamp}.png`);
      
      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const imgPath = await this.mdtool.markdownToImage(
        content, 
        outputPath,
        randomFile
      );

      if (imgPath) {
        return {
          type: "image",
          content: imgPath
        };
      }

      throw new Error("图片转换失败");

    } catch (error) {
      console.error('推荐食谱失败:', error);
      return {
        type: "string",
        content: "推荐失败了喵~"
      };
    }
  }

  // 获取食物统计
}

export const fomeow = new FOMEOW();
