import { M3Log, LogLevel } from "m3log"
import * as fs from 'fs';
import * as path from 'path';

class M3LogWrapper extends M3Log {
    path: string = "/home/sevmeowple/WorkSpace/Happy/MeowSev/server/m3log.log"
    autoSave: boolean = false;
    
    constructor(tags: string[] = [], autoConsole = false, autoSave = false) {
        super(tags, autoConsole);
        this.autoSave = autoSave;
    }

    /**
     * 设置是否自动保存到文件
     */
    setAutoSave(auto: boolean): M3LogWrapper {
        this.autoSave = auto;
        return this;
    }

    /**
     * 设置日志文件路径
     */
    setPath(filePath: string): M3LogWrapper {
        this.path = filePath;
        return this;
    }

    /**
     * 将日志写入文件
     */
    private saveToFile(logEntry: string): void {
        if (!this.autoSave) return;
        
        try {
            // 确保目录存在
            const dirname = path.dirname(this.path);
            if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname, { recursive: true });
            }
            
            // 追加写入日志
            fs.appendFileSync(this.path, logEntry + '\n');
        } catch (error) {
            // 如果写入失败，打印到控制台但不抛出异常
            console.error(`Failed to save log to file: ${error}`);
        }
    }

    // 重写日志方法以支持文件保存
    debug(message: string, tags: string[] = []): string {
        const logEntry = super.debug(message, tags);
        this.saveToFile(logEntry);
        return logEntry;
    }
    
    info(message: string, tags: string[] = []): string {
        const logEntry = super.info(message, tags);
        this.saveToFile(logEntry);
        return logEntry;
    }
    
    warn(message: string, tags: string[] = []): string {
        const logEntry = super.warn(message, tags);
        this.saveToFile(logEntry);
        return logEntry;
    }
    
    error(message: string, tags: string[] = []): string {
        const logEntry = super.error(message, tags);
        this.saveToFile(logEntry);
        return logEntry;
    }
    
    fatal(message: string, tags: string[] = []): string {
        const logEntry = super.fatal(message, tags);
        this.saveToFile(logEntry);
        return logEntry;
    }
    
    raw(message: string, tags: string[] = []): string {
        const logEntry = super.raw(message, tags);
        this.saveToFile(logEntry);
        return logEntry;
    }
}

// 导出默认实例
export default new M3LogWrapper();

// 也导出类，便于创建新实例
export { M3LogWrapper };