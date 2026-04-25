import type { ConfigUnionType } from "@/config/config";
import { getAvailableToolNames } from "@/config/AI/plugins/toolRegistry";
import { AgentEngine } from "./AgentEngine";
import type { AgentConfig, AgentRunParams, AgentRunResult } from "./types";

export class AgentService {
    private agents: Map<string, AgentConfig> = new Map();
    private engine: AgentEngine;

    constructor(configUnion: ConfigUnionType) {
        this.engine = new AgentEngine(configUnion.ai);
        this.loadAgentConfigs(configUnion.app.agents);
    }

    private loadAgentConfigs(
        agentsRaw: Record<string, Omit<AgentConfig, 'name'>>,
    ): void {
        const validTools = new Set(getAvailableToolNames());

        for (const [name, raw] of Object.entries(agentsRaw)) {
            // 校验工具名称
            const invalidTools = raw.tools.filter(t => !validTools.has(t));
            if (invalidTools.length > 0) {
                console.warn(
                    `⚠️ Agent [${name}] 包含无效工具: ${invalidTools.join(', ')}`,
                );
            }

            const config: AgentConfig = { ...raw, name };
            this.agents.set(name, config);

            if (config.enabled) {
                console.log(`🤖 Agent 已加载: ${name} (${config.description})`);
            }
        }
    }

    async runAgent(params: AgentRunParams): Promise<AgentRunResult> {
        const config = this.agents.get(params.agentName);
        if (!config) {
            return {
                success: false,
                agentName: params.agentName,
                finalText: '',
                steps: [],
                messages: [{ type: 'text', content: `❌ 未找到 Agent: ${params.agentName}` }],
                error: `Agent not found: ${params.agentName}`,
            };
        }
        if (!config.enabled) {
            return {
                success: false,
                agentName: params.agentName,
                finalText: '',
                steps: [],
                messages: [{ type: 'text', content: `❌ Agent [${params.agentName}] 已禁用` }],
                error: `Agent disabled: ${params.agentName}`,
            };
        }
        return this.engine.run(config, params);
    }

    listAgents(): Array<{ name: string; description: string; enabled: boolean; tools: string[] }> {
        return Array.from(this.agents.values()).map(a => ({
            name: a.name,
            description: a.description,
            enabled: a.enabled,
            tools: a.tools,
        }));
    }

    getAgent(name: string): AgentConfig | undefined {
        return this.agents.get(name);
    }
}
