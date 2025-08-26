import { BasePluginController, PluginResult } from './BasePluginController';
import { BilibiliService } from '../../service/Bilibili/BilibiliService';
import { ConfigUnion } from '../../config/config';

export class BiliCardPluginController extends BasePluginController {
  headers = ['[cq:json']; // 匹配 JSON 卡片消息

  private biliService = new BilibiliService(ConfigUnion);

  async handle(sessionData: any): Promise<PluginResult> {
    const raw = sessionData?._data?.raw_message ?? '';
    console.log('[BiliCardPlugin] raw_message:', raw);

    if (!raw.includes('[CQ:json')) {
      console.log('[BiliCardPlugin] 非卡片消息，跳过');
      return { shouldReply: false, data: null };
    }

    // 提取 qqdocurl - 扩展匹配方式，支持完整URL路径
    const urlMatch = raw.match(/qqdocurl[^:]*:\s*"([^"]+)"/i) ||  // 标准引号格式
                     raw.match(/qqdocurl[^:]*:\s*"([^"]*)"/i) ||  // 空值兼容
                     raw.match(/qqdocurl[^:]*:\s*\\"([^"]+)\\"/i) ||  // 转义引号
                     raw.match(/qqdocurl[^:]*:\s*([^,}\s]+)/i);  // 无引号格式
    if (!urlMatch) {
      console.log('[BiliCardPlugin] 未找到 qqdocurl');
      // 为了调试，打印原始消息的前500字符
      console.log('[BiliCardPlugin] 原始消息片段:', raw.substring(0, 500));
      return { shouldReply: false, data: null };
    }

    // 处理URL中的转义字符
    let url = urlMatch[1]
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/')
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/\\u003A/g, ':')
      .replace(/\\u002F/g, '/')
      .replace(/\\"/g, '')
      .trim();
    console.log('[BiliCardPlugin] 提取 url:', url);

    let bvid = '';
    
    // 1. 直接匹配完整BV号
    const bvidMatch = url.match(/(BV[a-zA-Z0-9]{10})/);
    if (bvidMatch) {
      bvid = bvidMatch[1];
    } else {
      // 2. 处理b23.tv短链接
      const shortCodeMatch = url.match(/b23\.tv\/([a-zA-Z0-9]+)/);
      if (shortCodeMatch) {
        try {
          console.log('[BiliCardPlugin] 解析b23.tv短链接:', url);
          // 发送HEAD请求获取重定向地址
          const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
          const realUrl = response.url;
          console.log('[BiliCardPlugin] 重定向地址:', realUrl);
          
          // 从重定向地址提取BV号
          const realBvidMatch = realUrl.match(/(BV[a-zA-Z0-9]{10})/);
          if (realBvidMatch) {
            bvid = realBvidMatch[1];
            console.log('[BiliCardPlugin] 从短链接解析BV号:', bvid);
          } else {
            console.log('[BiliCardPlugin] 短链接解析失败，未找到BV号');
            return { shouldReply: false, data: null };
          }
        } catch (error) {
          console.error('[BiliCardPlugin] 短链接解析错误:', error);
          return {
            shouldReply: true,
            data: [{ type: 'text', content: `❌ 无法解析B站短链接: ${error}` }]
          };
        }
      } else {
        console.log('[BiliCardPlugin] 未找到BV号或短链接');
        return { shouldReply: false, data: null };
      }
    }
    console.log('[BiliCardPlugin] 提取 BV:', bvid);

    try {
      const result = await this.biliService.downloadByBvid(bvid);
      console.log('[BiliCardPlugin] 下载成功:', result);
      return { shouldReply: true, data: result };
    } catch (err: any) {
      console.error('[BiliCardPlugin] 下载失败:', err);
      return {
        shouldReply: true,
        data: [{ type: 'text', content: `❌ 卡片视频下载失败: ${err.message}` }]
      };
    }
  }
}