import { BasePluginController, PluginResult } from './BasePluginController';
import { xhhService } from '../../service/XhhService';

export class XhhCardPluginController extends BasePluginController {
  headers = ['[cq:json']; // 匹配 JSON 卡片消息

  async handle(sessionData: any): Promise<PluginResult> {
    const raw = sessionData?._data?.raw_message ?? '';
    console.log('[XhhCardPlugin] raw_message:', raw);

    if (!raw.includes('[CQ:json')) {
      console.log('[XhhCardPlugin] 非卡片消息，跳过');
      return { shouldReply: false, data: null };
    }

    // 检查是否为小黑盒分享卡片
    if (!raw.includes('小黑盒') && !raw.includes('xiaoheihe')) {
      console.log('[XhhCardPlugin] 非小黑盒卡片，跳过');
      return { shouldReply: false, data: null };
    }

    // 提取小黑盒帖子链接 - 匹配jumpUrl中的link_id
    // 格式: https://api.xiaoheihe.cn/v3/bbs/app/api/web/share?...&link_id=41c57140d966
    let linkId = '';

    // 方式1: 从jumpUrl中提取link_id参数
    const jumpUrlMatch = raw.match(/jumpUrl[^:]*:\s*"([^"]+)"/i) ||
                         raw.match(/jumpUrl[^:]*:\s*\\"([^"]+)\\"/i);
    
    if (jumpUrlMatch) {
      let jumpUrl = jumpUrlMatch[1]
        .replace(/\\u0026/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/\\\//g, '/')
        .replace(/\\\\/g, '\\')
        .replace(/\\"/g, '"')
        .trim();
      
      console.log('[XhhCardPlugin] 提取 jumpUrl:', jumpUrl);

      // 从URL中提取link_id参数
      const linkIdMatch = jumpUrl.match(/link_id=([a-zA-Z0-9]+)/);
      if (linkIdMatch) {
        linkId = linkIdMatch[1];
      }
    }

    // 方式2: 尝试从其他字段提取纯数字link_id
    if (!linkId) {
      // 小黑盒链接格式: https://www.xiaoheihe.cn/app/bbs/link/170530005
      const linkMatch = raw.match(/xiaoheihe\.cn\/app\/bbs\/link\/(\d+)/);
      if (linkMatch) {
        linkId = linkMatch[1];
      }
    }

    if (!linkId) {
      console.log('[XhhCardPlugin] 未找到小黑盒帖子ID');
      console.log('[XhhCardPlugin] 原始消息片段:', raw.substring(0, 500));
      return { shouldReply: false, data: null };
    }

    console.log('[XhhCardPlugin] 提取帖子ID:', linkId);

    try {
      // 调用XhhService渲染帖子为图片
      const imagePath = await xhhService.renderPostToImage(linkId);
      
      if (!imagePath) {
        console.log('[XhhCardPlugin] 渲染失败，无图片返回');
        return {
          shouldReply: true,
          data: [{ type: 'text', content: `❌ 小黑盒帖子渲染失败` }]
        };
      }

      console.log('[XhhCardPlugin] 渲染成功:', imagePath);
      return {
        shouldReply: true,
        data: [{ type: 'image', src: `file://${imagePath}`, alt: '小黑盒帖子' }]
      };
    } catch (err: any) {
      console.error('[XhhCardPlugin] 处理失败:', err);
      return {
        shouldReply: true,
        data: [{ type: 'text', content: `❌ 小黑盒卡片处理失败: ${err.message}` }]
      };
    }
  }
}
