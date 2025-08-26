import * as path from 'path';
import * as fs from 'fs';
import { fetchPlayUrl } from './api';
import { downloadFile, mergeVideoAudio, ensureDirectories, cleanupFiles } from './download';
import { cleanTitle, formatFileSize } from './utils';
import { VideoCompressor } from './compress';
import type { QualityOption, PlayUrlResponse } from './type';

// 清晰度选项
const QUALITY_OPTIONS: QualityOption[] = [
    { qn: 64, fnval: 0 },   // 720P FLV/MP4
    { qn: 32, fnval: 0 },   // 480P FLV/MP4
    { qn: 16, fnval: 0 },   // 360P FLV/MP4
    { qn: 64, fnval: 16 },  // 720P DASH
    { qn: 32, fnval: 16 },  // 480P DASH
    { qn: 16, fnval: 16 },  // 360P DASH
    { qn: 64, fnval: 4048 }, // 720P DASH高级
    { qn: 32, fnval: 4048 }, // 480P DASH高级
    { qn: 16, fnval: 4048 }, // 360P DASH高级
];

interface VideoDownloadResult {
    success: boolean;
    outputPath?: string;
    fileSize?: string;
    quality?: number;
    format?: string;
    error?: string;
}

// 获取可用的播放地址
async function getAvailablePlayUrl(bvid: string, cid: number): Promise<{ playUrl: PlayUrlResponse, quality: QualityOption }> {
    for (const quality of QUALITY_OPTIONS) {
        try {
            console.log(`🔍 尝试获取播放地址: ${quality.qn}P (fnval=${quality.fnval})`);
            const playUrl = await fetchPlayUrl(bvid, cid, quality);
            
            if (playUrl.code !== 0) {
                continue;
            }

            // 检查是否有可用流
            const hasDash = playUrl.data.dash?.video?.length && playUrl.data.dash?.audio?.length;
            const hasDurl = playUrl.data.durl?.length;
            
            if (hasDash || hasDurl) {
                console.log(`✅ 成功获取播放地址: ${quality.qn}P (${hasDash ? 'DASH' : 'FLV/MP4'})`);
                return { playUrl, quality };
            }
        } catch (error) {
            console.warn(`❌ 获取播放地址失败 (${quality.qn}P):`, error);
        }
    }
    
    throw new Error('没有找到可用的播放地址');
}

// 下载视频
export async function downloadVideo(
    bvid: string, 
    cid: number, 
    title: string,
    outputDir: string = 'downloads'
): Promise<VideoDownloadResult> {
    try {
        const { playUrl, quality } = await getAvailablePlayUrl(bvid, cid);
        const safeTitle = cleanTitle(title);
        
        // 创建必要目录
        const downloadDir = path.resolve(outputDir);
        const tmpDir = path.resolve('tmp');
        ensureDirectories(downloadDir, tmpDir);

        let outputPath: string;
        
        // 处理DASH格式（音视频分离）
        if (playUrl.data.dash?.video?.length && playUrl.data.dash?.audio?.length) {
            const videoInfo = playUrl.data.dash.video[0];
            const audioInfo = playUrl.data.dash.audio[0];
            
            const videoPath = path.join(tmpDir, `${bvid}_video.m4s`);
            const audioPath = path.join(tmpDir, `${bvid}_audio.m4s`);
            outputPath = path.join(downloadDir, `${safeTitle}_${bvid}.mp4`);

            console.log(`📥 下载DASH格式视频...`);
            await downloadFile(videoInfo.baseUrl, videoPath);
            
            console.log(`🔊 下载DASH格式音频...`);
            await downloadFile(audioInfo.baseUrl, audioPath);
            
            console.log(`🔧 合并音视频...`);
            await mergeVideoAudio(videoPath, audioPath, outputPath);
            
            // 清理临时文件
            cleanupFiles(videoPath, audioPath);
        }
        // 处理FLV/MP4格式（单文件）
        else if (playUrl.data.durl?.length) {
            const videoInfo = playUrl.data.durl[0];
            outputPath = path.join(downloadDir, `${safeTitle}_${bvid}.mp4`);
            
            console.log(`📥 下载FLV/MP4格式视频...`);
            await downloadFile(videoInfo.url, outputPath);
        } else {
            throw new Error('没有找到可用的视频流');
        }

        // 检查并压缩视频
        const fileStats = fs.statSync(outputPath);
        const originalSizeMB = fileStats.size / (1024 * 1024);
        
        let finalOutputPath = outputPath;
        let finalFileSize = formatFileSize(fileStats.size);

        // 如果文件大于100MB，进行压缩（可选，默认关闭）
        const ENABLE_COMPRESSION = false; // 用户可配置
        
        if (ENABLE_COMPRESSION && originalSizeMB > 100) {
            try {
                console.log(`🗜️ 检测到文件过大 (${originalSizeMB.toFixed(1)}MB)，开始压缩...`);
                
                // 检查FFmpeg是否可用
                const isFFmpegAvailable = await VideoCompressor.checkFFmpegAvailable();
                if (!isFFmpegAvailable) {
                    console.warn('⚠️ FFmpeg不可用，跳过压缩');
                } else {
                    const compressedPath = await VideoCompressor.compressVideo(
                        outputPath,
                        undefined,
                        { maxSizeMB: 95 }
                    );
                    
                    // 删除原始文件
                    fs.unlinkSync(outputPath);
                    
                    finalOutputPath = compressedPath;
                    const compressedStats = fs.statSync(compressedPath);
                    finalFileSize = formatFileSize(compressedStats.size);
                    
                    console.log(`✅ 压缩完成: ${originalSizeMB.toFixed(1)}MB → ${(compressedStats.size / (1024 * 1024)).toFixed(1)}MB`);
                }
            } catch (error) {
                console.error('❌ 压缩失败，使用原始文件:', error);
                // 压缩失败时使用原始文件
            }
        } else if (originalSizeMB > 100) {
            console.log(`⚠️ 文件过大 (${originalSizeMB.toFixed(1)}MB)，压缩功能已禁用`);
        } else {
            console.log(`📏 文件大小 ${originalSizeMB.toFixed(1)}MB 符合要求`);
        }

        return {
            success: true,
            outputPath: finalOutputPath,
            fileSize: finalFileSize,
            quality: quality.qn,
            format: playUrl.data.dash ? 'DASH' : 'FLV/MP4'
        };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}