import React from 'react';
import path from 'path';
import fs from 'fs/promises';
import { AnnualReportCard } from './AnnualReportCard2025';
import { MessageObject } from '../../utils/message';
import { GMemeberSummaryData, OverallGroupChat } from './type';
import { tsxToPic } from '../../utils/plugin/browser/tsxToPic';

export class ReportRenderService {
  private dataPath: string;
  private outputDir: string;

  constructor() {
    // 数据存储路径: Server/data/2025
    this.dataPath = path.join(process.cwd(), 'data', '2025');
    // 图片输出路径: Server/public/report
    this.outputDir = path.join(process.cwd(), 'public', 'report');
  }

  private async ensureDir(dir: string) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * 检查是否已存在生成的报告
   */
  private async findExistingReport(groupId: string, memberId: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.outputDir);
      // 匹配模式: report_{groupId}_{memberId}_{timestamp}.png
      const prefix = `report_${groupId}_${memberId}_`;
      
      // 查找匹配的文件，如果有多个，返回第一个找到的即可（通常只会有一个，或者可以按时间排序取最新的）
      const match = files.find(file => file.startsWith(prefix) && file.endsWith('.png'));
      
      if (match) {
        return path.join(this.outputDir, match);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 生成指定群成员的年度报告
   * @param groupId 群号
   * @param memberId 成员QQ号
   * @returns MessageObject 包含生成的图片路径
   */
  async generateReport(groupId: string, memberId: string): Promise<MessageObject> {
    try {
      await this.ensureDir(this.outputDir);
      
      // 检查是否已经生成过报告
      const existingReport = await this.findExistingReport(groupId, memberId);
      if (existingReport) {
        return {
          type: 'image',
          src: `file://${existingReport}`,
          content: `📊 2025年度群聊报告`
        };
      }
      
      const jsonPath = path.join(this.dataPath, `${groupId}.json`);
      
      try {
        await fs.access(jsonPath);
      } catch {
        return {
          type: 'text',
          content: `❌ 未找到群 ${groupId} 的年度报告数据`
        };
      }

      const fileContent = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(fileContent);
      
      console.debug(`[Debug] 已读取群 ${groupId} 数据，文件大小: ${fileContent.length} 字节`)

      const overallData: OverallGroupChat = data.overall;
      // 注意：JSON结构中 members 是一个对象，key 是 memberId
      const memberData: GMemeberSummaryData = data.members?.[memberId];

      if (!memberData) {
        return {
          type: 'text',
          content: `❌ 未找到成员 ${memberId} 的年度报告数据`
        };
      }

      // 生成文件名
      const fileName = `report_${groupId}_${memberId}_${Date.now()}.png`;

      console.debug(`[Debug] 开始生成群 ${groupId} 成员 ${memberId} 的报告图片`);

      // 使用 tsxToPic 生成图片
      const filePath = await tsxToPic(
        AnnualReportCard,
        {
          reportData: memberData,
          overallData: overallData
        },
        {
          width: 800,
          height: 1200,
          deviceScaleFactor: 2,
          selector: '#report-container',
          outputDir: this.outputDir,
          outputFileName: fileName
        }
      );
      
      return {
        type: 'image',
        src: `file://${filePath}`,
        content: `📊 2025年度群聊报告`
      };

    } catch (error) {
      console.error('Report generation error:', error);
      return {
        type: 'text',
        content: `❌ 生成报告时出现错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
