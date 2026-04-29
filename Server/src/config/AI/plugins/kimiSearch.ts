import { z } from "zod";
import type { ToolDefinition, ToolResult } from "..";
import { KIMI_CODE_USER_AGENT } from "../providers/CodePlanProvider";

export interface KimiSearchConfig {
  enabled?: boolean;
  apiKey?: string;
  searchURL?: string;
  fetchURL?: string;
  defaultLimit?: number;
  timeoutSeconds?: number;
}

interface KimiSearchResult {
  site_name: string;
  title: string;
  url: string;
  snippet: string;
  content?: string;
  date?: string;
}

let runtimeConfig: KimiSearchConfig = {};

const DEFAULT_SEARCH_URL = "https://api.kimi.com/coding/v1/search";
const DEFAULT_FETCH_URL = "https://api.kimi.com/coding/v1/fetch";

export function setKimiSearchConfig(config: KimiSearchConfig): void {
  runtimeConfig = { ...runtimeConfig, ...config };
}

function getConfig(): Required<Pick<KimiSearchConfig, "searchURL" | "fetchURL" | "defaultLimit" | "timeoutSeconds">> & {
  apiKey: string;
} {
  const apiKey = runtimeConfig.apiKey || process.env.KIMI_CODE_API_KEY || "";
  return {
    apiKey,
    searchURL: runtimeConfig.searchURL || process.env.KIMI_SEARCH_URL || DEFAULT_SEARCH_URL,
    fetchURL: runtimeConfig.fetchURL || process.env.KIMI_FETCH_URL || DEFAULT_FETCH_URL,
    defaultLimit: runtimeConfig.defaultLimit ?? 8,
    timeoutSeconds: runtimeConfig.timeoutSeconds ?? 30,
  };
}

function createToolCallId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mshHeaders(apiKey: string, toolCallId: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": KIMI_CODE_USER_AGENT,
    "X-Msh-Tool-Call-Id": toolCallId,
    "X-Msh-Platform": "kimi_cli",
    "X-Msh-Version": "1.30.0",
    "X-Msh-Device-Name": "kimi-cli",
    "X-Msh-Device-Model": "kimi-cli",
    "X-Msh-Os-Version": process.platform,
    "X-Msh-Device-Id": "kimi-cli",
  };
}

function normalizeLimit(limit: unknown, fallback: number): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(limit)));
}

function parseSearchResults(data: unknown): KimiSearchResult[] {
  if (!data || typeof data !== "object") {
    throw new Error("搜索服务返回格式无效");
  }
  const root = data as { search_results?: unknown };
  if (!Array.isArray(root.search_results)) {
    throw new Error("搜索服务响应缺少 search_results");
  }
  return root.search_results.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`search_results[${index}] 格式无效`);
    }
    const row = item as Record<string, unknown>;
    return {
      site_name: String(row.site_name || ""),
      title: String(row.title || ""),
      url: String(row.url || ""),
      snippet: String(row.snippet || ""),
      content: typeof row.content === "string" ? row.content : "",
      date: typeof row.date === "string" ? row.date : "",
    };
  }).filter(item => item.title && item.url);
}

function formatSearchResults(results: KimiSearchResult[], includeContent: boolean): string {
  if (results.length === 0) return "未找到相关搜索结果。";
  return results.map((result, index) => {
    const lines = [
      `## ${index + 1}. ${result.title}`,
      result.date ? `Date: ${result.date}` : "",
      result.site_name ? `Source: ${result.site_name}` : "",
      `URL: ${result.url}`,
      `Summary: ${result.snippet}`,
    ];
    if (includeContent && result.content) {
      lines.push("", result.content.slice(0, 4000));
    }
    return lines.filter(Boolean).join("\n");
  }).join("\n\n---\n\n");
}

async function withTimeout<T>(promise: Promise<T>, timeoutSeconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Kimi search request timeout")), Math.max(1, timeoutSeconds) * 1000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export const kimiSearchTool: ToolDefinition = {
  name: "kimiSearch",
  description: "使用 Kimi Code 搜索服务搜索互联网，适合查询最新新闻、文档、公告、博客、论文和网页信息。",
  inputSchema: z.object({
    query: z.string().min(1).describe("搜索关键词或问题"),
    limit: z.number().min(1).max(20).optional().describe("返回结果数量，1-20，默认使用配置值"),
    includeContent: z.boolean().optional().describe("是否抓取并返回页面正文，默认 false，会消耗更多 token"),
  }),
  execute: async ({ query, limit, includeContent }): Promise<ToolResult> => {
    const config = getConfig();
    if (!config.apiKey) {
      return {
        success: false,
        aiResponse: "Kimi 搜索服务未配置 API Key。",
        errorInfo: "Missing Kimi Code API key",
      };
    }

    const toolCallId = createToolCallId("search");
    const body = {
      text_query: query,
      limit: normalizeLimit(limit, config.defaultLimit),
      enable_page_crawling: Boolean(includeContent),
      timeout_seconds: config.timeoutSeconds,
    };

    try {
      const response = await withTimeout(fetch(config.searchURL, {
        method: "POST",
        headers: mshHeaders(config.apiKey, toolCallId),
        body: JSON.stringify(body),
      }), config.timeoutSeconds + 5);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          success: false,
          aiResponse: `Kimi 搜索失败，状态码 ${response.status}。`,
          errorInfo: text || response.statusText,
        };
      }

      const results = parseSearchResults(await response.json());
      return {
        success: true,
        responseType: "text",
        aiResponse: `Kimi 搜索「${query}」结果：\n\n${formatSearchResults(results, Boolean(includeContent))}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        aiResponse: `Kimi 搜索「${query}」失败。`,
        errorInfo: message,
      };
    }
  },
};

export const kimiFetchTool: ToolDefinition = {
  name: "kimiFetch",
  description: "使用 Kimi Code Fetch 服务获取指定 URL 的网页正文。适合在搜索后读取某个网页的详细内容。",
  inputSchema: z.object({
    url: z.string().url().describe("要获取的网页完整 URL"),
  }),
  execute: async ({ url }): Promise<ToolResult> => {
    const config = getConfig();
    if (!config.apiKey) {
      return {
        success: false,
        aiResponse: "Kimi 网页获取服务未配置 API Key。",
        errorInfo: "Missing Kimi Code API key",
      };
    }

    const toolCallId = createToolCallId("fetch");
    try {
      const response = await withTimeout(fetch(config.fetchURL, {
        method: "POST",
        headers: {
          ...mshHeaders(config.apiKey, toolCallId),
          "Accept": "text/markdown",
        },
        body: JSON.stringify({ url }),
      }), config.timeoutSeconds + 5);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          success: false,
          aiResponse: `Kimi 获取网页失败，状态码 ${response.status}。`,
          errorInfo: text || response.statusText,
        };
      }

      const content = await response.text();
      return {
        success: true,
        responseType: "text",
        aiResponse: `Kimi 获取网页内容：\nURL: ${url}\n\n${content.slice(0, 12000)}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        aiResponse: `Kimi 获取网页「${url}」失败。`,
        errorInfo: message,
      };
    }
  },
};
