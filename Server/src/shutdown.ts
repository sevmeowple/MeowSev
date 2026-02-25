import type { Elysia } from "elysia";
import { browserManager } from "@utils/browser";
import { DatabaseManager } from "@config/database";
import { getBilibiliCacheScheduler } from "@/service/Bilibili/scheduler";

let isShuttingDown = false;

async function gracefulShutdown(app: Elysia) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n🛑 收到关闭信号，开始优雅关闭...");

  // 1. 停止 HTTP server
  try {
    app.stop();
    console.log("✅ Elysia HTTP server 已停止");
  } catch (e) {
    console.error("❌ 停止 Elysia 失败:", e);
  }

  // 2. 停止定时任务
  try {
    const scheduler = getBilibiliCacheScheduler();
    if (scheduler) {
      scheduler.stop();
    }
  } catch (e) {
    console.error("❌ 停止定时任务失败:", e);
  }

  // 3. 关闭 Puppeteer 浏览器
  try {
    await browserManager.close();
    console.log("✅ Puppeteer 浏览器已关闭");
  } catch (e) {
    console.error("❌ 关闭浏览器失败:", e);
  }

  // 4. 关闭 SQLite 连接
  try {
    DatabaseManager.close();
  } catch (e) {
    console.error("❌ 关闭数据库失败:", e);
  }

  console.log("👋 所有资源已释放，进程退出");
  process.exit(0);
}

export function registerShutdown(app: Elysia) {
  process.on("SIGINT", () => gracefulShutdown(app));
  process.on("SIGTERM", () => gracefulShutdown(app));
  console.log("🔒 Graceful shutdown 已注册 (SIGINT/SIGTERM)");
}
