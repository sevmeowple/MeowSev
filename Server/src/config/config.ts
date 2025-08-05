import { z } from "zod";

import { DatabaseConfig, DatabaseManager } from "./database";
import type { AIClientSDK, AIConfig } from "./AI/index";

import { DatabaseConfigSchema } from "./database";
import { AIConfigSchema, createAISDKClient } from "./AI/index";
import Database from "bun:sqlite";

import config from "../../config.toml"
import { weatherTool } from "./AI/plugins/weather";
import { picTool } from "./AI/plugins/pic";

export const AppConfigSchema = z.object({
  port: z.number().default(6040),
  database: DatabaseConfigSchema,
  ai: AIConfigSchema
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
  // 初始化 AI 客户端
  const aiClient = createAISDKClient(AppConfig.ai);

  aiClient.registerTool(weatherTool);
  aiClient.registerTool(picTool)

  return {
    app: AppConfig,
    database: db,
    ai: aiClient
  };
}

const parsedConfig = AppConfigSchema.safeParse(config);
if (!parsedConfig.success) {
  throw new Error("Invalid configuration");
}
export const ConfigUnion: ConfigUnionType = CreateConfigUnion(parsedConfig.data);