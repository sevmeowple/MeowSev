# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
bun run dev          # Dev mode with watch (src/index.ts)
bun run src/index.ts # Direct run
```

### PM2 进程管理

```bash
npm i -g pm2         # 安装 pm2
bun run pm2:start    # 启动 (ecosystem.config.cjs)
bun run pm2:stop     # 停止
bun run pm2:restart  # 重启
bun run pm2:reload   # 热重启 (graceful)
bun run pm2:logs     # 查看日志
bun run pm2:status   # 查看状态
```

Graceful shutdown 会按顺序清理：Elysia server → 定时任务 → Puppeteer → SQLite。

Runtime: Bun. Port: 6040. No test suite configured.

## Path Aliases

`@/*` → `./src/*`, plus `@controller/*`, `@service/*`, `@utils/*`, `@config/*`, `@model/*`, `@types/*`

## Architecture

Elysia HTTP server receiving Koishi/OneBot session data. Sibling `../Connection/` project forwards messages here.

**Core flow:** `POST /command` → Controller → Service → (AI / DB / TSX render) → `MessageObject` response

### Adding a Feature

1. **Controller** (`src/controller/`): Register route via `RouteRegistry.registerBatch(['cmd'])`, register help via `HelpRegistry.register(...)`, export Elysia instance with `.post("/cmd", handler)`
2. **Service** (`src/service/`): Constructor takes `ConfigUnionType`, accesses `database` (SQLite), `ai` (AIClientSDK), `app` config
3. **View** (`src/view/`): React TSX component returning full `<html>` with Tailwind CDN + Noto Sans SC font. Dark theme: `#121212` bg, `#ff5000` accent
4. **Register** in `src/index.ts`: import controller, add `.use(controller)` to app chain

### TSX → Image Pipeline

```typescript
import { tsxToPic } from "@/utils/plugin/browser/tsxToPic";
const picPath = await tsxToPic(Component, props, { width: 700 });
return { type: "image", src: `file://${picPath}` } as MessageObject;
```

Components must be full HTML documents (html > head + body). Rendered via Puppeteer to PNG.

### AI Integration

`AIClientSDK` in `src/config/AI/index.ts` wraps Vercel AI SDK with OpenRouter. Key methods:
- `chat()` / `simpleChat()` - conversation with/without context
- `generateJsonResponse<T>()` - structured JSON output
- `generateStructuredResponse()` - Zod schema validated
- `analyzeImage()` - vision model

Tools registered via `aiClient.registerTool()`. `AIService` in `src/service/AIService.ts` adds session context and persona system.

### Message System

Session data follows Koishi/OneBot format (`SessionData` in `src/utils/message.ts`). Messages saved to SQLite via `MsgService`. Response format is `MessageObject` with types: text, image, audio, video, at, quote, card.

### Auth

`src/middleware/auth.ts` provides Elysia macros: `requireUser`, `requireAdmin`, `requireSuperAdmin`. Applied as route options: `.post("/cmd", handler, { requireSuperAdmin: true })`.

### Config

`config.toml` → Zod-validated `AppConfig`. `ConfigUnion` singleton provides `{ database, ai, app }`. Personas configurable per group.

### Database

SQLite via `bun:sqlite` with WAL mode. `DatabaseManager` singleton. Models define table schemas (e.g., `Message.ts`).
