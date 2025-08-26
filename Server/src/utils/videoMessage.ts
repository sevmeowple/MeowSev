import { MessageObject } from '@utils/message';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 创建视频消息对象
 * @param videoPath 视频文件路径
 * @param caption 视频说明文字（可选）
 * @returns MessageObject数组
 */
export function createVideoMessage(videoPath: string, caption?: string): MessageObject[] {
    const messages: MessageObject[] = [];
    
    // 添加说明文字
    if (caption) {
        messages.push({
            type: 'text',
            content: caption
        });
    }
    
    // 添加视频消息
    messages.push({
        type: 'video',
        src: videoPath,
        url: videoPath
    });
    
    return messages;
}

/**
 * 创建带视频信息的完整消息
 * @param videoPath 视频文件路径
 * @param title 视频标题
 * @param author UP主
 * @param bvid 视频BVID
 * @param fileSize 文件大小
 * @param quality 清晰度
 * @param format 格式
 * @returns MessageObject数组
 */
export function createDetailedVideoMessage(
    videoPath: string,
    title: string,
    author: string,
    bvid: string,
    fileSize: string,
    quality: number,
    format: string
): MessageObject[] {
    return [
        {
            type: 'text',
            content: `📺 ${title}\n👤 UP主: ${author}\n🆔 BVID: ${bvid}\n📁 大小: ${fileSize}\n🎥 清晰度: ${quality}P\n📼 格式: ${format}`
        },
        {
            type: 'video',
            src: videoPath,
            url: videoPath
        }
    ];
}

/**
 * 验证视频文件是否存在且有效
 * @param videoPath 视频文件路径
 * @returns 验证结果
 */
export function validateVideoFile(videoPath: string): {
    isValid: boolean;
    error?: string;
    size?: number;
} {
    try {
        if (!fs.existsSync(videoPath)) {
            return {
                isValid: false,
                error: '视频文件不存在'
            };
        }

        const stats = fs.statSync(videoPath);
        
        if (!stats.isFile()) {
            return {
                isValid: false,
                error: '路径不是有效文件'
            };
        }

        if (stats.size === 0) {
            return {
                isValid: false,
                error: '视频文件为空'
            };
        }

        // 检查文件扩展名
        const ext = path.extname(videoPath).toLowerCase();
        const supportedFormats = ['.mp4', '.avi', '.mkv', '.mov', '.flv', '.wmv'];
        
        if (!supportedFormats.includes(ext)) {
            return {
                isValid: false,
                error: `不支持的视频格式: ${ext}`
            };
        }

        return {
            isValid: true,
            size: stats.size
        };

    } catch (error) {
        return {
            isValid: false,
            error: `文件验证失败: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * 获取文件的相对路径（用于消息发送）
 * @param absolutePath 绝对路径
 * @param baseDir 基础目录（默认为当前工作目录）
 * @returns 相对路径
 */
export function getRelativePath(absolutePath: string, baseDir?: string): string {
    const base = baseDir || process.cwd();
    return path.relative(base, absolutePath);
}

/**
 * 创建视频文件的URL格式路径（用于网络访问）
 * @param filePath 文件路径
 * @param baseUrl 基础URL
 * @returns URL格式的路径
 */
export function createVideoUrl(filePath: string, baseUrl: string = 'file://'): string {
    if (path.isAbsolute(filePath)) {
        return `${baseUrl}${filePath}`;
    } else {
        return `${baseUrl}${path.resolve(filePath)}`;
    }
}