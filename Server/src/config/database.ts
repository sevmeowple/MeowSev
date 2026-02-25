import { Database } from "bun:sqlite";
import { z } from "zod";
// 数据库配置 Schema
export const DatabaseConfigSchema = z.object({
  path: z.string().default("./data/app.db"),
  enableWAL: z.boolean().default(true),
  timeout: z.number().default(5000)
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

export class DatabaseManager {
  private static instance: Database;

  static init(config: DatabaseConfig): Database {
    if (!this.instance) {
      this.instance = new Database(config.path, {
        create: true,
        readwrite: true
      });

      if (config.enableWAL) {
        this.instance.exec("PRAGMA journal_mode = WAL;");
      }
    }

    return this.instance;
  }

  static getConnection(): Database {
    if (!this.instance) {
      throw new Error("Database not initialized. Call DatabaseManager.init() first.");
    }
    return this.instance;
  }

  static close(): void {
    if (this.instance) {
      this.instance.close();
      console.log("[Database] SQLite 连接已关闭");
    }
  }
}