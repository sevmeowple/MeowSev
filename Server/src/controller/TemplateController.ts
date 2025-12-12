import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { TemplateService } from "@service/TemplateService";
import { MessageObject } from "@/utils/message";
import { ConfigUnion } from "@/config/config";

// 注册模板相关路由
RouteRegistry.registerBatch([
  'template',
  'template-save',
  'template-gen',
  'template-list'
]);

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