import { CQCodeDetector, CQCodeHandler, CQCodeMatch, CQCodeProcessor } from '../type';
import { AIService } from '../../AIService';
import { ConfigUnionType } from '../../../config/config';
import { sendSessionMessage } from '../../../utils/message';

class XiaohongshuDetector implements CQCodeDetector {
    canHandle(rawMessage: string): boolean {
        // 更严格的小红书检测条件
        const hasJsonTag = rawMessage.includes('[CQ:json');
        const hasLuaApp = rawMessage.includes('"app":"com.tencent.tuwen.lua"');
        // 支持多种小红书URL格式
        const hasXhsUrl = rawMessage.includes('xiaohongshu.com') || 
                         rawMessage.includes('xhslink.com') ||
                         rawMessage.includes('xhs.cn');
        const hasXhsTag = rawMessage.includes('"tag":"小红书"');

        console.log('🔍 小红书检测:', {
            hasJsonTag,
            hasLuaApp,
            hasXhsUrl,
            hasXhsTag,
            canHandle: hasJsonTag && hasLuaApp && hasXhsUrl && hasXhsTag
        });

        return hasJsonTag && hasLuaApp && hasXhsUrl && hasXhsTag;
    }

    detect(rawMessage: string): CQCodeMatch[] {
        const matches: CQCodeMatch[] = [];
        const regex = /\[CQ:json,data=({.*?"app":"com\.tencent\.tuwen\.lua".*?})\]/g;

        let match;
        while ((match = regex.exec(rawMessage)) !== null) {
            try {
                const jsonData = JSON.parse(match[1].replace(/&#44;/g, ',').replace(/&#91;/g, '[').replace(/&#93;/g, ']'));

                // 验证是否确实是小红书分享 - 支持多种URL格式
                const jumpUrl = jsonData.meta?.news?.jumpUrl || '';
                const isXhsUrl = jumpUrl.includes('xiaohongshu.com') || 
                               jumpUrl.includes('xhslink.com') || 
                               jumpUrl.includes('xhs.cn');
                
                if (isXhsUrl && jsonData.meta?.news?.tag === '小红书') {
                    matches.push({
                        type: 'xiaohongshu',
                        raw: match[0],
                        data: jsonData
                    });
                    console.log('✅ 确认小红书分享:', jsonData.meta.news.title);
                } else {
                    console.log('❌ 不是小红书分享，跳过');
                }
            } catch (error) {
                console.error('❌ 解析小红书数据失败:', error);
            }
        }

        return matches;
    }
}

class XiaohongshuHandler implements CQCodeHandler {
    private aiService: AIService;

    constructor(configUnion: ConfigUnionType) {
        this.aiService = new AIService(configUnion);
    }

    async handle(match: CQCodeMatch, sessionData: any): Promise<void> {
        const { data } = match;

        if (data.meta?.news) {
            const { title, desc, jumpUrl, preview, tag } = data.meta.news;

            console.log('🔍 处理小红书分享:', {
                title,
                desc: desc?.substring(0, 50) + '...',
                jumpUrl,
                tag
            });

            // 解析短链获取真实内容
            if (jumpUrl) {
                try {
                    const realUrl = await this.resolveShortUrl(jumpUrl);
                    if (realUrl) {
                        console.log('🔗 获取到真实URL:', realUrl);
                        const contentInfo = await this.extractXhsContent(realUrl);
                        console.log('📝 小红书内容解析结果:', contentInfo);

                        // 只有成功解析到内容才生成AI回复
                        if (contentInfo && !contentInfo.error && (contentInfo.title || contentInfo.content)) {
                            await this.generateAIReply(contentInfo, sessionData);
                        } else {
                            console.log('⚠️ 内容解析失败或内容为空，不生成AI回复');
                        }
                    } else {
                        console.log('❌ 无法解析短链，不生成AI回复');
                    }
                } catch (error) {
                    console.error('❌ 处理小红书链接失败:', error);
                }
            } else {
                console.log('❌ 没有jumpUrl，不处理');
            }
        }
    }

    // 新增：生成AI回复
    private async generateAIReply(contentInfo: any, sessionData: any): Promise<void> {
        try {
            // 构建AI提示词
            const aiPrompt = this.buildAIPrompt(contentInfo);

            console.log('🤖 正在生成AI回复...');

            // 调用AI服务生成回复
            const reply = await this.aiService.generateText(
                aiPrompt,
                `你是一个幽默风趣的评论家。请对小红书内容进行概述和评论：
                1. 首先简洁概述帖子内容要点
                2. 然后给出一些辛辣有趣的评论
                3. 语言风格要幽默，适当使用颜文字如 (¬‿¬) (╯°□°）╯ (｡◕‿◕｡) 等
                4. 回复要简短精炼，不要超过100字
                5. 保持友善但犀利的态度`
            );

            // 发送AI生成的回复
            await sendSessionMessage(sessionData, reply);

            console.log('✅ AI回复已发送:', reply);

        } catch (error) {
            console.error('❌ 生成AI回复失败:', error);
        }
    }

    // 构建AI提示词
    private buildAIPrompt(contentInfo: any): string {
        let prompt = "请对以下小红书内容进行概述和评论：\n\n";

        if (contentInfo.title) {
            prompt += `标题：${contentInfo.title}\n`;
        }

        if (contentInfo.content) {
            prompt += `内容：${contentInfo.content}\n`;
        }

        if (contentInfo.author) {
            prompt += `作者：${contentInfo.author}\n`;
        }

        if (contentInfo.keywords && contentInfo.keywords.length > 0) {
            prompt += `标签：${contentInfo.keywords.join(', ')}\n`;
        }

        prompt += "\n请先概述内容要点，然后给出你的辛辣评论。";

        return prompt;
    }

    // 解析短链，获取真实链接
    private async resolveShortUrl(shortUrl: string): Promise<string | null> {
        try {
            console.log('🔄 开始解析短链:', shortUrl);

            const response = await fetch(shortUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
                },
                redirect: 'manual' // 不自动跟随重定向
            });

            console.log('📡 短链请求响应:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });

            // 从响应头中获取重定向地址
            const location = response.headers.get('location');
            if (location) {
                console.log('🔗 从响应头获取重定向链接:', location);
                return location;
            }

            // 如果没有重定向头，尝试解析响应体中的链接
            const html = await response.text();
            console.log('📄 响应体长度:', html.length);

            const linkMatch = html.match(/href="([^"]+xiaohongshu\.com[^"]+)"/);
            if (linkMatch) {
                const decodedUrl = linkMatch[1]
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>');
                console.log('🔗 从HTML解析链接:', decodedUrl);
                return decodedUrl;
            }

            console.warn('⚠️ 未找到重定向链接');
            return null;
        } catch (error) {
            console.error('❌ 解析短链失败:', error);
            return null;
        }
    }



// 从小红书链接中提取内容信息
private async extractXhsContent(xhsUrl: string): Promise<any> {
    try {
        console.log('🔍 开始提取小红书内容:', xhsUrl);

        // 检查是否是重定向到404页面的URL
        let actualUrl = xhsUrl;
        if (xhsUrl.includes('/404/') && xhsUrl.includes('originalUrl=')) {
            const urlParams = new URLSearchParams(xhsUrl.split('?')[1]);
            const originalUrl = urlParams.get('originalUrl');
            if (originalUrl) {
                actualUrl = decodeURIComponent(originalUrl);
                console.log('🔄 从404页面提取原始URL:', actualUrl);
            }
        }

        // 尝试多种笔记ID提取方式
        let noteId = null;

        // 方式1: /item/笔记ID 格式
        let noteIdMatch = actualUrl.match(/\/item\/([a-f0-9]+)/);
        if (noteIdMatch) {
            noteId = noteIdMatch[1];
            console.log('📋 从/item/路径提取笔记ID:', noteId);
        } else {
            // 方式2: /discovery/item/笔记ID 格式
            noteIdMatch = actualUrl.match(/\/discovery\/item\/([a-f0-9]+)/);
            if (noteIdMatch) {
                noteId = noteIdMatch[1];
                console.log('📋 从/discovery/item/路径提取笔记ID:', noteId);
            } else {
                // 方式3: 从URL参数中提取
                try {
                    const urlObj = new URL(actualUrl);
                    const pathSegments = urlObj.pathname.split('/');
                    for (const segment of pathSegments) {
                        if (/^[a-f0-9]{24}$/.test(segment)) {
                            noteId = segment;
                            console.log('📋 从路径段提取笔记ID:', noteId);
                            break;
                        }
                    }
                } catch (urlError) {
                    console.warn('URL解析失败:', urlError.message);
                }

                if (!noteId) {
                    console.error('❌ 无法从URL提取笔记ID');
                    console.error('❌ 实际URL:', actualUrl);
                    console.error('❌ 原始URL:', xhsUrl);
                    throw new Error('无法从URL提取笔记ID');
                }
            }
        }

        // 构建explore URL（根据你的测试代码）
        const exploreUrl = actualUrl.replace('/discovery/item/', '/explore/');
        console.log('🔄 转换为explore URL:', exploreUrl);

        // 由于小红书有反爬虫机制，我们尝试不同的策略
        console.log('🌐 尝试请求小红书页面...');

        // 策略1: 尝试请求explore URL
        let response = await this.fetchXhsPage(exploreUrl);

        // 如果explore URL失败，尝试原始URL
        if (!response || !response.ok) {
            console.log('⚠️ explore URL请求失败，尝试原始URL...');
            response = await this.fetchXhsPage(actualUrl);
        }

        // 最后尝试重定向URL
        if (!response || !response.ok) {
            console.log('⚠️ 原始URL请求失败，尝试重定向URL...');
            response = await this.fetchXhsPage(xhsUrl);
        }

        if (!response || !response.ok) {
            throw new Error(`无法访问小红书页面，状态码: ${response?.status || 'unknown'}`);
        }

        const html = await response.text();
        console.log('📄 页面HTML长度:', html.length);

        // 尝试从页面中提取内容信息
        const contentInfo = this.parseXhsHtml(html, noteId);

        return {
            noteId,
            url: actualUrl,
            originalUrl: xhsUrl,
            ...contentInfo
        };
    } catch (error) {
        console.error('❌ 提取小红书内容失败:', {
            error: error.message,
            url: xhsUrl,
            stack: error.stack
        });
        return {
            noteId: null,
            url: xhsUrl,
            error: error.message
        };
    }
}

// 新增：专门的小红书页面请求方法
private async fetchXhsPage(url: string): Promise<Response | null> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh,en-US;q=0.7,en;q=0.3',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Sec-GPC': '1',
                'Priority': 'u=0, i',
                'Cache-Control': 'max-age=0'
            },
            credentials: 'include' as RequestCredentials,
            mode: 'cors' as RequestMode,
            redirect: 'follow'
        });

        console.log('📡 小红书页面响应:', {
            status: response.status,
            statusText: response.statusText,
            url: response.url
        });

        return response;
    } catch (error) {
        console.error('❌ 请求小红书页面失败:', error);
        return null;
    }
}
    // 解析小红书HTML页面 - 增强处理404页面
    private parseXhsHtml(html: string, noteId: string): any {
        try {
            console.log('🔍 开始解析HTML页面...');

            // 检查是否是404页面
            if (html.includes('404') && html.length < 2000) {
                console.log('⚠️ 检测到404页面，尝试提取基本信息');
                return {
                    title: '内容已失效或无法访问',
                    content: '小红书内容可能已被删除或设置为私密',
                    author: '',
                    keywords: [],
                    previewImage: '',
                    parsedAt: new Date().toISOString(),
                    is404: true
                };
            }

            // 尝试提取页面标题
            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            const title = titleMatch ? titleMatch[1].replace(/ - 小红书$/, '') : '';
            console.log('📝 提取到标题:', title || '无标题');

            // 从meta description中提取完整正文内容
            const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
            let content = '';
            if (descMatch) {
                // 解码HTML实体
                content = descMatch[1]
                    .replace(/&gt;/g, '>')
                    .replace(/&lt;/g, '<')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#x27;/g, "'")
                    .replace(/&#39;/g, "'");
                console.log('📝 提取到内容长度:', content.length);
                console.log('📝 内容预览:', content.substring(0, 100) + '...');
            } else {
                console.log('⚠️ 未找到meta description');
            }

            // 提取关键词作为标签
            const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)"/);
            const keywords = keywordsMatch ? keywordsMatch[1].split(', ') : [];
            console.log('🏷️ 提取到关键词:', keywords.length, '个');

            // 尝试提取作者信息
            let author = '';
            const stateMatch = html.match(/window\.__INITIAL_STATE__=({.*?});/);
            if (stateMatch) {
                try {
                    const stateData = JSON.parse(stateMatch[1]);
                    const noteData = stateData?.note?.noteDetailMap?.[noteId]?.note;
                    if (noteData?.user?.nickname) {
                        author = noteData.user.nickname;
                        console.log('👤 从JSON提取到作者:', author);
                    }
                } catch (e) {
                    console.warn('解析JSON状态数据失败:', e.message);
                }
            }

            // 如果从JSON中没获取到作者，尝试从其他地方提取
            if (!author) {
                const authorMatch = html.match(/"username"[^>]*>([^<]+)</) ||
                    html.match(/"nickname":"([^"]+)"/);
                author = authorMatch ? authorMatch[1] : '';
                if (author) {
                    console.log('👤 从HTML提取到作者:', author);
                }
            }

            // 尝试提取预览图
            const preloadMatch = html.match(/<link rel="preload" as="image" href="([^"]+)"/);
            const previewImage = preloadMatch ? preloadMatch[1] : '';
            console.log('🖼️ 提取到预览图:', !!previewImage);

            const result = {
                title,
                content,
                author,
                keywords,
                previewImage,
                parsedAt: new Date().toISOString()
            };

            console.log('📄 小红书页面解析完成:', {
                hasTitle: !!title,
                contentLength: content.length,
                hasAuthor: !!author,
                keywordsCount: keywords.length,
                hasPreviewImage: !!previewImage
            });

            return result;
        } catch (error) {
            console.error('❌ 解析HTML失败:', {
                error: error.message,
                noteId,
                stack: error.stack
            });
            return {
                error: '页面解析失败: ' + error.message,
                parsedAt: new Date().toISOString()
            };
        }
    }
}

// 修改导出函数，需要传入config
export function createXiaohongshuProcessor(configUnion: ConfigUnionType): CQCodeProcessor {
    return {
        detector: new XiaohongshuDetector(),
        handler: new XiaohongshuHandler(configUnion),
        name: 'Xiaohongshu'
    };
}