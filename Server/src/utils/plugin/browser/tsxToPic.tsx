import { browserManager } from "@utils/browser";
import * as path from "path";
import fs from "fs";
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export interface TsxToPicOptions {
  width?: number;
  height?: number;
  selector?: string;
  waitTime?: number;
  deviceScaleFactor?: number;
  outputFileName?: string;
  outputDir?: string;
  timeout?: number;
}

/**
 * 将 React 组件渲染为图片
 * @param Component React 组件
 * @param props 组件属性
 * @param options 配置选项
 * @returns 图片文件的绝对路径
 */
export async function tsxToPic<P extends object>(
  Component: React.ComponentType<P>,
  props: P,
  options: TsxToPicOptions = {}
): Promise<string> {
  const {
    width = 800,
    height = 600,
    selector = 'body',
    waitTime = 100,
    deviceScaleFactor = 2,
    outputFileName,
    outputDir = path.join(process.cwd(), "public", "tsxToPic"),
    timeout = 60000
  } = options;

  console.log(`🔍 开始 TSX 转图片任务`);

  try {
    // 1. 渲染组件为 HTML 字符串
    const htmlContent = renderToStaticMarkup(<Component {...props} />);
    console.log(`[Debug] HTML 生成完毕，长度: ${(htmlContent.length / 1024 / 1024).toFixed(2)} MB`);

    // 2. 准备输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = outputFileName
      ? (outputFileName.endsWith('.png') ? outputFileName : `${outputFileName}.png`)
      : `tsx_to_pic_${Date.now()}.png`;
    const outputPath = path.join(outputDir, fileName);

    const tempHtmlPath = path.join(outputDir, `temp_${Date.now()}.html`);
    // 写入 HTML 文件
    fs.writeFileSync(tempHtmlPath, htmlContent);

    // 3. 使用 Puppeteer 截图
    console.debug(`🌐 使用 Puppeteer 生成图片: ${outputPath}`);
    console.log(`[Debug] 正在创建 Puppeteer 页面...`);
    const page = await browserManager.newPage();

    try {
      await page.setViewport({
        width,
        height,
        deviceScaleFactor
      });

      // 设置页面内容
      // waitUntil: 'networkidle0' 确保外部资源（如 Tailwind CDN）加载完成
      console.debug(`⏳ 等待页面加载完成...`);
      console.log(`[Debug] 正在加载本地 HTML 文件: ${tempHtmlPath}`);
      const startTime = Date.now();
      
      // 使用 file:// 协议打开本地文件
      await page.goto(`file://${tempHtmlPath}`, {
        waitUntil: 'networkidle0',
        timeout: timeout
      });
      
      console.debug(`⏳ 页面加载完成，耗时 ${Date.now() - startTime} ms`);
      
      // 额外的等待时间
      if (waitTime > 0) {
        console.log(`[Debug] 等待额外时间: ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      let screenshotBuffer: Buffer;
      console.log(`[Debug] 开始截图...`);

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

      fs.writeFileSync(outputPath, screenshotBuffer);
      console.log(`📸 TSX 转图片已保存: ${outputPath}`);

      // 清理临时文件
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (e) {
        console.warn('清理临时 HTML 文件失败:', e);
      }

      await page.close();
      return outputPath;

    } catch (puppeteerError) {
      await page.close();
      // 发生错误时也尝试清理
      try {
        if (fs.existsSync(tempHtmlPath)) {
          fs.unlinkSync(tempHtmlPath);
        }
      } catch (e) {}
      throw puppeteerError;
    }

  } catch (error) {
    console.error("TSX 转图片失败:", error);
    throw error;
  }
}
