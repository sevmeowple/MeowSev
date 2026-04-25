/**
 * 岁月史书 Chronicle 搜索 + 渲染测试
 * 用法: bun run test/test-chronicle.ts
 */
import { Database } from "bun:sqlite";

const DB_PATH = "./data.sqlite";
const db = new Database(DB_PATH, { readonly: true });

const KEYWORDS = ["glm", "kimi", "梯子", "vps"];

console.log("=== 岁月史书 LIKE 搜索测试 ===\n");

const total = db.query("SELECT COUNT(*) as cnt FROM messages").get() as any;
console.log(`数据库消息总数: ${total.cnt}\n`);

for (const kw of KEYWORDS) {
  console.log(`--- 关键词: "${kw}" ---`);

  const rows = db.query(
    `SELECT user_name, user_nick, content, timestamp
     FROM messages WHERE content LIKE ?
     ORDER BY timestamp DESC LIMIT 5`
  ).all(`%${kw}%`) as any[];

  console.log(`LIKE 结果: ${rows.length} 条`);
  for (const r of rows) {
    const name = r.user_nick || r.user_name;
    const time = new Date(r.timestamp * 1000).toLocaleString("zh-CN");
    console.log(`  [${time}] ${name}: ${r.content.slice(0, 80)}`);
  }
  console.log();
}

// 组合测试: "我感觉glm不如kimi" 场景
console.log(`--- 场景测试: "我感觉glm不如kimi" ---`);
const combo = db.query(
  `SELECT user_name, user_nick, content, timestamp
   FROM messages
   WHERE content LIKE '%glm%' OR content LIKE '%kimi%'
   ORDER BY timestamp DESC LIMIT 10`
).all() as any[];
console.log(`结果: ${combo.length} 条`);
for (const r of combo) {
  const name = r.user_nick || r.user_name;
  const time = new Date(r.timestamp * 1000).toLocaleString("zh-CN");
  console.log(`  [${time}] ${name}: ${r.content.slice(0, 100)}`);
}

console.log();

// 场景测试: "这种vps能当梯子用吗"
console.log(`--- 场景测试: "这种vps能当梯子用吗" ---`);
const combo2 = db.query(
  `SELECT user_name, user_nick, content, timestamp
   FROM messages
   WHERE content LIKE '%vps%' OR content LIKE '%梯子%'
   ORDER BY timestamp DESC LIMIT 10`
).all() as any[];
console.log(`结果: ${combo2.length} 条`);
for (const r of combo2) {
  const name = r.user_nick || r.user_name;
  const time = new Date(r.timestamp * 1000).toLocaleString("zh-CN");
  console.log(`  [${time}] ${name}: ${r.content.slice(0, 100)}`);
}

db.close();
console.log("\n=== 测试完成 ===");
