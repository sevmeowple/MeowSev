import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { MemeService } from "../service/MemeService";
import { MessageObject } from "../utils/message";
import { getMemeManager } from "../config/plugins/meme";
import { Meme } from "../utils/meme";
import { promises as fs } from 'fs';
import path from 'path';
import { ConfigUnion } from "../config/config";
import { HelpRegistry } from "../utils/HelpRegistry";


// 图片下载工具函数
async function downloadImageFromMessage(content: string, downloadPath: string): Promise<string | null> {
  // 正则提取图片URL
  const imgMatch = content.match(/src="([^"]+)"/);
  if (!imgMatch) {
    console.log('未找到图片URL');
    return null;
  }

  const imageUrl = imgMatch[1].replace(/&amp;/g, '&');

  // 提取文件名
  const fileMatch = content.match(/file="([^"]+)"/);
  const fileName = fileMatch ? fileMatch[1] : `image_${Date.now()}.jpg`;

  console.log(`📥 开始下载图片: ${fileName}`);
  console.log(`🔗 URL: ${imageUrl}`);

  try {
    // 确保下载目录存在
    await fs.mkdir(downloadPath, { recursive: true });

    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const filePath = path.join(downloadPath, fileName);

    await fs.writeFile(filePath, Buffer.from(buffer));

    console.log(`✅ 图片下载成功: ${filePath}`);
    console.log(`📊 文件大小: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

    return fileName;
  } catch (error) {
    console.error('❌ 图片下载失败:', error);
    return null;
  }
}

// 注册 meme 相关路由 - 扩展路由注册
RouteRegistry.registerBatch([
  'meme',
  'meme-categories',
  'meme-add',
  'meme-edit',
  'meme-delete',
  'meme-list'
]);

// 注册帮助信息
HelpRegistry.register({
    command: 'meme',
    description: '检索或管理梗图资源',
    usage: 'meme [分类名] 或 meme-add ...',
    examples: [
        'meme          (随机调取)',
        'meme 哭       (调取"哭"分类资源)',
        'meme-list     (查看资源索引)',
        'meme-add-from-session [id] [name] ... (录入新资源)'
    ],
    details: `博士，工作压力大的时候，看看这些有趣的图片也许能缓解心情。
    
支持的指令：
- meme [分类]: 从指定分类中随机调取一张图片
- meme-list: 查看目前数据库中所有的分类索引
- meme-add: 将新的资源录入数据库
- meme-delete: 从数据库中移除资源

请适度娱乐，博士。`
});

const memeService = new MemeService();

export const memeController = new Elysia()
  .post("/meme", ({ body }): MessageObject => {
    console.log('Meme endpoint 收到请求:', JSON.stringify(body, null, 2));

    // 检查是否有指定分类参数
    if (body && typeof body === 'object' && 'params' in body) {
      const params = body.params as string[];
      const category = params.length > 0 ? params[0] : undefined;

      console.log('指定分类:', category);
      return memeService.getRandomMeme(category);
    }

    // 无参数，返回随机 meme
    console.log('获取随机 meme（无分类限制）');
    return memeService.getRandomMeme();
  })
  .post("/meme-add", async ({ body }): Promise<MessageObject> => {
    console.log('Meme add from session endpoint 收到请求:', JSON.stringify(body, null, 2));

    if (body && typeof body === 'object' && 'params' in body && 'session' in body) {
      const params = body.params as string[];
      const session = body.session as any;

      if (params.length < 3) {
        return {
          type: "text",
          content: "❌ 参数不足，格式：meme-add-from-session [id] [name] [description] [keywords?] [category?]"
        };
      }

      const [id, name, description, keywordsStr, category] = params;

      try {
        const memeManager = getMemeManager(ConfigUnion.app.plugins.meme.configPath);

        // 检查 ID 是否已存在
        if (memeManager.getById(id)) {
          return {
            type: "text",
            content: `❌ ID "${id}" 已存在`
          };
        }

        let imageContent = null;
        let downloadedFileName = null;

        // 情况1：检查当前消息是否包含图片
        if (session?.message?.content?.includes('<img')) {
          imageContent = session.message.content;
          console.log('🎯 检测到当前消息包含图片');
        }
        // 情况2：检查引用的消息是否包含图片
        else if (session?.message?.quote?.content?.includes('<img')) {
          imageContent = session.message.quote.content;
          console.log('🎯 检测到引用消息包含图片');
        }

        if (!imageContent) {
          return {
            type: "text",
            content: "❌ 当前消息或引用消息中没有找到图片"
          };
        }

        // 下载图片
        downloadedFileName = await downloadImageFromMessage(imageContent, './public/meme/meme-temp');

        if (!downloadedFileName) {
          return {
            type: "text",
            content: "❌ 图片下载失败"
          };
        }

        // 解析 keywords
        const keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()) : undefined;

        // 构造 meme 对象
        const newMeme: Meme = {
          id,
          name,
          description,
          filePath: `meme-temp/${downloadedFileName}`,  // 相对于下载目录的路径
          keywords,
          category
        };

        const success = memeManager.add(newMeme);

        if (success) {
          return {
            type: "text",
            content: `✅ 成功添加表情包: ${name} (${id})\n📝 描述: ${description}`
          };
        } else {
          return {
            type: "text",
            content: "❌ 保存 meme 配置失败"
          };
        }

      } catch (error) {
        console.error('从消息添加 meme 失败:', error);
        return {
          type: "text",
          content: `❌ 添加失败，喵喵不知道喵`
        };
      }
    }

    return {
      type: "text",
      content: "❌ 请求格式错误，需要 params 和 session 字段"
    };
  })

  .post("/meme-categories", ({ body }): MessageObject => {
    console.log('Meme categories endpoint 收到请求');
    return memeService.getCategories();
  })

  // 编辑 meme - 参数格式: [id, field, value] 或 [id, name, description, filePath, keywords, category]
  .post("/meme-edit", ({ body }): MessageObject => {
    console.log('Meme edit endpoint 收到请求:', JSON.stringify(body, null, 2));

    if (body && typeof body === 'object' && 'params' in body) {
      const params = body.params as string[];

      if (params.length < 3) {
        return {
          type: "text",
          content: "❌ 参数不足，格式：meme-edit [id] [field] [value] 或 meme-edit [id] [name] [description] [filePath] [keywords] [category]"
        };
      }

      const [id, ...rest] = params;

      try {
        const memeManager = getMemeManager(ConfigUnion.app.plugins.meme.configPath);

        // 检查 meme 是否存在
        if (!memeManager.getById(id)) {
          return {
            type: "text",
            content: `❌ ID "${id}" 不存在`
          };
        }

        let updates: Partial<Omit<Meme, 'id'>> = {};

        if (rest.length === 2) {
          // 单字段更新格式: [field, value]
          const [field, value] = rest;
          if (field === 'keywords') {
            updates[field] = value.split(',').map(k => k.trim());
          } else if (field in ['name', 'description', 'filePath', 'category']) {
            (updates as any)[field] = value;
          } else {
            return {
              type: "text",
              content: `❌ 无效字段: ${field}，支持的字段: name, description, filePath, keywords, category`
            };
          }
        } else if (rest.length >= 5) {
          // 全量更新格式: [name, description, filePath, keywords, category]
          const [name, description, filePath, keywordsStr, category] = rest;
          updates = {
            name,
            description,
            filePath,
            keywords: keywordsStr ? keywordsStr.split(',').map(k => k.trim()) : undefined,
            category: category || undefined
          };
        } else {
          return {
            type: "text",
            content: "❌ 参数错误，请使用正确格式"
          };
        }

        const success = memeManager.update(id, updates);

        if (success) {
          const updatedMeme = memeManager.getById(id);
          return {
            type: "text",
            content: `✅ 成功编辑表情包: ${updatedMeme?.name} (${id})`
          };
        } else {
          return {
            type: "text",
            content: "❌ 编辑失败"
          };
        }

      } catch (error) {
        console.error('编辑 meme 失败:', error);
        return {
          type: "text",
          content: "❌ 编辑失败，服务器错误"
        };
      }
    }

    return {
      type: "text",
      content: "❌ 请求格式错误"
    };
  })

  // 删除 meme - 参数格式: [id]
  .post("/meme-delete", ({ body }): MessageObject => {
    console.log('Meme delete endpoint 收到请求:', JSON.stringify(body, null, 2));

    if (body && typeof body === 'object' && 'params' in body) {
      const params = body.params as string[];

      if (params.length < 1) {
        return {
          type: "text",
          content: "❌ 请提供要删除的 meme ID"
        };
      }

      const [id] = params;

      try {
        const memeManager = getMemeManager(ConfigUnion.app.plugins.meme.configPath);

        // 检查 meme 是否存在
        const existingMeme = memeManager.getById(id);
        if (!existingMeme) {
          return {
            type: "text",
            content: `❌ ID "${id}" 不存在`
          };
        }

        const success = memeManager.delete(id);

        if (success) {
          return {
            type: "text",
            content: `✅ 成功删除表情包: ${existingMeme.name} (${id})`
          };
        } else {
          return {
            type: "text",
            content: "❌ 删除失败"
          };
        }

      } catch (error) {
        console.error('删除 meme 失败:', error);
        return {
          type: "text",
          content: "❌ 删除失败，服务器错误"
        };
      }
    }

    return {
      type: "text",
      content: "❌ 请求格式错误"
    };
  })

  // 列出所有 meme - 参数格式: [] 或 [category]
  .post("/meme-list", ({ body }): MessageObject => {
    console.log('Meme list endpoint 收到请求:', JSON.stringify(body, null, 2));

    try {
      const memeManager = getMemeManager(ConfigUnion.app.plugins.meme.configPath);
      let memes: Meme[] = [];
      let title = "📋 所有表情包列表：";

      if (body && typeof body === 'object' && 'params' in body) {
        const params = body.params as string[];
        if (params.length > 0) {
          const category = params[0];
          memes = memeManager.getByCategory(category);
          title = `📋 分类 "${category}" 的表情包：`;
        } else {
          memes = memeManager.getAll();
        }
      } else {
        memes = memeManager.getAll();
      }

      if (memes.length === 0) {
        return {
          type: "text",
          content: "📋 暂无表情包"
        };
      }

      const list = memes.map((meme, index) =>
        `${index + 1}. ${meme.name} (${meme.id})\n   📁 ${meme.filePath}\n   📝 ${meme.description}`
      ).join('\n\n');

      return {
        type: "text",
        content: `${title}\n\n${list}\n\n💯 共 ${memes.length} 个表情包`
      };

    } catch (error) {
      console.error('获取 meme 列表失败:', error);
      return {
        type: "text",
        content: "❌ 获取列表失败，服务器错误"
      };
    }
  });