/**
 * 端到端测试: 模拟 AgentController 的 chronicle 流程
 * 直接调用工具 → 提取消息 → 渲染 TSX
 * 用法: bun run test/test-chronicle-e2e.ts
 */
import { Database } from "bun:sqlite";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// ---- 1. 直接用 LIKE 查询模拟工具调用 ----
const DB_PATH = "./data.sqlite";
const db = new Database(DB_PATH, { readonly: true });

console.log("=== 端到端测试: chronicle 工具 → 提取 → 渲染 ===\n");

// 模拟 chronicleSearch 工具的返回
function simulateSearch(keyword: string) {
  const rows = db.query(
    `SELECT user_name, user_nick, user_id, content, timestamp
     FROM messages WHERE content LIKE ?
     ORDER BY timestamp DESC LIMIT 10`
  ).all(`%${keyword}%`) as any[];

  return rows.map((r: any) => ({
    user: r.user_nick || r.user_name,
    userId: r.user_id,
    content: r.content,
    time: new Date(r.timestamp * 1000).toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }),
  }));
}

// ---- 2. 测试场景 ----
const testCases = [
  { name: "我感觉glm不如kimi", keywords: ["glm", "kimi"] },
  { name: "这种vps能当梯子用吗", keywords: ["vps", "梯子"] },
];

for (const tc of testCases) {
  console.log(`\n--- 场景: "${tc.name}" ---`);

  // 模拟 AI 多次调用工具后的合并结果
  const allMessages: any[] = [];
  const seen = new Set<string>();

  for (const kw of tc.keywords) {
    const toolResult = JSON.stringify(simulateSearch(kw));
    console.log(`工具返回 "${kw}": ${toolResult.length} 字符`);

    // 模拟 extractChronicleMessages 的解析逻辑
    try {
      const parsed = JSON.parse(toolResult);
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          if (m.content && m.time) {
            const key = `${m.user}:${m.content}:${m.time}`;
            if (!seen.has(key)) {
              seen.add(key);
              allMessages.push(m);
            }
          }
        }
      }
    } catch (e) {
      console.log(`  解析失败: ${e}`);
    }
  }

  console.log(`\n去重后消息数: ${allMessages.length}`);
  for (const m of allMessages.slice(0, 5)) {
    console.log(`  [${m.time}] ${m.user}: ${m.content.slice(0, 60)}`);
  }
  if (allMessages.length > 5) {
    console.log(`  ... 还有 ${allMessages.length - 5} 条`);
  }
}

// ---- 3. 测试 TSX 渲染 ----
import { ChronicleReport } from "../src/view/ChronicleReport";

console.log("\n\n--- TSX 渲染测试 ---");
const testMessages = simulateSearch("kimi").slice(0, 5);
console.log(`渲染消息数: ${testMessages.length}`);

try {
  const html = renderToStaticMarkup(
    React.createElement(ChronicleReport, {
      messages: testMessages,
      comment: "看起来大家对 kimi 的评价褒贬不一呢",
    })
  );
  console.log(`HTML 长度: ${html.length} 字符`);
  console.log(`包含 bar-top: ${html.includes('bar-top')}`);
  console.log(`包含消息内容: ${html.includes(testMessages[0]?.content?.slice(0, 10) || '')}`);
  console.log(`包含评语: ${html.includes('褒贬不一')}`);
  console.log("✅ TSX 渲染成功");
} catch (e) {
  console.error("❌ TSX 渲染失败:", e);
}

db.close();
console.log("\n=== 端到端测试完成 ===");
