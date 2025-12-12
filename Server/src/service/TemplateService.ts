import { getTemplateManager } from "@config/plugins/template";
import { MessageObject } from "@/utils/message";
import path from "path";
import { htmlToPicTool } from "@/utils/plugin/browser/htmlToPic";
import { ToolResult } from "@/config/AI";
import { AIService } from "@/service/AIService"; // 新增导入
import { ConfigUnionType } from "@/config/config"; // 新增导入

export class TemplateService {
  private aiService: AIService; // 新增私有属性
  
  /**
   * 构造函数，注入 AIService
   * @param configUnion 配置对象
   */
  constructor(configUnion: ConfigUnionType) {
    this.aiService = new AIService(configUnion); // 初始化 AIService
  }
  
  /**
   * 保存定型文
   * @param content 定型文内容
   * @returns 操作结果消息
   */
  saveTemplate(content: string): MessageObject {
    try {
      const templateManager = getTemplateManager();
      const template = templateManager.addTemplate(content);
      
      return {
        type: "text",
        content: `✅ 定型文保存成功！\nID: ${template.id}\n内容: ${template.content}`
      };
    } catch (error) {
      console.error('保存定型文失败:', error);
      return {
        type: "text",
        content: "❌ 保存定型文时出错"
      };
    }
  }

  /**
   * 根据定型文生成模仿文本
   * @param templateId 定型文ID
   * @param newTopic 新话题
   * @returns 生成的模仿文本
   */
  async generateImitativeText(templateId: string, newTopic: string): Promise<MessageObject> {
    try {
      const templateManager = getTemplateManager();
      const template = templateManager.getTemplate(templateId);
      
      if (!template) {
        return {
          type: "text",
          content: `❌ 找不到ID为 ${templateId} 的定型文`
        };
      }
      
      // 使用注入的 AIService 生成模仿文本
      const prompt = `请模仿以下文本的风格和语气，创作一段关于"${newTopic}"的内容：\n\n"${template.content}"`;
      const systemPrompt = "你是一个文本模仿助手，能够根据给定的文本模仿其风格和语气，创作新的内容。";
      
      const imitativeText = await this.aiService.generateText(prompt, systemPrompt);
      
      return {
        type: "text",
        content: `🎭 模仿生成结果：\n${imitativeText}`
      };
    } catch (error) {
      console.error('生成模仿文本失败:', error);
      return {
        type: "text",
        content: "❌ 生成模仿文本时出错"
      };
    }
  }

  /**
   * 列出所有定型文（使用HTML渲染）
   * @returns 包含图片的消息对象
   */
  async listAllTemplates(): Promise<MessageObject> {
    try {
      const templateManager = getTemplateManager();
      const templates = templateManager.getAllTemplates();
      
      if (templates.length === 0) {
        return {
          type: "text",
          content: "📂 当前没有保存任何定型文"
        };
      }
      
      // 准备HTML模板数据
      const templateData = templates.map((t, index) => ({
        id: t.id,
        content: t.content,
        index: index + 1,
        date: new Date(t.createdAt).toLocaleDateString('zh-CN')
      }));
      
      // 使用htmlToPic工具生成图片
      const result = await htmlToPicTool.execute({
        templatePath: path.join(__dirname, '../../public/templates/template_list.html'),
        data: { templates: templateData },
        outputFileName: `template_list_${Date.now()}`,
        width: 800,
        height: 600
      });
      
      if (result.success && result.userMessages) {
        return result.userMessages[0];
      }
      
      return {
        type: "text",
        content: "❌ 生成定型文列表图片失败"
      };
      
    } catch (error) {
      console.error('列出定型文失败:', error);
      return {
        type: "text",
        content: "❌ 获取定型文列表时出错"
      };
    }
  }
}