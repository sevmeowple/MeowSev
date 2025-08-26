import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CompressOptions {
  maxSizeMB?: number;
  quality?: string;
  resolution?: string;
}

export class VideoCompressor {
  private static readonly DEFAULT_MAX_SIZE = 95; // MB
  private static readonly DEFAULT_QUALITY = '23'; // CRF值，越小质量越高
  private static readonly DEFAULT_RESOLUTION = '720x1280';

  /**
   * 压缩视频文件
   * @param inputPath 输入文件路径
   * @param outputPath 输出文件路径
   * @param options 压缩选项
   * @returns 压缩后的文件路径
   */
  static async compressVideo(
    inputPath: string,
    outputPath?: string,
    options: CompressOptions = {}
  ): Promise<string> {
    const {
      maxSizeMB = this.DEFAULT_MAX_SIZE,
      quality = this.DEFAULT_QUALITY,
      resolution = this.DEFAULT_RESOLUTION
    } = options;

    if (!outputPath) {
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const name = path.basename(inputPath, ext);
      outputPath = path.join(dir, `${name}_compressed${ext}`);
    }

    try {
      // 检查文件大小
      const fileStats = fs.statSync(inputPath);
      const fileSizeMB = fileStats.size / (1024 * 1024);

      if (fileSizeMB <= maxSizeMB) {
        console.log(`📏 文件大小 ${fileSizeMB.toFixed(1)}MB 已符合要求，无需压缩`);
        return inputPath;
      }

      console.log(`🗜️ 开始压缩视频: ${inputPath} (${fileSizeMB.toFixed(1)}MB → ${maxSizeMB}MB)`);

      // 构建FFmpeg命令
      const crf = this.calculateCRF(fileSizeMB, maxSizeMB, parseInt(quality));
      const command = this.buildFFmpegCommand(inputPath, outputPath, crf, resolution);

      console.log(`🔧 执行命令: ${command}`);
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && stderr.includes('error')) {
        throw new Error(`FFmpeg错误: ${stderr}`);
      }

      // 验证输出文件
      if (!fs.existsSync(outputPath)) {
        throw new Error('压缩后的文件未生成');
      }

      const outputStats = fs.statSync(outputPath);
      const outputSizeMB = outputStats.size / (1024 * 1024);
      
      console.log(`✅ 压缩完成: ${outputSizeMB.toFixed(1)}MB (${((outputSizeMB/fileSizeMB)*100).toFixed(1)}%)`);

      // 如果压缩后仍过大，尝试更激进的压缩
      if (outputSizeMB > maxSizeMB) {
        console.log(`⚠️ 压缩后仍过大，尝试更激进压缩`);
        return await this.compressVideo(inputPath, outputPath, {
          ...options,
          quality: (parseInt(quality) + 5).toString() // 降低质量
        });
      }

      return outputPath;

    } catch (error) {
      console.error('❌ 视频压缩失败:', error);
      throw error;
    }
  }

  /**
   * 计算合适的CRF值
   */
  private static calculateCRF(originalSizeMB: number, targetSizeMB: number, baseCRF: number): number {
    const ratio = targetSizeMB / originalSizeMB;
    const crfAdjustment = Math.round(-10 * Math.log2(ratio));
    return Math.max(18, Math.min(35, baseCRF + crfAdjustment));
  }

  /**
   * 构建FFmpeg命令
   */
  private static buildFFmpegCommand(
    inputPath: string,
    outputPath: string,
    crf: number,
    resolution: string
  ): string {
    const filters = [
      `scale=${resolution}`,
      'format=yuv420p'
    ];

    return [
      'ffmpeg',
      '-i', `"${inputPath}"`,
      '-c:v', 'libx264',
      '-crf', crf.toString(),
      '-preset', 'ultrafast',  // 改为最快预设
      '-c:a', 'aac',
      '-b:a', '96k',           // 降低音频码率
      '-vf', filters.join(','),
      '-movflags', '+faststart',
      '-threads', '0',         // 使用所有CPU核心
      '-y',
      `"${outputPath}"`
    ].join(' ');
  }

  /**
   * 检查FFmpeg是否可用
   */
  static async checkFFmpegAvailable(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch {
      console.error('❌ FFmpeg未安装或不可用');
      return false;
    }
  }

  /**
   * 获取文件大小（MB）
   */
  static getFileSizeMB(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size / (1024 * 1024);
    } catch {
      return 0;
    }
  }
}
 