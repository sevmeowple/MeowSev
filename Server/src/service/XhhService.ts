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

interface XhhLinkData {
  linkid: string;
  title: string;
  content: string;
  click: number;
  comment_num: number;
  link_award_num: number;
  favour_count: number;
  userid: string;
  ip_location: string;
  create_time: string;
  modify_time: string;
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
   * 从帖子数据中提取图片URL列表
   */
  private extractImageUrls(postData: XhhLinkData): string[] {
    const imageUrls: string[] = [];
    
    // 从 imgs 字段提取（可能是数组或对象数组）
    if (postData.imgs && Array.isArray(postData.imgs)) {
      for (const img of postData.imgs) {
        if (typeof img === 'string') {
          imageUrls.push(img);
        } else if (img && typeof img === 'object') {
          // 可能是 { src: '', url: '' } 格式
          const url = img.src || img.url || img.img_src || img.original_url;
          if (url) imageUrls.push(url);
        }
      }
    }
    
    // 从 content_imgs 字段提取
    if (postData.content_imgs && Array.isArray(postData.content_imgs)) {
      for (const img of postData.content_imgs) {
        if (typeof img === 'string') {
          imageUrls.push(img);
        } else if (img && typeof img === 'object') {
          const url = img.src || img.url || img.img_src || img.original_url;
          if (url) imageUrls.push(url);
        }
      }
    }
    
    // 从 link_imgs 提取
    if (postData.link_imgs && Array.isArray(postData.link_imgs)) {
       for (const img of postData.link_imgs) {
        if (typeof img === 'string') {
          imageUrls.push(img);
        } else if (img && typeof img === 'object') {
          const url = img.src || img.url || img.img_src || img.original_url;
          if (url) imageUrls.push(url);
        }
      }
    }
    
    // 去重
    return [...new Set(imageUrls)];
  }

  /**
   * 准备模板数据（包含下载图片）
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

    // 提取并下载图片
    const imageUrls = this.extractImageUrls(postData);
    console.log(`[XhhService] 发现 ${imageUrls.length} 张图片，开始下载...`);
    
    const imageBase64List = await downloadImagesToBase64(imageUrls);
    console.log(`[XhhService] 成功下载 ${imageBase64List.length} 张图片`);
    
    // 生成图片HTML
    let imagesHtml = '';
    if (imageBase64List.length > 0) {
      imagesHtml = '<div class="image-gallery">';
      for (const base64 of imageBase64List) {
        imagesHtml += `<div class="image-item"><img src="${base64}" /></div>`;
      }
      imagesHtml += '</div>';
    }

    return {
      linkid: postData.linkid || '',
      title: postData.title || '无标题',
      content: postData.description || postData.content || '',
      images_html: imagesHtml,
      click: postData.click || 0,
      comment_num: postData.comment_num || 0,
      link_award_num: postData.link_award_num || 0,
      favour_count: postData.favour_count || 0,
      userid: postData.userid || '未知',
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
