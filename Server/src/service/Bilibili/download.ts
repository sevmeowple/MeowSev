import axios from 'axios';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const REFERER = 'https://www.bilibili.com/';

// 下载文件
export async function downloadFile(url: string, dest: string, referer: string = REFERER) {
    console.log(`📥 下载到: ${dest}`);

    const response = await axios({
        method: 'GET',
        url: url,
        headers: {
            'User-Agent': USER_AGENT,
            'Referer': referer,
        },
        responseType: 'stream'
    });

    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);

    return new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// 合并视频和音频
export function mergeVideoAudio(videoPath: string, audioPath: string, outputPath: string) {
    return new Promise<void>((resolve, reject) => {
        console.log(`🔧 合并: ${path.basename(videoPath)} + ${path.basename(audioPath)} -> ${path.basename(outputPath)}`);
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-i', audioPath,
            '-c', 'copy',
            '-y',
            outputPath
        ]);

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg 退出码: ${code}`));
            }
        });

        ffmpeg.stderr.on('data', (data) => {
            // 可以取消注释查看ffmpeg详细输出
            // console.log(data.toString());
        });
    });
}

// 创建目录
export function ensureDirectories(...dirs: string[]) {
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

// 清理临时文件
export function cleanupFiles(...files: string[]) {
    for (const file of files) {
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        } catch (error) {
            console.warn(`⚠️ 清理文件失败: ${file}`, error);
        }
    }
}