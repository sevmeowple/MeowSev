import path from "path";
import * as fs from "fs";
import axios from "axios";
import { browserManager } from "@/utils/browser";
import type { Page } from "puppeteer";

/* ------------------------------------------------------------------ */
/* 图片处理工具                                                        */
/* ------------------------------------------------------------------ */

/**
 * 下载图片并转换为 base64
 * @param url 图片URL
 * @returns base64 data URI 或 null
 */
async function downloadImageToBase64(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.xiaoheihe.cn/'
      }
    });
    
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`[XhhService] 下载图片失败: ${url}`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * 批量下载图片并转换为 base64
 * @param urls 图片URL数组
 * @returns base64 data URI 数组（失败的图片会被过滤掉）
 */
async function downloadImagesToBase64(urls: string[]): Promise<string[]> {
  const results = await Promise.all(
    urls.map(url => downloadImageToBase64(url))
  );
  return results.filter((result): result is string => result !== null);
}

/* ------------------------------------------------------------------ */
/* 类型定义                                                           */
/* ------------------------------------------------------------------ */
interface CachedSession {
  baseParams: Record<string, string>;
  headers: Record<string, string>;
  expiresAt: number;
}

/**
 * text 字段 JSON 数组中的内容项
 * type 可以是 "text"、"img" 或 "html"
 */
interface TextContentItem {
  text?: string;
  type: "text" | "img" | "html";
  url?: string;
  width?: string;
  height?: string;
}

/**
 * 用户信息
 */
interface XhhUserInfo {
  userid: number;
  username: string;
  avatar: string;
  [key: string]: any;
}

interface XhhLinkData {
  linkid: string;
  title: string;
  text: string; // JSON 字符串，包含文本和图片的混合内容
  content: string;
  click: number;
  comment_num: number;
  link_award_num: number;
  favour_count: number;
  userid: string;
  user?: XhhUserInfo; // 用户信息对象
  ip_location: string;
  create_at: number;
  modify_at: number;
  [key: string]: any;
}

/* ------------------------------------------------------------------ */
/* HTML模板处理函数                                                   */
/* ------------------------------------------------------------------ */
function readHtmlTemplate(templatePath: string): string {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`模板文件不存在: ${templatePath}`);
  }
  const template = fs.readFileSync(templatePath, 'utf-8');
  if (!template.trim()) {
    throw new Error('模板文件内容为空');
  }
  return template;
}

function renderHtmlTemplate(template: string, data: Record<string, any>): string {
  let renderedHtml = template;
  
  // 简单的模板变量替换：{{variable}}
  const variableRegex = /\{\{([^}]+)\}\}/g;
  renderedHtml = renderedHtml.replace(variableRegex, (match, variable) => {
    const value = data[variable.trim()];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
  
  return renderedHtml;
}

/* ------------------------------------------------------------------ */
/* XhhService 主类                                                    */
/* ------------------------------------------------------------------ */
export class XhhService {
  private readonly dataDir: string;
  private readonly templatePath: string;
  private sessionCache: CachedSession | null = null;
  private isRefreshing: boolean = false;

  constructor() {
    this.dataDir = path.join(process.cwd(), "data", "xhh");
    this.templatePath = path.join(process.cwd(), "public", "templates", "xhh_template.html");
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * 核心功能：根据帖子ID渲染为图片
   * @param linkId 帖子ID
   * @returns 图片文件路径 或 null
   */
  async renderPostToImage(linkId: string): Promise<string | null> {
    try {
      // 1. 获取帖子数据
      const postData = await this.fetchLinkData(linkId);
      if (!postData) {
        console.error(`[XhhService] 获取帖子 ${linkId} 数据失败`);
        return null;
      }

      // 2. 准备模板数据（包含图片下载）
      const templateData = await this.prepareTemplateData(postData);

      // 3. 渲染HTML并截图
      const imagePath = await this.renderHtmlToImage(templateData, linkId);
      
      return imagePath;
    } catch (error) {
      console.error(`[XhhService] 渲染帖子 ${linkId} 失败:`, error);
      return null;
    }
  }

  /**
   * 获取帖子数据
   */
  async fetchLinkData(linkId: string, page: number = 1): Promise<XhhLinkData | null> {
    try {
      // 检查缓存
      if (!this.sessionCache || Date.now() > this.sessionCache.expiresAt) {
        await this.refreshSession();
      }

      if (!this.sessionCache) {
        throw new Error('无法初始化小黑盒会话');
      }

      // 构造请求参数
      const requestParams = {
        ...this.sessionCache.baseParams,
        link_id: linkId,
        page: page.toString(),
        limit: '20',
        is_first: page === 1 ? '1' : '0'
      };

      // 发起API请求
      const res = await axios({
        method: 'GET',
        url: 'https://api.xiaoheihe.cn/bbs/app/link/tree',
        params: requestParams,
        headers: this.sessionCache.headers,
        timeout: 10000
      });

      if (res.data?.status === 'ok') {
        return res.data.result.link;
      } else {
        console.warn('[XhhService] API Error:', res.data);
        if (res.data?.msg?.includes('权限') || res.data?.msg?.includes('校验')) {
          this.sessionCache = null;
        }
        throw new Error(res.data?.msg || 'API 请求被拒绝');
      }
    } catch (error) {
      console.error(`[XhhService] 获取帖子 ${linkId} 失败:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * 刷新小黑盒凭证
   */
  private async refreshSession(): Promise<CachedSession> {
    if (this.isRefreshing) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (this.sessionCache && Date.now() < this.sessionCache.expiresAt) {
        return this.sessionCache;
      }
    }

    this.isRefreshing = true;
    console.log('[XhhService] 正在刷新小黑盒凭证...');

    let page: Page | null = null;

    try {
      page = await browserManager.newPage();

      // 开启请求拦截，屏蔽不必要资源
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // 设置目标API监听
      const requestPromise = page.waitForRequest(request =>
        request.url().includes('/bbs/app/link/tree') &&
        request.method() === 'GET'
      );

      // 访问触发页面
      await page.goto('https://www.xiaoheihe.cn/app/bbs/link/170330097', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // 等待并提取数据
      const request = await requestPromise;
      const urlObj = new URL(request.url());
      const allHeaders = request.headers();

      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      // 更新缓存
      const newSession: CachedSession = {
        baseParams: params,
        headers: {
          'User-Agent': allHeaders['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': allHeaders['cookie'] || '',
          'Referer': 'https://www.xiaoheihe.cn/',
          'Accept': 'application/json, text/plain, */*'
        },
        expiresAt: Date.now() + 10 * 60 * 1000 // 缓存10分钟
      };

      this.sessionCache = newSession;
      console.log('[XhhService] 凭证刷新成功！');
      return newSession;

    } catch (error) {
      console.error('[XhhService] 凭证获取失败:', error);
      throw new Error('Failed to refresh Heybox credentials');
    } finally {
      if (page) await page.close().catch(() => {});
      this.isRefreshing = false;
    }
  }

  /**
   * 从 HTML 字符串中提取所有图片 URL
   */
  private extractImageUrlsFromHtml(htmlContent: string): string[] {
    const urls: string[] = [];
    // 匹配 <img ... data-original="url" ... /> 或 <img ... src="url" ... />
    const imgRegex = /<img[^>]*(?:data-original|src)=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      if (match[1]) {
        urls.push(match[1]);
      }
    }
    return urls;
  }

  /**
   * 替换 HTML 中的图片 URL 为 base64
   */
  private replaceImageUrlsInHtml(htmlContent: string, urlToBase64Map: Map<string, string>): string {
    let result = htmlContent;
    for (const [url, base64] of urlToBase64Map) {
      // 替换 data-original 和 src 属性中的 URL
      result = result.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), base64);
    }
    return result;
  }

  /**
   * 解析并渲染帖子内容（text 字段是 JSON 数组）
   * 支持 type: "text", "img", "html"
   */
  private async parseAndRenderContent(textJson: string): Promise<string> {
    try {
      const contentItems: TextContentItem[] = JSON.parse(textJson);
      let html = '';
      let imageBuffer: { url: string; base64?: string }[] = [];

      // 先收集所有图片URL（包括 img 类型和 html 内容中的图片）
      const allImageUrls: string[] = [];
      for (const item of contentItems) {
        if (item.type === 'img' && item.url) {
          allImageUrls.push(item.url);
        } else if (item.type === 'html' && item.text) {
          // 从 HTML 内容中提取图片 URL
          const htmlImageUrls = this.extractImageUrlsFromHtml(item.text);
          allImageUrls.push(...htmlImageUrls);
        }
      }

      // 去重
      const uniqueImageUrls = [...new Set(allImageUrls)];

      // 批量下载图片并转换为 base64
      console.log(`[XhhService] 从 text JSON 中发现 ${uniqueImageUrls.length} 张图片，开始下载...`);
      const base64Results = await Promise.all(
        uniqueImageUrls.map(url => downloadImageToBase64(url))
      );
      
      // 创建 URL -> base64 映射
      const urlToBase64Map = new Map<string, string>();
      uniqueImageUrls.forEach((url, index) => {
        const base64 = base64Results[index];
        if (base64) {
          urlToBase64Map.set(url, base64);
        }
      });
      console.log(`[XhhService] 成功下载 ${urlToBase64Map.size} 张图片`);

      // 遍历内容项，生成 HTML
      for (const item of contentItems) {
        if (item.type === 'text' && item.text) {
          // 先输出之前积累的图片
          if (imageBuffer.length > 0) {
            html += '<div class="image-gallery">';
            for (const img of imageBuffer) {
              const imgSrc = img.base64 || img.url;
              html += `<div class="image-item"><img src="${imgSrc}" alt="帖子图片" /></div>`;
            }
            html += '</div>';
            imageBuffer = [];
          }
          // 输出文本内容
          html += `<div class="text-content">${item.text}</div>`;
        } else if (item.type === 'html' && item.text) {
          // 先输出之前积累的图片
          if (imageBuffer.length > 0) {
            html += '<div class="image-gallery">';
            for (const img of imageBuffer) {
              const imgSrc = img.base64 || img.url;
              html += `<div class="image-item"><img src="${imgSrc}" alt="帖子图片" /></div>`;
            }
            html += '</div>';
            imageBuffer = [];
          }
          // 输出 HTML 内容，并替换其中的图片 URL 为 base64
          const processedHtml = this.replaceImageUrlsInHtml(item.text, urlToBase64Map);
          html += `<div class="text-content">${processedHtml}</div>`;
        } else if (item.type === 'img' && item.url) {
          // 积累图片，稍后一起输出
          const base64 = urlToBase64Map.get(item.url);
          imageBuffer.push({ url: item.url, base64: base64 || undefined });
        }
      }

      // 输出剩余的图片
      if (imageBuffer.length > 0) {
        html += '<div class="image-gallery">';
        for (const img of imageBuffer) {
          const imgSrc = img.base64 || img.url;
          html += `<div class="image-item"><img src="${imgSrc}" alt="帖子图片" /></div>`;
        }
        html += '</div>';
      }

      return html;
    } catch (error) {
      console.error('[XhhService] 解析帖子内容失败:', error);
      return '<p class="text-content">内容解析失败</p>';
    }
  }

  /**
   * 准备模板数据（解析 text JSON 字段）
   */
  private async prepareTemplateData(postData: XhhLinkData): Promise<Record<string, any>> {
    // 格式化时间
    const formatTime = (timestamp: number | string): string => {
      if (!timestamp) return '未知';
      const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) * 1000 : timestamp * 1000);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // 解析并渲染 text 字段（包含文本和图片的 JSON 数组）
    const contentHtml = await this.parseAndRenderContent(postData.text);

    // 获取用户名（从 user 对象中获取，若无则使用默认值）
    const username = postData.user?.username || '未知用户';

    return {
      linkid: postData.linkid || '',
      title: postData.title || '无标题',
      content: contentHtml, // 使用解析后的 HTML 内容
      click: postData.click || 0,
      comment_num: postData.comment_num || 0,
      link_award_num: postData.link_award_num || 0,
      favour_count: postData.favour_count || 0,
      userid: postData.userid || '未知',
      username: username, // 作者用户名
      ip_location: postData.ip_location || '未知',
      create_time: formatTime(postData.create_at),
      modify_time: formatTime(postData.modify_at)
    };
  }

  /**
   * 渲染HTML为图片
   */
  private async renderHtmlToImage(data: Record<string, any>, linkId: string): Promise<string | null> {
    const page = await browserManager.newPage();

    try {
      // 读取并渲染HTML模板
      const htmlTemplate = readHtmlTemplate(this.templatePath);
      const renderedHtml = renderHtmlTemplate(htmlTemplate, data);

      // 保存临时HTML文件
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempHtmlPath = path.join(tempDir, `xhh_${linkId}_${Date.now()}.html`);
      fs.writeFileSync(tempHtmlPath, renderedHtml, 'utf-8');

      // 设置视口
      await page.setViewport({
        width: 800,
        height: 600,
        deviceScaleFactor: 2
      });

      // 加载HTML
      await page.goto(`file://${tempHtmlPath}`, {
        waitUntil: 'networkidle0', // 等待网络空闲（所有资源加载完成）
        timeout: 30000
      });

      // 等待所有图片加载完成
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll('img'));
        await Promise.all(
          images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
              img.addEventListener('load', resolve);
              img.addEventListener('error', resolve); // 即使加载失败也继续
              // 设置超时，避免无限等待
              setTimeout(resolve, 5000);
            });
          })
        );
      });

      // 额外等待渲染完成（字体、CSS动画等）
      await new Promise(resolve => setTimeout(resolve, 500));

      // 截图
      const filename = `xhh_${linkId}_${Date.now()}.png`;
      const filepath = path.join(this.dataDir, filename) as `${string}.png`;

      await page.screenshot({
        path: filepath,
        fullPage: true,
        type: 'png'
      });

      console.log(`[XhhService] 帖子 ${linkId} 截图已保存: ${filepath}`);

      // 清理临时文件
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }

      return filepath;

    } catch (error) {
      console.error('[XhhService] 渲染HTML截图失败:', error);
      return null;
    } finally {
      await page.close();
    }
  }
}

// 导出单例
export const xhhService = new XhhService();
