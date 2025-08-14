import * as htmlToImage from 'html-to-image';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { createCanvas, loadImage } from 'canvas';

export class TextToImageService {
  private outputDir: string;
  private dom: JSDOM;

  constructor() {
    // 创建临时图片输出目录
    this.outputDir = path.join(process.cwd(), 'public', 'temp', 'game-images');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // 创建虚拟 DOM 环境
    this.dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      pretendToBeVisual: true,
      resources: 'usable'
    });

    // 设置全局变量，包括 Canvas 支持
    global.document = this.dom.window.document;
    global.window = this.dom.window as any;
    global.HTMLElement = this.dom.window.HTMLElement;
    global.Image = this.dom.window.Image;
    
    // 为 html-to-image 提供 Canvas 支持
    global.HTMLCanvasElement = createCanvas(1, 1).constructor as any;
    global.CanvasRenderingContext2D = createCanvas(1, 1).getContext('2d')!.constructor as any;
    
    // 配置 html-to-image 使用 node-canvas
    const originalCreateElement = this.dom.window.document.createElement.bind(this.dom.window.document);
    this.dom.window.document.createElement = function(tagName: string) {
      if (tagName.toLowerCase() === 'canvas') {
        const canvas = createCanvas(300, 150); // 默认尺寸
        // 将 node-canvas 实例包装成 DOM 元素
        return canvas as any;
      }
      return originalCreateElement(tagName);
    };
  }

  /**
   * 通用文本渲染函数 - 将任意文本渲染为图片
   */
  async renderText(
    text: string, 
    title?: string, 
    theme: 'success' | 'error' | 'info' | 'warning' | 'game' = 'info'
  ): Promise<string> {
    const themes = {
      success: { bg: 'linear-gradient(135deg, #2d5016, #56ab2f)', accent: '#4CAF50', title: '#81C784' },
      error: { bg: 'linear-gradient(135deg, #5d1414, #c62d42)', accent: '#F44336', title: '#EF5350' },
      warning: { bg: 'linear-gradient(135deg, #5d4e14, #ff8f00)', accent: '#FF9800', title: '#FFB74D' },
      info: { bg: 'linear-gradient(135deg, #1a2332, #2d4a63)', accent: '#2196F3', title: '#64B5F6' },
      game: { bg: 'linear-gradient(135deg, #2d1b69, #11998e)', accent: '#9C27B0', title: '#BA68C8' }
    };

    const currentTheme = themes[theme];

    // 创建 HTML 结构
    const htmlContent = this.createGameHtml(text, title, currentTheme);
    
    // 创建容器元素
    const container = this.dom.window.document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    
    this.dom.window.document.body.appendChild(container);

    try {
      // 等待 DOM 准备就绪
      await new Promise(resolve => setTimeout(resolve, 100));

      // 使用 html-to-image 渲染
      const dataUrl = await htmlToImage.toPng(container.firstElementChild as HTMLElement, {
        width: 800,
        height: undefined, // 自动计算高度
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        pixelRatio: 2, // 高清
        canvasWidth: 800,
        canvasHeight: undefined,
        skipAutoScale: false,
        backgroundColor: 'transparent'
      });

      // 保存图片
      const fileName = `text-render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
      const filePath = path.join(this.outputDir, fileName);
      
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      // 清理 DOM
      this.dom.window.document.body.removeChild(container);

      return filePath;
    } catch (error) {
      // 清理 DOM
      if (container.parentNode) {
        this.dom.window.document.body.removeChild(container);
      }
      
      console.error('html-to-image 渲染失败，详细错误:', error);
      
      // 如果 html-to-image 失败，尝试备用的纯 Canvas 方案
      return this.fallbackCanvasRender(text, title, theme);
    }
  }

  /**
   * 备用的纯 Canvas 渲染方案
   */
  private async fallbackCanvasRender(
    text: string, 
    title?: string, 
    theme: 'success' | 'error' | 'info' | 'warning' | 'game' = 'info'
  ): Promise<string> {
    console.log('使用备用 Canvas 渲染方案');
    
    const themes = {
      success: { bg: ['#2d5016', '#56ab2f'], accent: '#4CAF50', title: '#81C784' },
      error: { bg: ['#5d1414', '#c62d42'], accent: '#F44336', title: '#EF5350' },
      warning: { bg: ['#5d4e14', '#ff8f00'], accent: '#FF9800', title: '#FFB74D' },
      info: { bg: ['#1a2332', '#2d4a63'], accent: '#2196F3', title: '#64B5F6' },
      game: { bg: ['#2d1b69', '#11998e'], accent: '#9C27B0', title: '#BA68C8' }
    };

    const currentTheme = themes[theme];
    const width = 800;
    const padding = 40;
    let currentY = padding;

    // 预计算高度
    const lines = text.split('\n');
    const lineHeight = 25;
    const titleHeight = title ? 40 + 50 : 0; // 标题 + 分割线
    const contentHeight = lines.length * lineHeight + titleHeight;
    const totalHeight = contentHeight + padding * 2;

    // 创建 Canvas
    const canvas = createCanvas(width, totalHeight);
    const ctx = canvas.getContext('2d');

    // 绘制渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, totalHeight);
    gradient.addColorStop(0, currentTheme.bg[0]);
    gradient.addColorStop(1, currentTheme.bg[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, totalHeight);

    // 设置字体
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // 绘制标题
    if (title) {
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = currentTheme.title;
      ctx.textAlign = 'center';
      ctx.fillText(title, width / 2, currentY);
      currentY += 40;

      // 绘制分割线
      ctx.beginPath();
      ctx.moveTo(padding, currentY);
      ctx.lineTo(width - padding, currentY);
      ctx.strokeStyle = currentTheme.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      currentY += 30;
    }

    // 绘制文本内容
    ctx.textAlign = 'left';
    for (const line of lines) {
      if (line.trim() === '') {
        currentY += 15;
        continue;
      }

      const isSpecialLine = /^[🎮🏁🐢📖💡⚠️❌✅ℹ️🎯👥⏰📊❓💭🏆]/.test(line.trim());
      
      if (isSpecialLine) {
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = currentTheme.accent;
      } else {
        ctx.font = '18px Arial';
        ctx.fillStyle = '#ffffff';
      }

      ctx.fillText(line, padding, currentY);
      currentY += lineHeight;
    }

    // 保存图片
    const fileName = `fallback-render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
    const filePath = path.join(this.outputDir, fileName);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);

    return filePath;
  }

  /**
   * 创建游戏消息的 HTML 结构
   */
  private createGameHtml(text: string, title?: string, theme?: any): string {
    const lines = text.split('\n');
    
    let contentHtml = '';
    
    // 添加标题
    if (title) {
      contentHtml += `
        <div class="title">${this.escapeHtml(title)}</div>
        <div class="divider"></div>
      `;
    }

    // 添加文本内容
    for (const line of lines) {
      if (line.trim() === '') {
        contentHtml += '<div class="spacer"></div>';
        continue;
      }

      const isSpecialLine = /^[🎮🏁🐢📖💡⚠️❌✅ℹ️🎯👥⏰📊❓💭🏆]/.test(line.trim());
      const className = isSpecialLine ? 'special-line' : 'normal-line';
      
      contentHtml += `<div class="${className}">${this.escapeHtml(line)}</div>`;
    }

    return `
      <div class="game-container" style="
        width: 800px;
        min-height: 400px;
        background: ${theme?.bg || 'linear-gradient(135deg, #1a2332, #2d4a63)'};
        padding: 40px;
        box-sizing: border-box;
        font-family: 'Arial', 'Microsoft YaHei', sans-serif;
        color: white;
        position: relative;
        overflow: hidden;
      ">
        <style>
          .game-container .title {
            font-size: 28px;
            font-weight: bold;
            color: ${theme?.title || '#64B5F6'};
            text-align: center;
            margin-bottom: 20px;
            word-wrap: break-word;
          }
          
          .game-container .divider {
            width: 100%;
            height: 2px;
            background: ${theme?.accent || '#2196F3'};
            margin: 20px 0 30px 0;
          }
          
          .game-container .normal-line {
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 8px;
            word-wrap: break-word;
            color: #ffffff;
          }
          
          .game-container .special-line {
            font-size: 20px;
            font-weight: bold;
            line-height: 1.6;
            margin-bottom: 8px;
            color: ${theme?.accent || '#2196F3'};
            word-wrap: break-word;
          }
          
          .game-container .spacer {
            height: 15px;
          }
        </style>
        
        ${contentHtml}
      </div>
    `;
  }

  /**
   * 专门用于海龟汤游戏的文本渲染
   */
  async renderGameText(text: string, gameType: string = '海龟汤'): Promise<string> {
    let title = '';
    let theme: 'success' | 'error' | 'info' | 'warning' | 'game' = 'game';
    
    if (text.includes('游戏开始') || text.includes('🐢')) {
      title = `🐢 ${gameType}游戏开始`;
      theme = 'success';
    } else if (text.includes('游戏结束') || text.includes('🏁')) {
      title = `🏁 ${gameType}游戏结束`;
      theme = 'info';
    } else if (text.includes('恭喜') || text.includes('🏆')) {
      title = `🏆 ${gameType}游戏结果`;
      theme = 'success';
    } else if (text.includes('❌') || text.includes('失败')) {
      theme = 'error';
    } else if (text.includes('状态') || text.includes('📊')) {
      title = `📊 ${gameType}游戏状态`;
      theme = 'info';
    }

    return this.renderText(text, title, theme);
  }

  // ... 其他方法保持不变 ...

  /**
   * HTML 转义函数
   */
  private escapeHtml(text: string): string {
    const div = this.dom.window.document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 清理过期的临时图片文件
   */
  cleanupOldImages(): void {
    try {
      const files = fs.readdirSync(this.outputDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24小时

      files.forEach(file => {
        const filePath = path.join(this.outputDir, file);
        const stat = fs.statSync(filePath);
        
        if (now - stat.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`清理过期图片: ${file}`);
        }
      });
    } catch (error) {
      console.error('清理图片时出错:', error);
    }
  }

  /**
   * 销毁 DOM 环境
   */
  destroy(): void {
    this.dom.window.close();
  }
}

// 单例实例
let textToImageService: TextToImageService | null = null;

export function getTextToImageService(): TextToImageService {
  if (!textToImageService) {
    textToImageService = new TextToImageService();
  }
  return textToImageService;
}