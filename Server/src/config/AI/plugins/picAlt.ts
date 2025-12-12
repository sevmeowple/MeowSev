import { ToolDefinition, ToolResult } from "..";
import { z } from "zod";
import { MessageObject } from "@/utils/message";
import { browserManager } from "@utils/browser";

// 图片结果接口
interface ImageResult {
  title: string;
  url: string;
  width: number;
  height: number;
  source: string;
}

// 爬取 Bing 图片
async function scrapeBingImages(query: string): Promise<ImageResult[]> {
  const page = await browserManager.newPage();
  
  try {
    // 构建 Bing 图片搜索 URL
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&tsc=ImageHoverTitle`;
    console.log(`🔍 在 Bing 搜索图片: ${url}`);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // 等待图片元素加载
    try {
      await page.waitForSelector('.iusc', { timeout: 5000 });
    } catch (e) {
      console.log('未找到图片元素，可能是搜索结果为空');
      return [];
    }

    // 提取图片数据
    // Bing 的图片数据存储在 .iusc 元素的 m 属性中 (JSON格式)
    const images = await page.evaluate(() => {
      const results: any[] = [];
      const elements = document.querySelectorAll('.iusc');
      
      elements.forEach((el) => {
        try {
          const mData = el.getAttribute('m');
          if (mData) {
            const data = JSON.parse(mData);
            if (data.murl && data.t) {
              results.push({
                title: data.t, // 标题
                url: data.murl, // 图片直链
                width: parseInt(data.w) || 0,
                height: parseInt(data.h) || 0,
                source: 'Bing'
              });
            }
          }
        } catch (e) {
          // 忽略解析错误的项
        }
      });
      
      return results;
    });
    
    console.log(`✅ 从 Bing 抓取到 ${images.length} 张图片`);
    return images;
    
  } catch (error) {
    console.error("Bing 图片搜索失败:", error);
    return [];
  } finally {
    await page.close();
  }
}

// 导出工具定义
export const picAltTool: ToolDefinition = {
  name: "searchImage", // 保持名字一致，或者改为 searchImageAlt
  description: "搜索图片，使用 Bing 搜索引擎",
  inputSchema: z.object({
    query: z.string().describe("搜索关键词，如：猫咪、风景、动漫角色"),
  }),
  execute: async ({ query }): Promise<ToolResult> => {
    console.log(`🖼️ 图片搜索请求 (Bing): ${query}`);
    
    try {
      const images = await scrapeBingImages(query);
      
      if (images.length === 0) {
        return {
          success: false,
          errorInfo: "未找到相关图片",
          aiResponse: `抱歉，在 Bing 上没有找到关于 "${query}" 的图片。`,
        };
      }
      
      // 随机选择一张图片（优先选前20张，保证相关性）
      const topCount = Math.min(images.length, 20);
      const randomIndex = Math.floor(Math.random() * topCount);
      const selectedImage = images[randomIndex];
      
      console.log(`✅ 选中图片: ${selectedImage.title}`);
      
      const userMessages: MessageObject[] = [{
        type: "image",
        src: selectedImage.url,
        alt: selectedImage.title,
      }];
      
      return {
        success: true,
        responseType: "image",
        resUrl: selectedImage.url,
        aiResponse: `已为你找到 "${query}" 的图片！\n标题: ${selectedImage.title}\n来源: Bing`,
        userMessages,
      };
      
    } catch (error) {
      console.error("图片搜索工具执行失败:", error);
      return {
        success: false,
        errorInfo: `搜索失败: ${error instanceof Error ? error.message : "未知错误"}`,
        aiResponse: "抱歉，搜索图片时发生了错误。",
      };
    }
  },
};