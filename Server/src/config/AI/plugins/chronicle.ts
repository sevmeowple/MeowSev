import { z } from "zod";
import type { ToolDefinition, ToolResult } from "..";
import { DatabaseManager } from "@/config/database";

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

interface MessageRow {
  id: number;
  user_id: string;
  user_name: string;
  user_nick: string | null;
  group_id: string | null;
  content: string;
  timestamp: number;
}

export interface ChronicleMessage {
  user: string;
  userId: string;
  content: string;
  time: string;
}

function toResult(rows: MessageRow[]): ChronicleMessage[] {
  return rows.map((r) => ({
    user: r.user_nick || r.user_name,
    userId: r.user_id,
    content: r.content,
    time: formatTimestamp(r.timestamp),
  }));
}

function likeQuery(
  conditions: string[], bindings: any[], limit: number,
): MessageRow[] {
  bindings.push(limit);
  const sql = `SELECT id, user_id, user_name, user_nick, group_id, content, timestamp
    FROM messages WHERE ${conditions.join(" AND ")} ORDER BY timestamp DESC LIMIT ?`;
  return DatabaseManager.getConnection().query(sql).all(...bindings) as MessageRow[];
}

/** 工具 1: chronicleSearch — 关键词 LIKE 检索 */
export const chronicleSearchTool: ToolDefinition = {
  name: "chronicleSearch",
  description: "按关键词搜索群聊历史消息（支持中英文），返回匹配的消息列表",
  inputSchema: z.object({
    keyword: z.string().describe("搜索关键词"),
    groupId: z.string().optional().describe("群组ID，不传则搜索所有群"),
    limit: z.number().optional().default(30).describe("返回条数上限，默认30"),
  }),
  execute: async (p: {
    keyword: string; groupId?: string; limit?: number;
  }): Promise<ToolResult> => {
    try {
      const cond = ["content LIKE ?"];
      const bind: any[] = [`%${p.keyword}%`];
      if (p.groupId) { cond.push("group_id = ?"); bind.push(p.groupId); }
      const rows = likeQuery(cond, bind, p.limit ?? 30);
      if (!rows.length) {
        return { success: true, responseType: "text",
          aiResponse: `未找到包含「${p.keyword}」的历史消息。` };
      }
      return { success: true, responseType: "text",
        aiResponse: JSON.stringify(toResult(rows), null, 2) };
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      return { success: false, aiResponse: `检索失败: ${m}`, errorInfo: m };
    }
  },
};

/** 工具 2: chronicleUserHistory — 用户发言历史 */
export const chronicleUserHistoryTool: ToolDefinition = {
  name: "chronicleUserHistory",
  description: "获取指定用户的发言历史列表，含内容和时间",
  inputSchema: z.object({
    userId: z.string().describe("用户ID"),
    groupId: z.string().optional().describe("群组ID"),
    limit: z.number().optional().default(50).describe("返回条数上限，默认50"),
  }),
  execute: async (p: {
    userId: string; groupId?: string; limit?: number;
  }): Promise<ToolResult> => {
    try {
      const cond = ["user_id = ?"];
      const bind: any[] = [p.userId];
      if (p.groupId) { cond.push("group_id = ?"); bind.push(p.groupId); }
      const rows = likeQuery(cond, bind, p.limit ?? 50);
      if (!rows.length) {
        return { success: true, responseType: "text",
          aiResponse: `未找到用户 ${p.userId} 的发言记录。` };
      }
      return { success: true, responseType: "text",
        aiResponse: JSON.stringify(toResult(rows), null, 2) };
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      return { success: false, aiResponse: `检索失败: ${m}`, errorInfo: m };
    }
  },
};

/** 工具 3: chronicleUserSearch — 用户 + 关键词交叉检索 */
export const chronicleUserSearchTool: ToolDefinition = {
  name: "chronicleUserSearch",
  description: "按用户ID + 关键词交叉检索，查找指定用户说过的包含关键词的消息",
  inputSchema: z.object({
    userId: z.string().describe("用户ID"),
    keyword: z.string().describe("搜索关键词"),
    groupId: z.string().optional().describe("群组ID"),
    limit: z.number().optional().default(30).describe("返回条数上限，默认30"),
  }),
  execute: async (p: {
    userId: string; keyword: string; groupId?: string; limit?: number;
  }): Promise<ToolResult> => {
    try {
      const cond = ["user_id = ?", "content LIKE ?"];
      const bind: any[] = [p.userId, `%${p.keyword}%`];
      if (p.groupId) { cond.push("group_id = ?"); bind.push(p.groupId); }
      const rows = likeQuery(cond, bind, p.limit ?? 30);
      if (!rows.length) {
        return { success: true, responseType: "text",
          aiResponse: `未找到用户 ${p.userId} 关于「${p.keyword}」的发言记录。` };
      }
      return { success: true, responseType: "text",
        aiResponse: JSON.stringify(toResult(rows), null, 2) };
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      return { success: false, aiResponse: `检索失败: ${m}`, errorInfo: m };
    }
  },
};
