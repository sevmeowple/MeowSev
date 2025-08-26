import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { MsgService } from "@service/MsgService";
import { ConfigUnion } from "@/config/config";
import { createXiaohongshuProcessor } from "@/service/message/processors/xhsProcessor";
import { EchoPluginController } from "./messagePlugins/EchoPluginController";
import { BiliCardPluginController } from './messagePlugins/BiliCardPluginController';

const msgService = new MsgService(ConfigUnion);
const echoPlugin = new EchoPluginController();
const biliCardPlugin = new BiliCardPluginController();

// msgService.registerProcessor(createXiaohongshuProcessor(ConfigUnion))
// 注册当前控制器的路由
RouteRegistry.registerBatch(['message']);

// 插件路由表：header -> 插件实例
const pluginRouter: Record<string, BasePluginController> = {
  // echo: echoPlugin,
  // repeat: echoPlugin,
  '[cq:json': biliCardPlugin
};

// 动态加载所有插件（后续可改为自动扫描）
import { BasePluginController } from "./messagePlugins/BasePluginController";

export const msgController = new Elysia()
  .post("/message", async ({ body }) => {
    if (!body || typeof body !== 'object' || !('data' in body)) {
      return { success: false, message: "Invalid message format" };
    }

    const sessionData = body.data as any;
    // console.info(sessionData)
    // 无论如何先保存消息
    await msgService.handleMessage(sessionData);

    // 优先检查是否为卡片消息（使用 _data.raw_message）
    const raw = sessionData?._data?.raw_message ?? '';
    // console.log('[MsgController] raw_message:', raw);
    if (raw.includes('[CQ:json')) {
      console.log('[MsgController] 触发卡片插件');
      const result = await biliCardPlugin.handle(sessionData);
      console.log('[MsgController] 插件返回:', result);
      if (result.shouldReply) return result;
    }

    // 普通文本消息按 header 路由
    const textContent = sessionData?.content ?? '';
    const header = textContent.trim().split(/\s+/)[0]?.toLowerCase() || '';
    const plugin = pluginRouter[header];
    if (plugin) {
      const result = await plugin.handle(sessionData);
      return result;
    }

    // 无匹配插件：不回复
    return { shouldReply: false };
  });