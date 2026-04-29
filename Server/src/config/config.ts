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
import { rogueItemSearchTool } from "./AI/plugins/rogueItems";
import { getMemeManager } from "./plugins/meme";
import { weatherAltTool } from "./AI/plugins/weatherAlt";
import { memeTool } from "./AI/plugins/meme";
import { createReservationTool, listReservationsTool, getReservationDetailTool } from "./AI/plugins/reservation";
import { getUserProfileTool, searchUserMemoryTool } from "./AI/plugins/profile";
import { searchRecentMessagesTool } from "./AI/plugins/contextSearch";
import { kimiSearchTool, kimiFetchTool, setKimiSearchConfig } from "./AI/plugins/kimiSearch";
import { ProfileService } from "@/service/Profile/ProfileService";
import { ProfileWorker } from "@/service/Profile/ProfileWorker";
import { ProfileScheduler } from "@/service/Profile/ProfileScheduler";
import { setProfileService, setProfileWorker, setProfileScheduler } from "@/service/Profile/instance";

const AgentConfigSchema = z.object({
  description: z.string().default(''),
  systemPrompt: z.string().default('你是一个智能助手。'),
  tools: z.array(z.string()).default([]),
  maxSteps: z.number().min(1).max(20).default(3),
  reportToGroup: z.boolean().default(false),
  reportGroupId: z.string().optional(),
  enabled: z.boolean().default(true),
});

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
  personas: z
    .object({
      default: z.string().default(" "),
      groups: z.record(z.string(),z.string()).default({}), // key: group_id, value: prompt
    })
    .default({
      default: " ",
      groups: {},
    }),
  agents: z.record(z.string(), AgentConfigSchema).default({}),
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

  const kimiSearchEnabled = AppConfig.ai.kimiSearch?.enabled ?? AppConfig.ai.codeplan?.enabled ?? false;
  if (kimiSearchEnabled) {
    setKimiSearchConfig({
      ...AppConfig.ai.kimiSearch,
      apiKey: AppConfig.ai.kimiSearch?.apiKey || AppConfig.ai.codeplan?.apiKey,
    });
    aiClient.registerTool(kimiSearchTool);
    aiClient.registerTool(kimiFetchTool);
    console.log("🔎 Kimi Search & Fetch 工具已注册到 AI 客户端");
  }

  // aiClient.registerTool(weatherTool);
  // aiClient.registerTool(picTool);
  aiClient.registerTool(picAltTool);
  aiClient.registerTool(weatherAltTool);
  // aiClient.registerTool(rogueItemSearchTool);

  // 预约工具已禁用
  // aiClient.registerTool(createReservationTool);
  // aiClient.registerTool(listReservationsTool);
  // aiClient.registerTool(getReservationDetailTool);

  //   // if (AppConfig.plugins.meme.enabled) {
  //   aiClient.registerTool(memeTool);
  // }

  // 初始化社交档案系统
  const profileService = new ProfileService(db);
  const profileWorker = new ProfileWorker(aiClient, db);
  const profileScheduler = new ProfileScheduler(profileWorker, db);
  setProfileService(profileService);
  setProfileWorker(profileWorker);
  setProfileScheduler(profileScheduler);
  console.log("📋 ProfileService & ProfileWorker & ProfileScheduler 已初始化");

  // 注册档案查询工具到 AI 客户端
  aiClient.registerTool(getUserProfileTool);
  aiClient.registerTool(searchUserMemoryTool);
  aiClient.registerTool(searchRecentMessagesTool);
  console.log("🔧 档案工具已注册到 AI 客户端");

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
