import { getMemeManager } from "../config/plugins/meme";
import { MessageObject } from "../utils/message";
import path from "path";

export class MemeService {
  
  /**
   * 获取随机 meme
   * @param category 可选的分类筛选
   * @returns MessageObject 格式的 meme 消息
   */
  getRandomMeme(category?: string): MessageObject {
    try {
      const memeManager = getMemeManager();
      const meme = memeManager.getRandom(category);
      
      if (!meme) {
        return {
          type: "text",
          content: category 
            ? `❌ 在分类 "${category}" 中没有找到可用的表情包`
            : "❌ 没有找到可用的表情包"
        };
      }

      // 使用本地文件路径，参考 weather 工具的做法
      const imagePath = path.join(process.cwd(), 'public', 'meme', meme.filePath);
      
      return {
        type: "image",
        src: `file://${imagePath}`,
        alt: `${meme.name} - ${meme.description}`,
        content: `🎭 ${meme.name} - ${meme.description}`
      };
      
    } catch (error) {
      console.error('MemeService error:', error);
      return {
        type: "text",
        content: "❌ 获取表情包时出现错误"
      };
    }
  }

  /**
   * 获取所有分类
   * @returns 分类列表的文本消息
   */
  getCategories(): MessageObject {
    try {
      const memeManager = getMemeManager();
      const categories = memeManager.getCategories();
      
      if (categories.length === 0) {
        return {
          type: "text",
          content: "📂 暂无表情包分类"
        };
      }

      const categoryList = categories.map(cat => `• ${cat}`).join('\n');
      return {
        type: "text",
        content: `📂 可用的表情包分类：\n${categoryList}`
      };
      
    } catch (error) {
      console.error('MemeService getCategories error:', error);
      return {
        type: "text",
        content: "❌ 获取分类列表时出现错误"
      };
    }
  }
}