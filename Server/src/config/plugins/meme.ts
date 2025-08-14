import { z } from "zod";
import { Meme, MemeCollection } from "@/utils/meme";
import fs from "fs";
import path from "path";
import TOML from "smol-toml";

export const MemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  filePath: z.string(),
  keywords: z.array(z.string()).optional(),
  category: z.string().optional()
});

export const MemeCollectionSchema = z.object({
  memes: z.array(MemeSchema)
});

export class MemeManager {
  private configPath: string;
  private memes: Map<string, Meme> = new Map();
  private keywords: Map<string, string[]> = new Map();
  private categories: Map<string, string[]> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'memes.toml');
    this.loadFromFile();
  }

  // 读取配置文件
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const tomlContent = fs.readFileSync(this.configPath, 'utf-8');
        const parsedData = TOML.parse(tomlContent);
        const collection = MemeCollectionSchema.parse(parsedData);
        this.loadMemes(collection.memes);
      }
    } catch (error) {
      console.warn('Failed to load meme config:', error);
      this.memes.clear();
      this.keywords.clear();
      this.categories.clear();
    }
  }

  // 保存到配置文件
  private saveToFile(): void {
    const collection: MemeCollection = {
      memes: Array.from(this.memes.values())
    };
    
    const tomlContent = TOML.stringify(collection);
    fs.writeFileSync(this.configPath, tomlContent, 'utf-8');
  }

  // 加载 memes 到内存
  private loadMemes(memes: Meme[]): void {
    this.memes.clear();
    this.keywords.clear();
    this.categories.clear();

    for (const meme of memes) {
      this.memes.set(meme.id, meme);
      this.buildIndexes(meme);
    }
  }

  // 构建索引
  private buildIndexes(meme: Meme): void {
    // 关键词索引
    if (meme.keywords) {
      for (const keyword of meme.keywords) {
        if (!this.keywords.has(keyword)) {
          this.keywords.set(keyword, []);
        }
        this.keywords.get(keyword)!.push(meme.id);
      }
    }

    // 分类索引
    if (meme.category) {
      if (!this.categories.has(meme.category)) {
        this.categories.set(meme.category, []);
      }
      this.categories.get(meme.category)!.push(meme.id);
    }
  }

  // 移除索引
  private removeIndexes(meme: Meme): void {
    // 移除关键词索引
    if (meme.keywords) {
      for (const keyword of meme.keywords) {
        const ids = this.keywords.get(keyword);
        if (ids) {
          const index = ids.indexOf(meme.id);
          if (index > -1) {
            ids.splice(index, 1);
          }
          if (ids.length === 0) {
            this.keywords.delete(keyword);
          }
        }
      }
    }

    // 移除分类索引
    if (meme.category) {
      const ids = this.categories.get(meme.category);
      if (ids) {
        const index = ids.indexOf(meme.id);
        if (index > -1) {
          ids.splice(index, 1);
        }
        if (ids.length === 0) {
          this.categories.delete(meme.category);
        }
      }
    }
  }

  // ========== CRUD 操作 ==========

  // 添加 meme
  add(meme: Meme): boolean {
    if (this.memes.has(meme.id)) {
      return false; // ID 已存在
    }

    this.memes.set(meme.id, meme);
    this.buildIndexes(meme);
    this.saveToFile();
    return true;
  }

  // 删除 meme
  delete(id: string): boolean {
    const meme = this.memes.get(id);
    if (!meme) {
      return false; // 不存在
    }

    this.removeIndexes(meme);
    this.memes.delete(id);
    this.saveToFile();
    return true;
  }

  // 更新 meme
  update(id: string, updatedMeme: Partial<Omit<Meme, 'id'>>): boolean {
    const existingMeme = this.memes.get(id);
    if (!existingMeme) {
      return false; // 不存在
    }

    // 移除旧索引
    this.removeIndexes(existingMeme);

    // 更新数据
    const newMeme: Meme = {
      ...existingMeme,
      ...updatedMeme,
      id // 保持 ID 不变
    };

    this.memes.set(id, newMeme);
    this.buildIndexes(newMeme);
    this.saveToFile();
    return true;
  }

  // ========== 查询操作 ==========

  // 根据 ID 获取
  getById(id: string): Meme | undefined {
    return this.memes.get(id);
  }

  // 获取所有 memes
  getAll(): Meme[] {
    return Array.from(this.memes.values());
  }

  // 根据关键词搜索
  searchByKeyword(keyword: string): Meme[] {
    const memeIds = this.keywords.get(keyword) || [];
    return memeIds.map(id => this.memes.get(id)!).filter(Boolean);
  }

  // 根据分类获取
  getByCategory(category: string): Meme[] {
    const memeIds = this.categories.get(category) || [];
    return memeIds.map(id => this.memes.get(id)!).filter(Boolean);
  }

  // 模糊搜索
  search(query: string): Meme[] {
    const results: Meme[] = [];
    const queryLower = query.toLowerCase();

    for (const meme of this.memes.values()) {
      if (
        meme.name.toLowerCase().includes(queryLower) ||
        meme.description.toLowerCase().includes(queryLower) ||
        meme.keywords?.some(keyword => 
          keyword.toLowerCase().includes(queryLower)
        )
      ) {
        results.push(meme);
      }
    }

    return results;
  }

  // 获取随机 meme
  getRandom(category?: string): Meme | undefined {
    let memes: Meme[];
    
    if (category) {
      memes = this.getByCategory(category);
    } else {
      memes = this.getAll();
    }
    
    if (memes.length === 0) return undefined;
    return memes[Math.floor(Math.random() * memes.length)];
  }

  // ========== 统计信息 ==========

  // 获取所有分类
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  // 获取所有关键词
  getKeywords(): string[] {
    return Array.from(this.keywords.keys());
  }

  // 获取统计信息
  getStats(): {
    totalMemes: number;
    totalCategories: number;
    totalKeywords: number;
    categoriesWithCount: Array<{ category: string; count: number }>;
  } {
    return {
      totalMemes: this.memes.size,
      totalCategories: this.categories.size,
      totalKeywords: this.keywords.size,
      categoriesWithCount: Array.from(this.categories.entries()).map(
        ([category, ids]) => ({ category, count: ids.length })
      )
    };
  }

  // ========== 批量操作 ==========

  // 批量添加
  addBatch(memes: Meme[]): { success: string[]; failed: string[] } {
    const success: string[] = [];
    const failed: string[] = [];

    for (const meme of memes) {
      if (this.add(meme)) {
        success.push(meme.id);
      } else {
        failed.push(meme.id);
      }
    }

    return { success, failed };
  }

  // 批量删除
  deleteBatch(ids: string[]): { success: string[]; failed: string[] } {
    const success: string[] = [];
    const failed: string[] = [];

    for (const id of ids) {
      if (this.delete(id)) {
        success.push(id);
      } else {
        failed.push(id);
      }
    }

    return { success, failed };
  }

  // 重新加载配置
  reload(): void {
    this.loadFromFile();
  }

  // 验证配置文件
  validate(): { valid: boolean; errors: string[] } {
    try {
      const tomlContent = fs.readFileSync(this.configPath, 'utf-8');
      const parsedData = TOML.parse(tomlContent);
      MemeCollectionSchema.parse(parsedData);
      return { valid: true, errors: [] };
    } catch (error) {
      return { 
        valid: false, 
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
}

// 单例实例 - 延迟初始化
let memeManagerInstance: MemeManager | null = null;

export function getMemeManager(configPath?: string): MemeManager {
  if (!memeManagerInstance) {
    memeManagerInstance = new MemeManager(configPath);
  }
  return memeManagerInstance;
}

export function createMemeManager(configPath?: string): MemeManager {
  return new MemeManager(configPath);
}

// 重置单例（用于配置更新）
export function resetMemeManager(): void {
  memeManagerInstance = null;
}