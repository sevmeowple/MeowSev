// logger.ts
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private logPath: string;
  private logStream: fs.WriteStream;

  constructor(logPath: string) {
    this.logPath = path.resolve(logPath);
    // 确保日志目录存在
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // 创建写入流
    this.logStream = fs.createWriteStream(this.logPath, { flags: 'a' });
  }

  private getTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  private async write(level: string, message: string): Promise<void> {
    const log = `[${this.getTimestamp()}] [${level}] ${message}\n`;
    return new Promise((resolve, reject) => {
      this.logStream.write(log, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async info(message: string): Promise<void> {
    await this.write('INFO', message);
  }

  async error(message: string): Promise<void> {
    await this.write('ERROR', message);
  }

  async warn(message: string): Promise<void> {
    await this.write('WARN', message);
  }

  async debug(message: string): Promise<void> {
    await this.write('DEBUG', message);
  }

  close(): void {
    this.logStream.end();
  }
}