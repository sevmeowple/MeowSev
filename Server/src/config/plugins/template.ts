import fs from 'fs';
import path from 'path';

interface Template {
  id: string;
  content: string;
  createdAt: Date;
}

class TemplateManager {
  private templates: Template[] = [];
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(process.cwd(), 'data', 'templates.json');
    this.loadTemplates();
  }

  private loadTemplates() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        this.templates = JSON.parse(data);
      }
    } catch (error) {
      console.error('加载定型文失败:', error);
    }
  }

  private saveTemplates() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(this.templates, null, 2));
    } catch (error) {
      console.error('保存定型文失败:', error);
    }
  }

  addTemplate(content: string): Template {
    const newTemplate: Template = {
      id: `tpl_${Date.now()}`,
      content,
      createdAt: new Date()
    };
    
    this.templates.push(newTemplate);
    this.saveTemplates();
    return newTemplate;
  }

  getTemplate(id: string): Template | undefined {
    return this.templates.find(t => t.id === id);
  }

  getAllTemplates(): Template[] {
    return [...this.templates].reverse(); // 最新在前
  }
}

let templateManager: TemplateManager | null = null;

export function getTemplateManager(): TemplateManager {
  if (!templateManager) {
    templateManager = new TemplateManager();
  }
  return templateManager;
}