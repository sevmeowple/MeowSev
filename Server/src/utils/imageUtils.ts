/**
 * 图片处理工具函数
 * 用于下载图片并转换为 base64 格式
 */

/**
 * 解码 URL 中的 HTML 实体（&amp; → &）
 */
function decodeHtmlEntities(url: string): string {
    return url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/**
 * 从 URL 下载图片并转换为 base64 data URL
 * @param imageUrl 图片 URL
 * @returns base64 data URL (data:image/jpeg;base64,xxx)
 */
export async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
        // 处理已经是 base64 的情况
        if (imageUrl.startsWith('data:image')) {
            return imageUrl;
        }

        // 解码 HTML 实体
        imageUrl = decodeHtmlEntities(imageUrl);

        // 处理 file:// 协议
        if (imageUrl.startsWith('file://')) {
            const filePath = imageUrl.replace('file://', '');
            const file = Bun.file(filePath);
            const buffer = await file.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            // 尝试从文件扩展名推断 MIME 类型
            const ext = filePath.split('.').pop()?.toLowerCase() || 'jpg';
            const mimeType = getMimeType(ext);
            return `data:${mimeType};base64,${base64}`;
        }

        // 下载网络图片
        console.log(`📥 下载图片: ${imageUrl}`);
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        console.log(`✅ 图片下载成功，大小: ${(buffer.byteLength / 1024).toFixed(2)} KB`);

        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error('❌ 图片下载/转换失败:', error);
        return null;
    }
}

/**
 * 从文件扩展名获取 MIME 类型
 */
function getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
    };
    return mimeTypes[ext] || 'image/jpeg';
}

/**
 * 从 Koishi 消息元素中提取图片 URL
 * 支持格式:
 * - <img src="xxx">
 * - CQ 码: [CQ:image,file=xxx,url=xxx]
 */
export function extractImageUrlsFromContent(content: string): string[] {
    const urls: string[] = [];

    // 匹配 <img src="xxx"> 格式
    const imgRegex = /<img[^>]+src="([^"]+)"/g;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
        urls.push(match[1]);
    }

    // 匹配 [CQ:image,url=xxx] 格式
    const cqRegex = /\[CQ:image,[^\]]*url=([^,\]]+)/g;
    while ((match = cqRegex.exec(content)) !== null) {
        urls.push(match[1]);
    }

    return urls;
}

/**
 * 从消息元素数组中提取图片 URL
 * Koishi/OneBot 的 message elements 格式
 */
export function extractImageUrlsFromElements(elements: any[]): string[] {
    if (!Array.isArray(elements)) return [];

    const urls: string[] = [];

    for (const elem of elements) {
        if (elem.type === 'img' || elem.type === 'image') {
            // Koishi: { type: 'img', attrs: { src } }  /  OneBot: { type: 'image', data: { url } }
            const src = elem.attrs?.src || elem.attrs?.url || elem.data?.url || elem.data?.file;
            if (src) urls.push(src);
        }
    }

    return urls;
}

/**
 * 检查消息内容是否包含图片
 */
export function hasImageInContent(content: string): boolean {
    return content.includes('<img') || content.includes('[CQ:image');
}

/**
 * 从 quote 消息中提取所有图片 URL
 */
export function extractImagesFromQuote(quote: any): string[] {
    if (!quote) return [];

    const urls: string[] = [];

    // 从 content 中提取
    if (quote.content) {
        urls.push(...extractImageUrlsFromContent(quote.content));
    }

    // 从 elements 数组中提取
    if (quote.elements && Array.isArray(quote.elements)) {
        urls.push(...extractImageUrlsFromElements(quote.elements));
    }

    // 统一解码 HTML 实体后去重
    return [...new Set(urls.map(decodeHtmlEntities))];
}
