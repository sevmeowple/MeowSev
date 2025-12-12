// src/utils/plugin/browser/htmlToPic.ts
import { browserManager } from "@utils/browser";
import * as path from "path";
import fs from "fs";
import { ToolDefinition, ToolResult } from "@/config/AI";
import { z } from "zod";
import { MessageObject } from "@/utils/message";

/* ------------------------------------------------------------------ */
/* 1. 读取HTML模板文件                                               */
/* ------------------------------------------------------------------ */
function readHtmlTemplate(templatePath: string): string {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(templatePath)) {
      throw new Error(`模板文件不存在: ${templatePath}`);
    }
    
    // 读取HTML模板
    const template = fs.readFileSync(templatePath, 'utf-8');
    
    if (!template.trim()) {
      throw new Error('模板文件内容为空');
    }
    
    console.log(`📄 成功读取HTML模板: ${templatePath}`);
    return template;
  } catch (error) {
    console.error("读取HTML模板失败:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* 2. 渲染HTML模板                                                   */
/* ------------------------------------------------------------------ */
function renderHtmlTemplate(template: string, data: Record<string, any>): string {
  try {
    let renderedHtml = template;
    
    // 简单的模板变量替换：{{variable}}
    const variableRegex = /\{\{([^}]+)\}\}/g;
    renderedHtml = renderedHtml.replace(variableRegex, (match, variable) => {
      const value = data[variable.trim()];
      if (value === undefined || value === null) {
        console.warn(`⚠️ 模板变量 ${variable} 未找到对应值`);
        return match; // 保持原样
      }
      return String(value);
    });
    
    // 处理数组循环：{{#each array}}...{{/each}}
    const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}/g;
    renderedHtml = renderedHtml.replace(eachRegex, (match, arrayName, templateContent) => {
      const array = data[arrayName.trim()];
      if (!Array.isArray(array)) {
        console.warn(`⚠️ 循环变量 ${arrayName} 不是数组`);
        return '';
      }
      
      return array.map(item => {
        let itemTemplate = templateContent;
        // 替换数组项中的变量
        const itemRegex = /\{\{([^}]+)\}\}/g;
        return itemTemplate.replace(itemRegex, (match: string, variable: string) => {
          const value = item[variable.trim()];
          return value !== undefined && value !== null ? String(value) : '';
        });
      }).join('');
    });
    
    console.log(`✅ HTML模板渲染完成`);
    return renderedHtml;
    
  } catch (error) {
    console.error("渲染HTML模板失败:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* 3. 创建HTML转图片截图函数                                         */
/* ------------------------------------------------------------------ */
async function createHtmlScreenshot(
  htmlContent: string,
  outputPath: string,
  options: { 
    width?: number; 
    height?: number;
    selector?: string;
    waitTime?: number;
  } = {}
): Promise<string> {
  const { 
    width = 800, 
    height = 600, 
    selector = 'body',
    waitTime = 2000 
  } = options;
  
  try {
    // Step 1: 保存临时HTML文件
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempHtmlPath = path.join(tempDir, `html_to_pic_${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
    
    console.log(`📄 临时HTML文件已创建: ${tempHtmlPath}`);
    
    // Step 2: 用Puppeteer渲染截图
    const page = await browserManager.newPage();
    
    try {
      await page.setViewport({ 
        width, 
        height, 
        deviceScaleFactor: 2 // 高清截图
      });
      
      const fileUrl = `file://${tempHtmlPath}`;
      await page.goto(fileUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000 
      });
      
      // 等待页面完全渲染和可能的动画
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // 截图指定元素或整个页面
      let screenshotBuffer: Buffer;
      
      if (selector && selector !== 'body') {
        const element = await page.$(selector);
        if (element) {
          const buffer = await element.screenshot({ type: 'png' });
          screenshotBuffer = Buffer.from(buffer);
        } else {
          console.warn(`⚠️ 未找到选择器 ${selector}，截取整个页面`);
          const buffer = await page.screenshot({ 
            fullPage: true,
            type: 'png'
          });
          screenshotBuffer = Buffer.from(buffer);
        }
      } else {
        const buffer = await page.screenshot({ 
          fullPage: true,
          type: 'png'
        });
        screenshotBuffer = Buffer.from(buffer);
      }
      
      // 保存截图
      fs.writeFileSync(outputPath, screenshotBuffer);
      console.log(`📸 HTML转图片截图已保存: ${outputPath}`);
      
      await page.close();
      
      // 清理临时文件
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
      
      return outputPath;
      
    } catch (puppeteerError) {
      await page.close();
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
      throw puppeteerError;
    }
    
  } catch (error) {
    console.error("创建HTML截图失败:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* 4. HTML转图片工具定义                                             */
/* ------------------------------------------------------------------ */
export const htmlToPicTool: ToolDefinition = {
  name: "htmlToPic", 
  description: "将HTML模板转换为图片，支持模板变量替换和数组循环",
  inputSchema: z.object({
    templatePath: z
      .string()
      .describe("HTML模板文件的绝对路径，如：/path/to/template.html"),
    data: z
      .record(z.any(), z.any())
      .describe("用于填充模板的数据对象，支持嵌套对象和数组"),
    outputFileName: z
      .string()
      .optional()
      .describe("输出图片文件名（不含扩展名），默认使用时间戳"),
    width: z
      .number()
      .min(100)
      .max(3000)
      .optional()
      .describe("图片宽度，默认800px"),
    height: z
      .number()
      .min(100)
      .max(3000)
      .optional()
      .describe("图片高度，默认600px"),
    selector: z
      .string()
      .optional()
      .describe("CSS选择器，指定要截图的元素，默认截取整个页面"),
    waitTime: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .describe("等待页面渲染的时间（毫秒），默认2000ms"),
  }),
  execute: async ({ 
    templatePath, 
    data, 
    outputFileName,
    width = 800, 
    height = 600, 
    selector = 'body',
    waitTime = 2000 
  }): Promise<ToolResult> => {
    console.log(`🔍 开始HTML转图片任务`);
    
    try {
      // Step 1: 读取HTML模板
      const htmlTemplate = readHtmlTemplate(templatePath);
      
      // Step 2: 渲染HTML模板
      const renderedHtml = renderHtmlTemplate(htmlTemplate, data);
      
      // Step 3: 准备输出目录和文件路径
      const outputDir = path.join(process.cwd(), "public", "htmlToPic");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const fileName = outputFileName 
        ? `${outputFileName}.png`
        : `html_to_pic_${Date.now()}.png`;
      const filePath = path.join(outputDir, fileName);
      
      // Step 4: 创建HTML截图
      const screenshotPath = await createHtmlScreenshot(renderedHtml, filePath, {
        width,
        height,
        selector,
        waitTime
      });
      
      console.log(`✅ 成功生成HTML转图片: ${screenshotPath}`);
      
      // 构建AI回复文本
      const aiResponse = `HTML模板转图片任务完成！

模板文件：${path.basename(templatePath)}
输出图片：${fileName}
图片尺寸：${width} × ${height}px
选择器：${selector}
渲染等待时间：${waitTime}ms

图片已生成完毕，包含您提供的所有数据内容～`;

      const userMessages: MessageObject[] = [{
        type: "image",
        src: `file://${screenshotPath}`,
        alt: `HTML模板渲染的图片`,
      }];
      
      return {
        success: true,
        responseType: "text",
        aiResponse,
        userMessages,
      };
      
    } catch (error) {
      console.error("HTML转图片失败:", error);
      
      return {
        success: false,
        errorInfo: `HTML转图片时发生错误: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
        aiResponse: `抱歉，HTML转图片任务失败。请检查模板文件路径是否正确，或稍后重试。错误：${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
};