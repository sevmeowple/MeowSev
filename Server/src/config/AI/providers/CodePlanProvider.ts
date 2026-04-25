import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

export interface CodePlanConfig {
    enabled: boolean;
    provider: 'kimi';
    apiKey: string;
    baseURL: string;
    modelID: string;
}

/**
 * 创建 Kimi Code Plan  provider。
 *
 * 由于 ai SDK 会强制覆盖 User-Agent，必须在初始化前全局拦截 fetch，
 * 对 api.kimi.com 请求强制注入 KimiCLI 的 User-Agent。
 */
export function createKimiCodePlanProvider(config: CodePlanConfig): LanguageModel {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.toString()
                : input.url;

        if (url.includes('api.kimi.com')) {
            const newInit = init ? { ...init } : {};
            const headers = new Headers(init?.headers);
            headers.set('User-Agent', 'KimiCLI/1.30.0');
            newInit.headers = headers;
            return originalFetch(input, newInit);
        }

        return originalFetch(input, init);
    };

    return createOpenAICompatible({
        name: 'kimi',
        apiKey: config.apiKey,
        baseURL: config.baseURL,
    })(config.modelID);
}
