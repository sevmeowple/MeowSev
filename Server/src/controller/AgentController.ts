import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { HelpRegistry } from "../utils/HelpRegistry";
import { ConfigUnion } from "../config/config";
import { AgentService } from "../service/Agent/AgentService";
import { tsxToPic } from "@/utils/plugin/browser/tsxToPic";
import { ChronicleReport } from "@/view/ChronicleReport";
import type { ChronicleMessage } from "@/config/AI/plugins/chronicle";
import type { AgentRunResult } from "@/service/Agent/types";
import type { MessageObject, SessionData } from "../utils/message";

RouteRegistry.registerBatch(['agent', 'agent-list']);

HelpRegistry.register({
    command: 'agent',
    description: '运行指定的 Agent 执行任务',
    usage: 'agent <agent名称> <任务描述>',
    examples: ['agent chronicle 群里谁说过白菜', 'agent chronicle 用户XXX最近都聊了什么'],
    details: '调用预配置的 Agent，Agent 会自动使用工具完成任务并返回结果。',
});

HelpRegistry.register({
    command: 'agent-list',
    description: '列出所有可用的 Agent',
    usage: 'agent-list',
    examples: ['agent-list'],
    details: '查看当前已配置的所有 Agent 及其状态。',
});

const agentService = new AgentService(ConfigUnion);

export const agentController = new Elysia()
    .post("/agent", async ({ body }): Promise<MessageObject | MessageObject[]> => {
        const { session, params } = body as { session: SessionData; params: string[] };
        if (!params || params.length < 2) {
            return { type: "text", content: "❌ 用法: agent <agent名称> <任务描述>" };
        }

        const agentName = params[0];
        const task = params.slice(1).join(' ');
        const groupId = session?._data?.group_id?.toString();

        const result = await agentService.runAgent({
            agentName,
            task,
            groupId,
            userId: session?.user?.id,
        });

        // chronicle agent: 从工具结果提取真实消息记录，渲染为卷轴图片
        if (agentName === 'chronicle' && result.success) {
            console.log(`📜 chronicle: ${result.steps.length} 步, finalText=${result.finalText?.length ?? 0}字`);
            try {
                const msgs = extractChronicleMessages(result);
                console.log(`📜 chronicle: 提取到 ${msgs.length} 条消息`);
                if (msgs.length > 0) {
                    const picPath = await tsxToPic(ChronicleReport, {
                        messages: msgs,
                        comment: result.finalText?.trim() || undefined,
                    }, { width: 700 });
                    return { type: "image", src: `file://${picPath}` } as MessageObject;
                }
            } catch (err) {
                console.error('📜 岁月史书渲染失败，回退文本:', err);
            }
        }

        return result.messages.length > 0
            ? result.messages
            : [{ type: "text", content: result.finalText || "Agent 未返回结果" }];
    })
    .post("/agent-list", async (): Promise<MessageObject> => {
        const agents = agentService.listAgents();
        if (agents.length === 0) {
            return { type: "text", content: "📭 暂无可用的 Agent" };
        }

        const lines = agents.map(a => {
            const status = a.enabled ? '✅' : '❌';
            const tools = a.tools.length > 0 ? a.tools.join(', ') : '无';
            return `${status} ${a.name} - ${a.description}\n   工具: ${tools}`;
        });

        return {
            type: "text",
            content: `🤖 可用 Agent 列表:\n\n${lines.join('\n\n')}`,
        };
    });

/** 从 agent 步骤的工具结果中提取 ChronicleMessage[] */
function extractChronicleMessages(result: AgentRunResult): ChronicleMessage[] {
    const seen = new Set<string>();
    const all: ChronicleMessage[] = [];

    for (const step of result.steps) {
        for (const tr of step.toolResults) {
            try {
                const parsed = JSON.parse(tr.result);
                if (!Array.isArray(parsed)) continue;
                for (const m of parsed) {
                    if (m.content && m.time) {
                        const key = `${m.user}:${m.content}:${m.time}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            all.push(m as ChronicleMessage);
                        }
                    }
                }
            } catch { /* 非 JSON 结果跳过 */ }
        }
    }
    return all;
}
