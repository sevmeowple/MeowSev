import type { LanguageModelMiddleware } from "ai";

/**
 * kimi-k2.5 reasoning_content 兼容 middleware
 *
 * 问题：kimi-k2.5 返回的 reasoning_content 被 Vercel AI SDK 解析为 reasoning type content part，
 * 但在多步工具调用时，SDK 拼接下一轮请求的 assistant message 时忽略了 reasoning parts，
 * 导致 kimi API 报错 "reasoning_content is missing in assistant tool call message"
 *
 * 解决：在 transformParams 里把 reasoning parts 提取出来，
 * 注入到 assistant message 的 providerOptions.openaiCompatible.reasoning_content
 */
export const kimiReasoningMiddleware: LanguageModelMiddleware = {
    transformParams: async ({ params, type }) => {
        if (!params.prompt) return params;

        const newPrompt = params.prompt.map((msg) => {
            if (msg.role !== "assistant") return msg;

            // 提取 reasoning parts 的文本
            const reasoningTexts: string[] = [];
            const otherParts: typeof msg.content = [];

            for (const part of msg.content) {
                if (part.type === "reasoning") {
                    reasoningTexts.push(part.text);
                } else {
                    otherParts.push(part);
                }
            }

            // 没有 reasoning content，原样返回
            if (reasoningTexts.length === 0) return msg;

            const reasoningContent = reasoningTexts.join("");

            return {
                ...msg,
                content: otherParts,
                providerOptions: {
                    ...msg.providerOptions,
                    openaiCompatible: {
                        ...(msg.providerOptions?.openaiCompatible as Record<string, unknown> ?? {}),
                        reasoning_content: reasoningContent,
                    },
                },
            };
        });

        return { ...params, prompt: newPrompt };
    },
};
