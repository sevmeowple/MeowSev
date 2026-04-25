import { generateText, tool, stepCountIs, wrapLanguageModel } from "ai";
import type { ToolDefinition, ToolResult } from "@/config/AI";
import type { AIClientSDK } from "@/config/AI";
import { getToolsByNames } from "@/config/AI/plugins/toolRegistry";
import { kimiReasoningMiddleware } from "@/config/AI/plugins/reasoningMiddleware";
import { sendToGroup } from "@/utils/message";
import type { MessageObject } from "@/utils/message";
import { profileService } from "@/service/Profile/instance";
import type {
    AgentConfig,
    AgentRunParams,
    AgentStepReport,
    AgentRunResult,
} from "./types";

export class AgentEngine {
    private aiClient: AIClientSDK;

    constructor(aiClient: AIClientSDK) {
        this.aiClient = aiClient;
    }

    async run(config: AgentConfig, params: AgentRunParams): Promise<AgentRunResult> {
        const steps: AgentStepReport[] = [];
        const allUserMessages: MessageObject[] = [];
        const groupId = params.groupId || config.reportGroupId;

        // 获取白名单工具
        const toolDefs = getToolsByNames(config.tools);
        const wrappedTools = this.wrapTools(toolDefs, allUserMessages, groupId);

        try {
            // W4: 注入用户画像到 Agent 的 system prompt
            let enrichedSystemPrompt = config.systemPrompt;
            if (params.userId && profileService) {
                try {
                    const identity = await profileService.getUserIdentity(params.userId);
                    if (identity) {
                        const recent = await profileService.getUserRecentContext(params.userId, 7);
                        enrichedSystemPrompt = `
【用户档案】
- 用户：${identity.name}
- 认识时长：${identity.knownSince}
- 标签：${identity.tags.join("、") || "暂无"}
- 近期动态：${recent}

${config.systemPrompt}`;
                    }
                } catch (e) {
                    console.warn("[AgentEngine] 用户画像注入失败:", e);
                }
            }

            const wrappedModel = wrapLanguageModel({
                model: this.aiClient.getModel(),
                middleware: kimiReasoningMiddleware,
            });

            const result = await generateText({
                model: wrappedModel,
                system: enrichedSystemPrompt,
                prompt: params.task,
                tools: wrappedTools,
                temperature: this.aiClient.getTemperature(),
                stopWhen: stepCountIs(config.maxSteps),
                onStepFinish: async (step) => {
                    const report = this.buildStepReport(steps.length, step);
                    steps.push(report);
                    // 条件性群聊汇报
                    if (config.reportToGroup && groupId) {
                        await this.reportStep(config.name, report, groupId);
                    }
                },
            });

            return {
                success: true,
                agentName: config.name,
                finalText: result.text,
                steps,
                messages: this.buildFinalMessages(result.text, allUserMessages),
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Agent [${config.name}] 执行失败:`, errMsg);
            return {
                success: false,
                agentName: config.name,
                finalText: '',
                steps,
                messages: [{ type: 'text', content: `❌ Agent [${config.name}] 执行失败: ${errMsg}` }],
                error: errMsg,
            };
        }
    }

    private wrapTools(
        toolDefs: ToolDefinition[],
        allUserMessages: MessageObject[],
        groupId?: string,
    ): Record<string, any> {
        const chronicleTools = new Set(['chronicleSearch', 'chronicleUserHistory', 'chronicleUserSearch']);
        const wrapped: Record<string, any> = {};
        for (const def of toolDefs) {
            wrapped[def.name] = tool({
                description: def.description,
                inputSchema: def.inputSchema,
                execute: async (params: any) => {
                    // chronicle 工具强制绑定当前群 groupId，禁止跨群搜索
                    if (chronicleTools.has(def.name) && groupId) {
                        params.groupId = groupId;
                    }
                    console.log(`🤖 Agent 执行工具: ${def.name}`, params);
                    try {
                        const result: ToolResult = await def.execute(params);
                        if (result.success && result.userMessages) {
                            allUserMessages.push(...result.userMessages);
                        }
                        return result.aiResponse;
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        console.error(`⚠️ 工具 ${def.name} 执行失败:`, msg);
                        return `工具执行失败: ${msg}`;
                    }
                },
            });
        }
        return wrapped;
    }

    private buildStepReport(index: number, step: any): AgentStepReport {
        return {
            stepIndex: index,
            text: step.text || '',
            toolCalls: (step.toolCalls || []).map((tc: any) => ({
                toolName: tc.toolName,
                args: tc.args,
            })),
            toolResults: (step.toolResults || []).map((tr: any) => ({
                toolName: tr.toolName,
                result: typeof tr.output === 'string'
                    ? tr.output
                    : JSON.stringify(tr.output),
            })),
            finishReason: step.finishReason || 'unknown',
        };
    }

    private async reportStep(
        agentName: string,
        report: AgentStepReport,
        groupId: string,
    ): Promise<void> {
        const toolNames = report.toolCalls
            .map(tc => tc.toolName)
            .join(', ');
        const summary = report.text
            ? report.text.slice(0, 100)
            : '(工具调用中)';
        const msg = [
            `🤖 [${agentName}] 步骤 ${report.stepIndex + 1}`,
            toolNames ? `🔧 调用工具: ${toolNames}` : '',
            `💬 ${summary}`,
        ].filter(Boolean).join('\n');

        try {
            await sendToGroup(groupId, msg);
        } catch (err) {
            console.warn('⚠️ Agent 汇报发送失败:', err);
        }
    }

    private buildFinalMessages(
        finalText: string,
        userMessages: MessageObject[],
    ): MessageObject[] {
        const messages: MessageObject[] = [];
        if (finalText.trim()) {
            messages.push({ type: 'text', content: finalText });
        }
        messages.push(...userMessages);
        return messages;
    }
}
