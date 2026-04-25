# 使用 Mastra 构建 Agentic 应用：面向 AI SDK 用户的完整指导

## 目录

1. [概述：Mastra 与 AI SDK 的关系](#1-概述mastra-与-ai-sdk-的关系)
2. [核心架构概念](#2-核心架构概念)
3. [渐进式集成：从 AI SDK 到 Mastra](#3-渐进式集成从-ai-sdk-到-mastra)
4. [Agents：构建智能体](#4-agents构建智能体)
5. [Tools：赋予 Agent 能力](#5-tools赋予-agent-能力)
6. [Memory：对话持久化](#6-memory对话持久化)
7. [Processors：输入/输出处理管道](#7-processors输入输出处理管道)
8. [Workflows：结构化流程编排](#8-workflows结构化流程编排)
9. [Multi-Agent 系统设计模式](#9-multi-agent-系统设计模式)
10. [前端集成：AI SDK UI](#10-前端集成ai-sdk-ui)
11. [部署与运维](#11-部署与运维)
12. [决策指南与最佳实践](#12-决策指南与最佳实践)

---

## 1. 概述：Mastra 与 AI SDK 的关系

Mastra 是一个开源的 TypeScript Agent 框架，**构建在 Vercel AI SDK 之上**，为其增加了生产级 Agent 应用所需的关键能力。两者不是竞争关系，而是互补关系：

| 能力层 | Vercel AI SDK | Mastra 补充 |
|--------|---------------|-------------|
| LLM 调用 | `generateText`, `streamText`, `generateObject` | 保持完全兼容 |
| UI Hooks | `useChat`, `useCompletion`, `useObject` | 通过 `@mastra/ai-sdk` 桥接 |
| 模型提供方 | OpenAI, Anthropic, Google 等 | 统一路由 + 增强 |
| Agent 编排 | 基础工具调用循环 | 完整的 Agent 生命周期管理 |
| Memory | 无内置 | 完整的消息持久化系统 |
| Workflow | 无 | 结构化多步骤流程 |
| Multi-Agent | 无 | 4 种协作模式 |
| Processors | 无 | 输入/输出处理管道 |
| 观测性 | 基础日志 | 完整可观测 + Studio 调试 |

### 两种集成路径

**路径 A：渐进增强（保留现有 AI SDK 代码）**

如果你已有大量 AI SDK 代码，使用 `withMastra()` 包裹模型：

```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { withMastra } from '@mastra/ai-sdk';

const model = withMastra(openai('gpt-4.1'), {
  inputProcessors: [guardProcessor],
  outputProcessors: [logProcessor],
  memory: { storage, threadId: 't-1', resourceId: 'user-1', lastMessages: 10 },
});

const { text } = await generateText({ model, prompt: 'Hello!' });
```

**路径 B：全面采用（使用 Mastra Agent API）**

从零构建，获得完整功能集：

```typescript
import { Agent } from '@mastra/core/agent';

export const myAgent = new Agent({
  id: 'assistant',
  name: 'AI Assistant',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-4.1',
  tools: { searchTool, calcTool },
  memory: { storage, lastMessages: 10 },
});
```

---

## 2. 核心架构概念

### 项目结构约定

Mastra 推荐以下项目结构：

```
src/mastra/
  ├── index.ts        # Mastra 实例注册
  ├── agents/         # Agent 定义
  ├── tools/          # 工具定义
  ├── workflows/      # 工作流定义
  └── memory/         # 存储配置
```

### 核心注册入口

所有组件通过 `Mastra` 实例统一管理：

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { myAgent } from './agents/my-agent';
import { myWorkflow } from './workflows/my-workflow';

export const mastra = new Mastra({
  agents: { myAgent },
  workflows: { myWorkflow },
  server: {
    apiRoutes: [
      // 可添加自定义 API 路由
    ],
  },
});
```

### 与 AI SDK 的数据流

```
Frontend (useChat) 
  → API Route (chatRoute/handleChatStream)
    → Mastra Agent (stream/generate)
      → AI SDK model (streamText)
        → LLM Provider
      → Memory (自动读写)
      → Processors (输入/输出处理)
    → AI SDK 兼容流
  → Frontend 渲染
```

---

## 3. 渐进式集成：从 AI SDK 到 Mastra

### 步骤 1：安装集成包

```bash
npm install @mastra/ai-sdk@latest @ai-sdk/react ai
```

### 步骤 2：为现有模型添加 Memory

```typescript
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { withMastra } from '@mastra/ai-sdk';
import { LibSQLStore } from '@mastra/libsql';

const storage = new LibSQLStore({ id: 'my-app', url: 'file:./data.db' });
await storage.init();
const memoryStorage = await storage.getStore('memory');

const model = withMastra(openai('gpt-4.1'), {
  memory: {
    storage: memoryStorage!,
    threadId: 'session-123',
    resourceId: 'user-456',
    lastMessages: 10, // 自动加载最近 10 条消息
  },
});

const result = await streamText({
  model,
  messages: [{ role: 'user', content: 'What did we talk about earlier?' }],
});
```

### 步骤 3：添加 Processors 进行内容管控

```typescript
import type { Processor } from '@mastra/core/processors';

const guardProcessor: Processor<'guard'> = {
  id: 'guard',
  async processInput({ messages }) {
    // 输入安全检查
    const lastMessage = messages[messages.length - 1];
    if (containsSensitiveInfo(lastMessage.content)) {
      throw new Error('Input contains sensitive information');
    }
    return messages;
  },
  async processOutputResult({ messages }) {
    // 输出后处理
    return messages;
  },
};

const model = withMastra(openai('gpt-4.1'), {
  inputProcessors: [guardProcessor],
  outputProcessors: [guardProcessor],
});
```

### 步骤 4：组合 Processors + Memory

执行顺序：**Memory 加载历史 → Input Processors → LLM 调用 → Output Processors → Memory 保存**

```typescript
const model = withMastra(openai('gpt-4.1'), {
  inputProcessors: [guardProcessor],   // 在 memory 加载后执行
  outputProcessors: [logProcessor],    // 在 memory 保存前执行
  memory: {
    storage: memoryStorage!,
    threadId: 'thread-123',
    resourceId: 'user-123',
    lastMessages: 10,
  },
});
```

---

## 4. Agents：构建智能体

### Agent 定义

```typescript
import { Agent } from '@mastra/core/agent';

export const researchAgent = new Agent({
  id: 'researcher',
  name: 'Research Agent',
  instructions: `
    You are a research specialist. Your role is to:
    - Search for relevant information using the search tool
    - Synthesize findings into clear summaries
    - Always cite your sources
  `,
  model: 'openai/gpt-4.1',
  tools: { searchTool, browserTool },
});
```

### Agent 调用方式

```typescript
// 单次生成
const { text } = await researchAgent.generate('Research quantum computing advances');

// 流式输出
const { textStream } = await researchAgent.stream('Explain AI agents');
for await (const chunk of textStream) {
  process.stdout.write(chunk);
}

// 结构化输出
const { object } = await researchAgent.generate(
  'Analyze this data',
  { output: analysisSchema }
);
```

### Agent vs Workflow：选择原则

| 维度 | Agent | Workflow |
|------|-------|----------|
| 执行路径 | 动态决策（模型决定下一步） | 预定义（代码控制流程） |
| 工具调用 | 模型自主决定 | 显式在步骤中调用 |
| 迭代次数 | 模型自主决定 | 由流程图控制 |
| 可预测性 | 较低，适合探索性任务 | 高，适合确定性流程 |
| 调试难度 | 较高 | 较低 |

**原则**：步骤不明确时用 Agent，步骤明确时用 Workflow。

---

## 5. Tools：赋予 Agent 能力

### 创建类型安全的工具

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ location }) => {
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${location}`
    );
    const data = await response.json();
    return {
      temperature: data.current.temp_c,
      feelsLike: data.current.feelslike_c,
      humidity: data.current.humidity,
      conditions: data.current.condition.text,
    };
  },
});
```

### 工具在前端的渲染

定义 `outputSchema` 后，前端可以根据工具输出渲染自定义组件：

```typescript
// 工具状态流转：
// input-streaming → input-available → output-available | output-error

// 前端（React + AI SDK UI）
const { messages } = useChat({ api: '/api/chat' });

// 在消息渲染中检测工具调用
messages.map(msg => msg.parts?.map(part => {
  if (part.type === 'tool-invocation') {
    const { toolInvocation } = part;
    if (toolInvocation.toolName === 'get-weather') {
      return <WeatherCard data={toolInvocation.result} />;
    }
  }
}));
```

---

## 6. Memory：对话持久化

Mastra 的 Memory 系统自动在 LLM 调用前加载历史消息，调用后保存新消息。

### 基础配置

```typescript
import { LibSQLStore } from '@mastra/libsql';

const storage = new LibSQLStore({
  id: 'my-app',
  url: 'file:./data.db',        // 本地文件
  // url: 'libsql://...',       // Turso 远程
});
await storage.init();
const memoryStorage = await storage.getStore('memory');
```

### 在 Agent 中使用 Memory

```typescript
const agent = new Agent({
  id: 'chat-agent',
  name: 'Chat Agent',
  instructions: 'You are a helpful assistant with memory.',
  model: 'openai/gpt-4.1',
  memory: {
    storage: memoryStorage!,
    threadId: 'user-thread-123',   // 会话标识
    resourceId: 'user-123',         // 用户标识
    lastMessages: 10,               // 上下文窗口
  },
});
```

### Memory 工作原理

```
用户发送消息
  → Memory 加载该 threadId 的最近 N 条历史消息
  → 历史消息 + 新消息 组合成完整上下文
  → Input Processors 处理
  → 发送给 LLM
  → Output Processors 处理
  → Memory 保存 Assistant 回复
```

---

## 7. Processors：输入/输出处理管道

Processors 让你在不改变 AI SDK 调用代码的情况下，插入处理逻辑。

### 常见 Processor 类型

```typescript
// 1. 日志 Processor
const loggingProcessor: Processor<'logger'> = {
  id: 'logger',
  async processInput({ messages }) {
    console.log(`[Input] ${messages.length} messages`);
    return messages;
  },
  async processOutputResult({ messages }) {
    console.log(`[Output] ${messages.length} messages`);
    return messages;
  },
};

// 2. 内容安全 Processor
const safetyProcessor: Processor<'safety'> = {
  id: 'safety',
  async processOutputResult({ messages }) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant') {
      // PII 检测、敏感词过滤等
      lastMessage.content = sanitizeOutput(lastMessage.content);
    }
    return messages;
  },
};

// 3. Token 预算 Processor
const tokenBudgetProcessor: Processor<'budget'> = {
  id: 'budget',
  async processInput({ messages }) {
    // 截断超长历史，控制 token 消耗
    const estimatedTokens = estimateTokens(messages);
    if (estimatedTokens > MAX_TOKENS) {
      return truncateMessages(messages, MAX_TOKENS);
    }
    return messages;
  },
};
```

### Processor 链式执行

```typescript
const model = withMastra(openai('gpt-4.1'), {
  inputProcessors: [
    tokenBudgetProcessor,  // 先截断到预算内
    safetyProcessor,       // 再检查输入安全
    loggingProcessor,      // 最后记录日志
  ],
  outputProcessors: [
    loggingProcessor,      // 记录输出
    safetyProcessor,       // 输出安全检查
  ],
});
```

---

## 8. Workflows：结构化流程编排

当任务步骤明确时，使用 Workflow 而非 Agent 自主决策。

### 基本 Workflow

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// 定义步骤
const extractStep = createStep({
  id: 'extract',
  inputSchema: z.object({ rawText: z.string() }),
  outputSchema: z.object({ entities: z.array(z.string()) }),
  execute: async ({ inputData, run }) => {
    // 可以调用 Agent 或纯函数
    const result = await extractionAgent.generate(
      `Extract entities from: ${inputData.rawText}`
    );
    return { entities: parseEntities(result.text) };
  },
});

const analyzeStep = createStep({
  id: 'analyze',
  inputSchema: z.object({ entities: z.array(z.string()) }),
  outputSchema: z.object({ sentiment: z.string(), score: z.number() }),
  execute: async ({ inputData }) => {
    const result = await analysisAgent.generate(
      `Analyze sentiment of: ${inputData.entities.join(', ')}`
    );
    return parseSentiment(result.text);
  },
});

// 组合工作流
const myWorkflow = createWorkflow({
  id: 'text-pipeline',
  inputSchema: z.object({ rawText: z.string() }),
  outputSchema: z.object({ sentiment: z.string(), score: z.number() }),
}).then(extractStep).then(analyzeStep).commit();

// 执行
const result = await myWorkflow.run({ rawText: 'Some text to analyze' });
```

### 控制流模式

```typescript
// 并行执行
const workflow = createWorkflow({...})
  .then(step1)
  .parallel([step2a, step2b])    // step2a 和 step2b 同时执行
  .then(mergeStep)
  .commit();

// 条件分支
const workflow = createWorkflow({...})
  .then(classifyStep)
  .branch([
    { condition: ({ result }) => result.type === 'A', step: handleA },
    { condition: ({ result }) => result.type === 'B', step: handleB },
  ])
  .commit();

// 循环
const workflow = createWorkflow({...})
  .then(initStep)
  .while(
    ({ result }) => result.hasMore,  // 条件
    processBatchStep                 // 循环体
  )
  .then(finalizeStep)
  .commit();
```

### 人工介入（Human-in-the-loop）

```typescript
const approvalStep = createStep({
  id: 'await-approval',
  inputSchema: z.object({ proposal: z.string() }),
  outputSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, suspend }) => {
    // 暂停工作流，等待人工决策
    const { value } = await suspend({
      type: 'human-in-the-loop',
      prompt: `Approve this proposal?\n${inputData.proposal}`,
    });
    return { approved: value === 'yes' };
  },
});

// 稍后恢复
await workflowRun.resume({
  stepId: 'await-approval',
  context: { value: 'yes' },
});
```

---

## 9. Multi-Agent 系统设计模式

### 4 种核心模式

| 模式 | 控制权 | 适用场景 |  tradeoff |
|------|--------|----------|-----------|
| **Handoffs** | 当前专家 Agent | 需要在不同专家间移交控制权 | 上下文管理更复杂 |
| **Workflows** | 执行图 | 执行路径预先确定 | 任务变化时不够灵活 |
| **Supervisors** | 一个领导 Agent | 需要动态委托 | 依赖协调质量 |
| **Council** | 最终综合步骤 | 需要多视角独立评估 | 成本高、延迟大 |

### Supervisor 模式（最常用）

```typescript
import { Agent } from '@mastra/core/agent';

const supervisor = new Agent({
  id: 'orchestrator',
  name: 'Task Orchestrator',
  instructions: `
    You are a supervisor. Delegate tasks to specialists:
    - Use researcher for information gathering
    - Use writer for content creation
    - Use reviewer for quality checks
  `,
  model: 'openai/gpt-4.1',
  agents: {          // 定义子 Agent
    researcher: researchAgent,
    writer: writerAgent,
    reviewer: reviewerAgent,
  },
});

// 监督者自动决定何时调用哪个子 Agent
const result = await supervisor.generate(
  'Write a comprehensive report on renewable energy'
);
```

### Council 模式（多 Agent 独立评估）

```typescript
// 使用 Workflow 并行执行多个 Agent
const councilWorkflow = createWorkflow({...})
  .parallel([
    createStep({ id: 'expert-a', execute: async () => 
      expertA.generate(question) }),
    createStep({ id: 'expert-b', execute: async () => 
      expertB.generate(question) }),
    createStep({ id: 'expert-c', execute: async () => 
      expertC.generate(question) }),
  ])
  .then(synthesizeStep)  // 综合多个视角
  .commit();
```

### 模式组合实践

实际系统中这些模式经常组合使用：

```
Supervisor (路由决策)
  → Workflow (固定内部结构)
    → Agent 执行步骤
    → Human-in-the-loop 审批
    → 并行 Council 评审
  → 汇总结果
```

---

## 10. 前端集成：AI SDK UI

### 方案 A：Mastra Server（独立后端）

使用 Mastra 内置服务器，前端通过 HTTP 连接：

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { chatRoute, workflowRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { myWorkflow },
  server: {
    apiRoutes: [
      chatRoute({
        path: '/chat',
        agent: 'weatherAgent',
      }),
      workflowRoute({
        path: '/workflow',
        workflow: 'myWorkflow',
      }),
    ],
  },
});
```

前端：

```typescript
import { useChat } from '@ai-sdk/react';

const { messages, input, handleSubmit } = useChat({
  api: 'http://localhost:4111/chat',  // Mastra 服务器地址
});
```

### 方案 B：框架集成（Next.js / Express）

使用框架自身的路由系统：

```typescript
// app/api/chat/route.ts (Next.js App Router)
import { handleChatStream, createUIMessageStreamResponse } from '@mastra/ai-sdk';
import { mastra } from '@/mastra';

export async function POST(req: Request) {
  const { messages, threadId, resourceId } = await req.json();
  
  const agent = mastra.getAgent('weatherAgent');
  const stream = await handleChatStream(agent, {
    messages,
    threadId,
    resourceId,
  });
  
  return createUIMessageStreamResponse(stream);
}
```

### 工具输出渲染

AI SDK 自动创建 `tool-{toolKey}` parts，包含状态机：

```
input-streaming  →  input-available  →  output-available
                                           ↓
                                        output-error
```

```typescript
// 前端根据工具状态渲染不同 UI
function ToolPartRenderer({ part }) {
  switch (part.state) {
    case 'input-available':
      return <ToolLoading toolName={part.toolName} args={part.args} />;
    case 'output-available':
      if (part.toolName === 'get-weather') {
        return <WeatherCard {...part.result} />;
      }
      return <ToolResult result={part.result} />;
    case 'output-error':
      return <ToolError error={part.result} />;
  }
}
```

### Workflow 数据流渲染

```typescript
// Data Part Types 表
const DATA_PART_TYPES = {
  'data-workflow': '工作流执行状态快照',
  'data-workflow-step': '工作流步骤增量更新',
  'data-network': 'Agent 网络执行步骤',
  'data-tool-agent': '工具内嵌套 Agent 输出',
  'data-tool-workflow': '工具内嵌套 Workflow 输出',
  'data-{custom}': '自定义事件（进度指示器等）',
};
```

---

## 11. 部署与运维

### 部署目标

| 平台 | 方式 | 适用场景 |
|------|------|----------|
| **Mastra Platform** | 官方托管 | 最快上手，内置可观测性 |
| **AWS Lambda** | Serverless | 事件驱动，按调用付费 |
| **Cloudflare Workers** | Edge | 低延迟，全球分发 |
| **EC2 / DigitalOcean** | VM | 长时运行，完全控制 |
| **Inngest** | Workflow Runner | 托管 Workflow 执行 |

### 关键环境变量

```env
# AI Provider API Keys
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Storage
LIBSQL_URL=file:./data.db

# Mastra
MASTRA_PORT=4111
MASTRA_ADMIN_SECRET=

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=
```

---

## 12. 决策指南与最佳实践

### 技术选型决策树

```
开始
  ↓
已有 AI SDK 项目？
  → 是 → 先使用 withMastra() 渐进增强
  → 否 → 全面使用 Mastra Agent API
  ↓
任务步骤是否明确？
  → 是 → 使用 Workflow
  → 否 → 使用 Agent
  ↓
需要多个专家协作？
  → 是 → 选择 Multi-Agent 模式
  → 否 → 单个 Agent + Tools
  ↓
需要持久化对话？
  → 是 → 配置 Memory
  → 否 → 无状态调用
  ↓
需要内容管控？
  → 是 → 添加 Processors
  → 否 → 直接调用
```

### 最佳实践

1. **从简单开始**：单个 Agent → 添加 Tools → 添加 Memory → Multi-Agent
2. **优先使用 Workflow**：当执行路径明确时，Workflow 比 Agent 更可控、更易调试
3. **定义 outputSchema**：为工具定义输出模式，前端可以类型安全地渲染
4. **合理设置 lastMessages**：Memory 上下文窗口不宜过大（建议 5-20 条），避免 token 爆炸
5. **使用 Processors 做横切关注点**：日志、安全、预算控制通过 Processors 统一处理
6. **Thread 隔离**：不同会话使用不同 threadId，同一用户的不同资源使用不同 resourceId
7. **渐进增强**：先用 `withMastra()` 保留现有代码，再逐步迁移到完整 Agent API

### 常见陷阱

- **过度使用 Agent**：明确流程用 Workflow，不要交给 Agent 随意决定
- **忽略 Memory 作用域**：threadId 和 resourceId 设计不当会导致上下文混乱
- **Processor 顺序错误**：Input Processors 中先做预算控制再做安全检查，避免浪费计算
- **工具无 outputSchema**：前端无法安全渲染，失去类型保护
- **Supervisor 过度复杂**：如果子 Agent 之间没有复杂交互，直接用 Workflow 更简单

---

## 参考资源

- [Mastra 官方文档](https://mastra.ai/docs)
- [AI SDK 文档](https://sdk.vercel.ai)
- [Mastra UI Dojo 示例](https://ui-dojo.mastra.ai/)
- [@mastra/ai-sdk API 参考](https://mastra.ai/reference/ai-sdk/with-mastra)
- [Multi-agent 系统模式指南](https://mastra.ai/guides/concepts/multi-agent-systems)
