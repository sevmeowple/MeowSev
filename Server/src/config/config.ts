import { z } from "zod";

import { DatabaseConfig, DatabaseManager } from "./database";
import type { AIClientSDK, AIConfig } from "./AI/index";

import { DatabaseConfigSchema } from "./database";
import { AIConfigSchema, createAISDKClient } from "./AI/index";
import Database from "bun:sqlite";

import config from "../../config.toml";
import { weatherTool } from "./AI/plugins/weather";
import { picTool } from "./AI/plugins/pic";
import { picAltTool } from "./AI/plugins/picAlt";
import { getMemeManager } from "./plugins/meme";
import { weatherAltTool } from "./AI/plugins/weatherAlt";

export const AppConfigSchema = z.object({
  port: z.number().default(6040),
  database: DatabaseConfigSchema,
  ai: AIConfigSchema,
  plugins: z
    .object({
      meme: z.object({
        enabled: z.boolean().default(true),
        configPath: z.string().default("./memes.toml"),
      }),
      // 其他插件配置可以在这里添加
    })
    .default({
      meme: {
        enabled: true,
        configPath: "./memes.toml",
      },
    }),
  games: z.object({
    turtleSoup: z.object({
      enabled: z.boolean().default(true),
      configPath: z.string().default("./turtle-soup-config.toml"),
      oneBotApiUrl: z.string().default("http://127.0.0.1:3033"), // OneBot API 地址
    }),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export interface ConfigUnionType {
  app: AppConfig;
  database: Database;
  ai: AIClientSDK;
}

export function CreateConfigUnion(AppConfig: AppConfig): ConfigUnionType {
  // 初始化数据库连接
  const db = DatabaseManager.init(AppConfig.database);

  if (AppConfig.plugins.meme.enabled) {
    // 初始化 Meme 管理器
    getMemeManager(AppConfig.plugins.meme.configPath);
  }

  // 初始化 AI 客户端
  const aiClient = createAISDKClient(AppConfig.ai);

  // aiClient.registerTool(weatherTool);
  // aiClient.registerTool(picTool);
  aiClient.registerTool(picAltTool);
  aiClient.registerTool(weatherAltTool);

  return {
    app: AppConfig,
    database: db,
    ai: aiClient,
  };
}

const parsedConfig = AppConfigSchema.safeParse(config);
if (!parsedConfig.success) {
  throw new Error("Invalid configuration");
}
export const ConfigUnion: ConfigUnionType = CreateConfigUnion(
  parsedConfig.data
);
