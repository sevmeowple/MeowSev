import type { MessageObject } from "@/utils/message";

export interface AgentConfig {
    name: string;
    description: string;
    systemPrompt: string;
    tools: string[];
    maxSteps: number;
    reportToGroup: boolean;
    reportGroupId?: string;
    enabled: boolean;
}

export interface AgentRunParams {
    agentName: string;
    task: string;
    groupId?: string;
    userId?: string;
}

export interface AgentStepReport {
    stepIndex: number;
    text: string;
    toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>;
    toolResults: Array<{ toolName: string; result: string }>;
    finishReason: string;
}

export interface AgentRunResult {
    success: boolean;
    agentName: string;
    finalText: string;
    steps: AgentStepReport[];
    messages: MessageObject[];
    error?: string;
}
