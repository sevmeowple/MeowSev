import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { TemplateService } from "@service/TemplateService";
import { MessageObject } from "@/utils/message";
import { ConfigUnion } from "@/config/config";
import { HelpRegistry } from "../utils/HelpRegistry";

// 注册模板相关路由
RouteRegistry.registerBatch([
  'template',
  'template-save',
  'template-gen',
  'template-list'
]);

// 注册帮助信息
HelpRegistry.register({
  command: 'template',
  description: '定型文管理与生成',
  usage: 'template-save [内容] 或 template-gen [ID] [话题]',
  examples: ['template-save 这是一个模板', 'template-list', 'template-gen 1 新的话题'],
  details: '博士，为了提高沟通效率，您可以将常用的文本保存为模板，或者基于现有模板生成新的内容。我会帮您整理好的。'
});

const templateService = new TemplateService(ConfigUnion);

export const templateController = new Elysia()
  // 保存定型文
  .post("/template-save", async ({ body }): Promise<MessageObject> => {
    console.log('Template save endpoint 收到请求:', JSON.stringify(body, null, 2));
    
    if (body && typeof body === 'object' && 'params' in body) {
      const params = body.params as string[];
      
      if (params.length < 1) {
        return {
          type: "text",
          content: "❌ 参数不足，格式：template-save [内容]"
        };
      }
      
      const content = params.join(' ');
      return templateService.saveTemplate(content);
    }
    
    return {
      type: "text",
      content: "❌ 请求格式错误，需要 params 字段"
    };
  })
  
  // 生成模仿文本
  .post("/template-gen", async ({ body }): Promise<MessageObject> => {
    console.log('Template generate endpoint 收到请求:', JSON.stringify(body, null, 2));
    
    if (body && typeof body === 'object' && 'params' in body) {
      const params = body.params as string[];
      
      if (params.length < 2) {
        return {
          type: "text",
          content: "❌ 参数不足，格式：template-generate [模板ID] [新话题]"
        };
      }
      
      const [templateId, ...topicParts] = params;
      const newTopic = topicParts.join(' ');
      
      return await templateService.generateImitativeText(templateId, newTopic);
    }
    
    return {
      type: "text",
      content: "❌ 请求格式错误，需要 params 字段"
    };
  })
  
  // 列出所有定型文（返回图片）
  .post("/template-list", async (): Promise<MessageObject> => {
    console.log('Template list endpoint 收到请求');
    return await templateService.listAllTemplates();
  });