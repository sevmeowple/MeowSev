import { GameHandler, GameSession, GameResult } from "../Base/Base_ContextService";
import { AIService } from "../AIService";
import { ConfigUnionType } from "@/config/config";

import { z } from "zod";
import fs from "fs";
import path from "path";
import TOML from "smol-toml";
import { sendToGroup } from "@/utils/message";

// 故事模板的 Zod Schema
export const StoryTemplateSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    template: z.string(),
    variables: z.array(z.string()),
    estimatedTime: z.number()
});

export const TurtleSoupConfigSchema = z.object({
    templates: z.array(StoryTemplateSchema),
    settings: z.object({
        questionCooldown: z.number().default(5),
        maxGuessesPerUser: z.number().default(3),
        defaultTimeout: z.number().default(60)
    }).default({
        questionCooldown: 5,
        maxGuessesPerUser: 3,
        defaultTimeout: 60
    })
});

export type TurtleSoupConfig = z.infer<typeof TurtleSoupConfigSchema>;


// 海龟汤配置管理器
export class TurtleSoupConfigManager {
    private configPath: string;
    private templates: Map<string, StoryTemplate> = new Map();
    private categories: Map<string, string[]> = new Map();
    private settings: any = {};

    constructor(configPath?: string) {
        this.configPath = configPath || path.join(process.cwd(), 'turtle-soup-config.toml');
        this.loadFromFile();
    }

    // 读取配置文件
    private loadFromFile(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const tomlContent = fs.readFileSync(this.configPath, 'utf-8');
                const parsedData = TOML.parse(tomlContent);
                const config = TurtleSoupConfigSchema.parse(parsedData);
                this.loadConfig(config);
            } else {
                // 如果文件不存在，创建默认配置
                this.createDefaultConfig();
            }
        } catch (error) {
            console.warn('Failed to load turtle soup config:', error);
            this.createDefaultConfig();
        }
    }

    // 保存到配置文件
    private saveToFile(): void {
        const config: TurtleSoupConfig = {
            templates: Array.from(this.templates.values()),
            settings: this.settings
        };

        const tomlContent = TOML.stringify(config);
        fs.writeFileSync(this.configPath, tomlContent, 'utf-8');
    }

    // 加载配置到内存
    private loadConfig(config: TurtleSoupConfig): void {
        this.templates.clear();
        this.categories.clear();
        this.settings = config.settings;

        for (const template of config.templates) {
            this.templates.set(template.id, template);
            this.buildCategoryIndex(template);
        }

        console.log(`📚 加载了 ${config.templates.length} 个海龟汤故事模板`);
    }

    // 构建分类索引
    private buildCategoryIndex(template: StoryTemplate): void {
        if (!this.categories.has(template.category)) {
            this.categories.set(template.category, []);
        }
        this.categories.get(template.category)!.push(template.id);
    }

    // 创建默认配置
    private createDefaultConfig(): void {
        const defaultTemplates: StoryTemplate[] = [
            {
                id: 'daily-life',
                name: '日常意外',
                category: 'daily',
                difficulty: 'easy',
                template: '日常生活中看似平常的行为背后隐藏着特殊原因',
                variables: ['日常行为', '特殊原因', '环境因素'],
                estimatedTime: 20
            },
            {
                id: 'psychological',
                name: '心理认知',
                category: 'psychology',
                difficulty: 'medium',
                template: '基于人的心理状态或认知偏差产生的误解',
                variables: ['心理状态', '认知偏差', '误解结果'],
                estimatedTime: 30
            },
            {
                id: 'mystery-death',
                name: '神秘事件',
                category: 'mystery',
                difficulty: 'hard',
                template: '看似不可能或超自然的事件，实际有科学合理的解释',
                variables: ['神秘现象', '科学原理', '关键线索'],
                estimatedTime: 40
            },
            {
                id: 'social-misunderstanding',
                name: '社会误解',
                category: 'social',
                difficulty: 'medium',
                template: '基于社会关系或文化背景产生的误解',
                variables: ['社会关系', '文化背景', '误解过程'],
                estimatedTime: 25
            },
            {
                id: 'scientific-phenomenon',
                name: '科学现象',
                category: 'science',
                difficulty: 'hard',
                template: '涉及科学原理或自然现象的巧合事件',
                variables: ['科学原理', '自然现象', '巧合因素'],
                estimatedTime: 35
            }
        ];

        const config: TurtleSoupConfig = {
            templates: defaultTemplates,
            settings: {
                questionCooldown: 5,
                maxGuessesPerUser: 3,
                defaultTimeout: 60
            }
        };

        this.loadConfig(config);
        this.saveToFile();
        console.log('📝 创建了默认海龟汤配置文件（AI动态生成模式）');
    }

    // ========== 查询操作 ==========

    // 获取所有模板
    getAllTemplates(): StoryTemplate[] {
        return Array.from(this.templates.values());
    }

    // 根据ID获取模板
    getTemplateById(id: string): StoryTemplate | undefined {
        return this.templates.get(id);
    }

    // 根据分类获取模板
    getTemplatesByCategory(category: string): StoryTemplate[] {
        const templateIds = this.categories.get(category) || [];
        return templateIds.map(id => this.templates.get(id)!).filter(Boolean);
    }

    // 根据难度获取模板
    getTemplatesByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): StoryTemplate[] {
        return Array.from(this.templates.values()).filter(t => t.difficulty === difficulty);
    }

    // 获取随机模板
    getRandomTemplate(category?: string, difficulty?: 'easy' | 'medium' | 'hard'): StoryTemplate | undefined {
        let templates: StoryTemplate[];

        if (category && difficulty) {
            templates = this.getTemplatesByCategory(category).filter(t => t.difficulty === difficulty);
        } else if (category) {
            templates = this.getTemplatesByCategory(category);
        } else if (difficulty) {
            templates = this.getTemplatesByDifficulty(difficulty);
        } else {
            templates = this.getAllTemplates();
        }

        if (templates.length === 0) return undefined;
        return templates[Math.floor(Math.random() * templates.length)];
    }

    // 获取设置
    getSettings() {
        return this.settings;
    }

    // 获取所有分类
    getCategories(): string[] {
        return Array.from(this.categories.keys());
    }

    // 获取统计信息
    getStats(): {
        totalTemplates: number;
        totalCategories: number;
        categoriesWithCount: Array<{ category: string; count: number }>;
        difficultyDistribution: Record<string, number>;
    } {
        const difficultyDistribution = { easy: 0, medium: 0, hard: 0 };
        for (const template of this.templates.values()) {
            difficultyDistribution[template.difficulty]++;
        }

        return {
            totalTemplates: this.templates.size,
            totalCategories: this.categories.size,
            categoriesWithCount: Array.from(this.categories.entries()).map(
                ([category, ids]) => ({ category, count: ids.length })
            ),
            difficultyDistribution
        };
    }

    // ========== CRUD 操作 ==========

    // 添加模板
    addTemplate(template: StoryTemplate): boolean {
        if (this.templates.has(template.id)) {
            return false; // ID 已存在
        }

        this.templates.set(template.id, template);
        this.buildCategoryIndex(template);
        this.saveToFile();
        return true;
    }

    // 删除模板
    deleteTemplate(id: string): boolean {
        const template = this.templates.get(id);
        if (!template) {
            return false;
        }

        // 移除分类索引
        const categoryIds = this.categories.get(template.category);
        if (categoryIds) {
            const index = categoryIds.indexOf(id);
            if (index > -1) {
                categoryIds.splice(index, 1);
            }
            if (categoryIds.length === 0) {
                this.categories.delete(template.category);
            }
        }

        this.templates.delete(id);
        this.saveToFile();
        return true;
    }

    // 更新设置
    updateSettings(newSettings: Partial<typeof this.settings>): void {
        this.settings = { ...this.settings, ...newSettings };
        this.saveToFile();
    }

    // 重新加载配置
    reload(): void {
        this.loadFromFile();
    }

    // 验证配置文件
    validate(): { valid: boolean; errors: string[] } {
        try {
            const tomlContent = fs.readFileSync(this.configPath, 'utf-8');
            const parsedData = TOML.parse(tomlContent);
            TurtleSoupConfigSchema.parse(parsedData);
            return { valid: true, errors: [] };
        } catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
}

// 单例实例
let configManagerInstance: TurtleSoupConfigManager | null = null;

export function getTurtleSoupConfigManager(configPath?: string): TurtleSoupConfigManager {
    if (!configManagerInstance) {
        configManagerInstance = new TurtleSoupConfigManager(configPath);
    }
    return configManagerInstance;
}

// 海龟汤专用数据结构
export interface TurtleSoupData {
    gameId: string;
    story: string;
    opening: string;
    truth: string;
    template: string;

    // 问答系统
    questionQueue: QuestionEntry[];
    questionHistory: QuestionEntry[];
    lastQuestionTime: number;
    questionCooldown: number;

    // 猜测系统
    guessAttempts: GuessEntry[];
    guessCooldowns: Map<string, number>;
    maxGuessesPerUser: number;

    // 游戏状态
    currentQuestioner?: string;
    isWaitingAnswer: boolean;
    winner?: string;
}

export interface QuestionEntry {
    userId: string;
    userName: string;
    question: string;
    answer?: string;
    aiConfidence?: number;
    timestamp: number;
    position: number;
}

export interface GuessEntry {
    userId: string;
    userName: string;
    guess: string;
    isCorrect: boolean;
    similarity: number;
    feedback: string;
    timestamp: number;
}

export interface StoryTemplate {
    id: string;
    name: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
    template: string;
    variables: string[];
    estimatedTime: number;
}

// 海龟汤游戏处理器
export class TurtleSoupGameHandler implements GameHandler {
    gameType = 'turtle-soup';
    initialState = 'INITIALIZING';
    maxParticipants = 999;
    timeoutMinutes = 60;
    private oneBotApiUrl?: string; // OneBot API 地址
    private currentSessionInfo?: { groupId: string; userId: string }; // 当前会话信息


    private sessionFinder?: (gameId: string) => GameSession | undefined;

    private aiService: AIService;
    private configManager: TurtleSoupConfigManager;

    constructor(configUnion: ConfigUnionType) {
        this.aiService = new AIService(configUnion);
        this.configManager = getTurtleSoupConfigManager(configUnion.app.games?.turtleSoup?.configPath);

        // 从配置中读取 OneBot API 地址
        this.oneBotApiUrl = configUnion.app.games?.turtleSoup?.oneBotApiUrl || 'http://127.0.0.1:3033';

        const settings = this.configManager.getSettings();
        this.timeoutMinutes = settings.defaultTimeout || 60;
    }
    setCurrentSession(groupId: string, userId: string): void {
        this.currentSessionInfo = { groupId, userId };
    }

    // 修改初始化数据方法，使用配置中的设置
    initializeGameData(): TurtleSoupData {
        const settings = this.configManager.getSettings();

        return {
            gameId: this.generateGameId(),
            story: '',
            opening: '',
            truth: '',
            template: '',
            questionQueue: [],
            questionHistory: [],
            lastQuestionTime: 0,
            questionCooldown: settings.questionCooldown || 5,
            guessAttempts: [],
            guessCooldowns: new Map<string, number>(), // 确保初始化
            maxGuessesPerUser: settings.maxGuessesPerUser || 3,
            isWaitingAnswer: false
        };
    }
    // 会话创建后的初始化
    async onSessionCreated(session: GameSession): Promise<void> {
        // const data = session.data as TurtleSoupData;

        // // 随机选择故事模板
        // const template = this.getRandomTemplate();

        // // 使用内部封装的故事生成方法
        // const storyResult = await this.generateStory(template);

        // // 更新游戏数据
        // data.story = storyResult.story;
        // data.opening = storyResult.opening;
        // data.truth = storyResult.truth;
        // data.template = template.name;

        session.state = 'STORY_READY';
    }

    // 处理群聊命令
    async handleCommand(session: GameSession, userId: string, command: string, params: string[]): Promise<GameResult> {
        const data = session.data as TurtleSoupData;

        switch (command) {
            case 'turtle-start':
                return this.handleStart(session, userId, params);

            case 'turtle-ask':
                return this.handleAsk(session, userId, params);

            case 'turtle-hint':
                return this.handleHint(session, userId);

            case 'turtle-status':
                return this.handleStatus(session, userId);

            case 'turtle-end':
                return this.handleEnd(session, userId);

            default:
                return {
                    success: false,
                    message: "❌ 未知的海龟汤命令"
                };
        }
    }

    // 处理私聊猜测命令
    async handlePrivateCommand(gameId: string, userId: string, command: string, params: string[]): Promise<GameResult> {
        // 这里通过 ContextService.findSessionByGameId 获取会话
        // 但为了避免循环依赖，可以通过回调或事件机制实现

        if (command === 'guess') {
            return this.handleGuess(gameId, userId, params);
        }

        return {
            success: false,
            message: "❌ 未知的私聊命令"
        };
    }


    private async handleHint(session: GameSession, userId: string): Promise<GameResult> {
        const data = session.data as TurtleSoupData;

        if (session.state !== 'PLAYING') {
            return {
                success: false,
                message: "❌ 游戏未在进行中"
            };
        }

        if (data.questionHistory.length < 3) {
            return {
                success: false,
                message: "❌ 至少需要 3 个问答后才能获取提示"
            };
        }

        try {
            // 使用内部封装的提示生成方法
            const hint = await this.generateHint(
                data.story,
                data.truth,
                data.questionHistory
            );

            return {
                success: true,
                message: `💡 提示：${hint}`,
                broadcastToAll: true
            };

        } catch (error) {
            console.error('生成提示失败:', error);
            return {
                success: false,
                message: "❌ 生成提示失败，请稍后重试"
            };
        }
    }

    private async generateHint(story: string, truth: string, questionHistory: QuestionEntry[]): Promise<string> {
        const historyText = questionHistory.map(q =>
            `Q: ${q.question} A: ${this.formatAnswer(q.answer || 'unknown')}`
        ).join('\n');

        const prompt = `
作为海龟汤游戏的主持人，基于以下信息生成一个有用的提示：

完整故事：${story}
真相：${truth}

已有问答历史：
${historyText}

请生成一个简短但有用的提示，帮助玩家朝正确方向思考，但不要直接透露答案。提示应该：
1. 基于已有的问答历史
2. 引导玩家注意重要的细节
3. 不超过30字
4. 用中文回复
5. 应该暴露给玩家除了历史提到的额外的2-3个详细描述的没有提到过的关键细节/关键物品
直接返回提示内容，不需要任何额外格式。`;

        const systemPrompt = "你是一个经验丰富的海龟汤游戏主持人，善于给出恰到好处的提示。";

        try {
            const response = await this.aiService.generateText(prompt, systemPrompt);
            return response.trim();
        } catch (error) {
            console.error('AI生成提示失败:', error);
            return "试着从不同角度思考这个故事的关键细节";
        }
    }

    private async handleStatus(session: GameSession, userId: string): Promise<GameResult> {
        const data = session.data as TurtleSoupData;

        const gameInfo = [
            `🎮 游戏状态：${this.getStateDescription(session.state)}`,
            `🎯 游戏ID：${data.gameId}`,
            `📖 故事模板：${data.template}`,
            `⏰ 游戏时长：${Math.floor((Date.now() - session.createdAt.getTime()) / 60000)} 分钟`
        ];

        if (session.state === 'PLAYING') {
            gameInfo.push(
                `❓ 已提问：${data.questionHistory.length} 个`,
                `⏳ 队列中：${data.questionQueue.length} 个`,
                `🎯 总猜测：${data.guessAttempts.length} 次`
            );

            // 显示最近3个问答
            if (data.questionHistory.length > 0) {
                gameInfo.push(`\n📝 最近问答：`);
                const recentQuestions = data.questionHistory.slice(-3);
                recentQuestions.forEach((q, index) => {
                    const answerText = this.formatAnswer(q.answer || 'unknown');
                    gameInfo.push(`${recentQuestions.length - index}. ${q.question} → ${answerText}`);
                });
            }

            // 显示当前队列
            if (data.questionQueue.length > 0) {
                gameInfo.push(`\n⏳ 等待回答：`);
                data.questionQueue.slice(0, 3).forEach((q, index) => {
                    gameInfo.push(`${index + 1}. ${q.question}`);
                });
                if (data.questionQueue.length > 3) {
                    gameInfo.push(`... 还有 ${data.questionQueue.length - 3} 个问题`);
                }
            }
        }

        if (data.winner) {
            gameInfo.push(`🏆 获胜者：${data.winner}`);
        }

        return {
            success: true,
            message: gameInfo.join('\n')
        };
    }

    private async handleEnd(session: GameSession, userId: string): Promise<GameResult> {
        const data = session.data as TurtleSoupData;

        // 检查权限：只有游戏创建者可以强制结束游戏
        if (session.createdBy !== userId) {
            return {
                success: false,
                message: "❌ 只有游戏创建者可以结束游戏"
            };
        }

        const gameStats = [
            `🏁 游戏已结束`,
            `📖 完整故事：${data.story}`,
            `🎯 真相：${data.truth}`,
            `⏰ 游戏时长：${Math.floor((Date.now() - session.createdAt.getTime()) / 60000)} 分钟`,
            `❓ 总提问：${data.questionHistory.length} 个`,
            `🎯 总猜测：${data.guessAttempts.length} 次`
        ];

        if (data.winner) {
            gameStats.splice(1, 0, `🏆 获胜者：${data.winner}`);
        }

        // 显示问答历史摘要
        if (data.questionHistory.length > 0) {
            gameStats.push(`\n📝 问答历史：`);
            data.questionHistory.forEach((q, index) => {
                const answerText = this.formatAnswer(q.answer || 'unknown');
                gameStats.push(`${index + 1}. ${q.question} → ${answerText}`);
            });
        }

        return {
            success: true,
            message: gameStats.join('\n'),
            newState: 'TIMEOUT',
            shouldEnd: true,
            broadcastToAll: true
        };
    }

    private async sendToGroup(groupId: string, message: string): Promise<void> {
        try {
            if (groupId && groupId !== 'unknown') {
                const success = await sendToGroup(groupId, message, this.oneBotApiUrl);
                if (!success) {
                    console.error('发送消息到群聊失败');
                }
            }
        } catch (error) {
            console.error('发送群聊消息时出错:', error);
        }
    }

    // 游戏状态管理
    getValidStates(): string[] {
        return ['INITIALIZING', 'STORY_READY', 'PLAYING', 'SOLVED', 'TIMEOUT'];
    }

    getStateDescription(state: string): string {
        const descriptions = {
            'INITIALIZING': '正在生成故事...',
            'STORY_READY': '故事已准备，等待开始',
            'PLAYING': '游戏进行中',
            'SOLVED': '已解开谜题',
            'TIMEOUT': '游戏超时结束'
        };
        return descriptions[state] || state;
    }

    validateTransition(fromState: string, toState: string): boolean {
        const validTransitions = {
            'INITIALIZING': ['STORY_READY'],
            'STORY_READY': ['PLAYING'],
            'PLAYING': ['SOLVED', 'TIMEOUT'],
            'SOLVED': [],
            'TIMEOUT': []
        };
        return validTransitions[fromState]?.includes(toState) || false;
    }

    private async handleStart(session: GameSession, userId: string, params?: string[]): Promise<GameResult> {
        const data = session.data as TurtleSoupData;

        if (session.state !== 'STORY_READY') {
            return {
                success: false,
                message: "❌ 游戏尚未准备就绪"
            };
        }

        let template: StoryTemplate;

        // 如果提供了参数，尝试使用指定模板
        if (params && params.length > 0) {
            const templateId = params[0];
            const specifiedTemplate = this.configManager.getTemplateById(templateId);

            if (!specifiedTemplate) {
                // 如果模板ID不存在，列出可用模板
                const availableTemplates = this.configManager.getAllTemplates()
                    .map(t => `${t.id}: ${t.name} (${t.difficulty})`)
                    .join('\n');

                return {
                    success: false,
                    message: `❌ 模板 "${templateId}" 不存在\n\n📚 可用模板：\n${availableTemplates}\n\n💡 使用方式：turtle-start [模板ID]`
                };
            }

            template = specifiedTemplate;
            console.log(`使用指定模板: ${templateId}`);
        } else {
            // 如果没有指定模板，使用随机模板
            template = this.getRandomTemplate();
            console.log(`使用随机模板: ${template.id}`);
        }

        try {
            // 生成故事
            const storyResult = await this.generateStory(template);

            // 更新游戏数据
            data.story = storyResult.story;
            data.opening = storyResult.opening;
            data.truth = storyResult.truth;
            data.template = template.name;

            // 记录当前会话信息用于后续通知
            this.setCurrentSession(session.channelId, userId);

            return {
                success: true,
                message: [
                    `🐢 海龟汤游戏开始！`,
                    ``,
                    `📖 故事：${data.opening}`,
                    ``,
                    `🎯 游戏ID：${data.gameId}`,
                    `📋 使用模板：${data.template} (${template.id})`,
                    `⭐ 难度：${template.difficulty}`,
                    ``,
                    `💡 使用说明：`,
                    `• 群聊提问：喵喵 turtle-ask [问题]`,
                    `• 私聊猜测：喵喵 turtle-guess ${data.gameId} [答案]`,
                    `• 获取提示：喵喵 turtle-hint`,
                    `• 查看状态：喵喵 turtle-status`,
                    ``,
                    `🎮 开始推理吧！只能问"是/否"问题哦~`
                ].join('\n'),
                newState: 'PLAYING'
            };
        } catch (error) {
            console.error('生成故事失败:', error);
            return {
                success: false,
                message: "❌ 生成故事失败，请重试"
            };
        }
    }

    private async evaluateGuess(truth: string, guess: string): Promise<{
        isCorrect: boolean;
        similarity: number;
        feedback: string;
    }> {
        const prompt = `
评估玩家对海龟汤真相的猜测：

标准答案：${truth}
玩家猜测：${guess}

请评估：
1. 猜测是否正确（similarity > 80% 视为正确）
2. 相似度（0-100的整数）
3. 给出有用的反馈

评估标准：
- 90-100%：完全正确或几乎完全正确
- 70-89%：非常接近，抓住了关键要素
- 50-69%：部分正确，但缺少重要细节
- 30-49%：有一定联系，但偏离较多
- 0-29%：完全错误或无关

以JSON格式回复：
{
  "isCorrect": false,
  "similarity": 65,
  "feedback": "接近了！但还缺少关键细节..."
}
`;

        const systemPrompt = "你是一个公正的海龟汤游戏评判员，能够客观评估答案的准确性。";

        try {
            const response = await this.aiService.generateJsonResponse(prompt, systemPrompt);
            return {
                isCorrect: response.isCorrect || false,
                similarity: response.similarity || 0,
                feedback: response.feedback || "请继续尝试"
            };
        } catch (error) {
            console.error('AI评估猜测失败:', error);
            return {
                isCorrect: false,
                similarity: 0,
                feedback: "评估失败，请重试"
            };
        }
    }



    private async handleAsk(session: GameSession, userId: string, params: string[]): Promise<GameResult> {
        const data = session.data as TurtleSoupData;

        if (session.state !== 'PLAYING') {
            return {
                success: false,
                message: "❌ 游戏未在进行中"
            };
        }

        if (params.length === 0) {
            return {
                success: false,
                message: "❌ 请提供问题内容"
            };
        }

        const question = params.join(' ');

        // 检查冷却时间
        const now = Date.now();
        if (now - data.lastQuestionTime < data.questionCooldown * 1000) {
            const remaining = Math.ceil((data.questionCooldown * 1000 - (now - data.lastQuestionTime)) / 1000);
            return {
                success: false,
                message: `❌ 提问冷却中，请等待 ${remaining} 秒`
            };
        }

        // 添加到队列
        const questionEntry: QuestionEntry = {
            userId,
            userName: userId, // 这里可以从 session 中获取用户名
            question,
            timestamp: now,
            position: data.questionQueue.length + 1
        };

        data.questionQueue.push(questionEntry);
        data.lastQuestionTime = now;

        // 如果没有正在处理的问题，立即处理
        if (!data.isWaitingAnswer) {
            return this.processNextQuestion(session);
        }

        return {
            success: true,
            message: `✅ 问题已加入队列（第 ${questionEntry.position} 位）`,
            updateData: { questionQueue: data.questionQueue, lastQuestionTime: data.lastQuestionTime }
        };
    }

    private async processNextQuestion(session: GameSession): Promise<GameResult> {
        const data = session.data as TurtleSoupData;

        if (data.questionQueue.length === 0) {
            data.isWaitingAnswer = false;
            return {
                success: false,
                message: "❌ 队列为空"
            };
        }

        data.isWaitingAnswer = true;
        const questionEntry = data.questionQueue.shift()!;

        try {
            // 使用内部封装的 AI 评估方法
            const evaluation = await this.evaluateQuestion(data.story, data.truth, questionEntry.question);

            questionEntry.answer = evaluation.answer;
            questionEntry.aiConfidence = evaluation.confidence;

            data.questionHistory.push(questionEntry);

            const answerText = this.formatAnswer(evaluation.answer);

            const currentResult = {
                success: true,
                message: `❓ ${questionEntry.userId}: ${questionEntry.question}\n🤖 ${answerText}`,
                updateData: {
                    questionHistory: data.questionHistory,
                    questionQueue: data.questionQueue,
                    isWaitingAnswer: false
                }
            };

            // 检查队列中是否还有待处理的问题
            if (data.questionQueue.length > 0) {
                // 异步处理下一个问题，避免阻塞当前响应
                setTimeout(async () => {
                    try {
                        const nextResult = await this.processNextQuestion(session);
                        if (nextResult.success && this.currentSessionInfo) {
                            // 发送下一个问题的回答到群聊
                            await this.sendToGroup(this.currentSessionInfo.groupId, nextResult.message);
                        }
                    } catch (error) {
                        console.error('处理队列中下一个问题时出错:', error);
                        data.isWaitingAnswer = false;
                    }
                }, 2000); // 延迟2秒处理下一个问题，给用户阅读时间
            } else {
                data.isWaitingAnswer = false;
            }

            return currentResult;

        } catch (error) {
            data.isWaitingAnswer = false;
            console.error('AI评估问题失败:', error);

            // 如果当前问题处理失败，继续处理队列中的下一个问题
            if (data.questionQueue.length > 0) {
                setTimeout(async () => {
                    await this.processNextQuestion(session);
                }, 1000);
            }

            return {
                success: false,
                message: "❌ AI 评估失败，请稍后重试"
            };
        }
    }


    // 海龟汤专用的 AI 方法封装
    private async evaluateQuestion(story: string, truth: string, question: string): Promise<{
        answer: 'yes' | 'no' | 'irrelevant';
        explanation?: string;
        confidence: number;
    }> {
        const prompt = `
作为海龟汤游戏的主持人，请评估以下问题：

完整故事背景：${story}
真相：${truth}
玩家问题：${question}

请根据故事背景和真相，判断这个问题的答案：
- "yes": 如果问题的答案是肯定的
- "no": 如果问题的答案是否定的  
- "irrelevant": 如果问题与故事无关或无法明确回答

请以JSON格式回复：
{
  "answer": "yes/no/irrelevant",
  "explanation": "简短解释（可选）",
  "confidence": 0.8
}
`;

        const systemPrompt = "你是一个专业的海龟汤游戏主持人，擅长逻辑推理和故事分析。";

        try {
            const response = await this.aiService.generateJsonResponse(prompt, systemPrompt);
            return {
                answer: response.answer || 'irrelevant',
                explanation: response.explanation,
                confidence: response.confidence || 0.5
            };
        } catch (error) {
            console.error('AI评估问题失败:', error);
            return {
                answer: 'irrelevant',
                confidence: 0.1
            };
        }
    }
    // 设置会话查找器的方法
    setSessionFinder(finder: (gameId: string) => GameSession | undefined): void {
        this.sessionFinder = finder;
    }

    private async handleGuess(gameId: string, userId: string, params: string[]): Promise<GameResult> {
        // 检查参数
        if (params.length === 0) {
            return {
                success: false,
                message: "❌ 请提供猜测内容"
            };
        }

        // 获取对应的游戏会话
        if (!this.sessionFinder) {
            return {
                success: false,
                message: "❌ 系统错误：无法获取游戏会话"
            };
        }

        const session = this.sessionFinder(gameId);
        if (!session) {
            return {
                success: false,
                message: "❌ 游戏不存在或已结束"
            };
        }

        const data = session.data as TurtleSoupData;

        // 检查游戏状态
        if (session.state !== 'PLAYING') {
            return {
                success: false,
                message: "❌ 游戏未在进行中"
            };
        }

        // 检查用户是否已经猜测过多次
        const userGuesses = data.guessAttempts.filter(g => g.userId === userId);
        if (userGuesses.length >= data.maxGuessesPerUser) {
            return {
                success: false,
                message: `❌ 您已经用完了 ${data.maxGuessesPerUser} 次猜测机会`
            };
        }

        // 检查猜测冷却时间
        const now = Date.now();
        const lastGuessTime = data.guessCooldowns.get(userId) || 0;
        const cooldownTime = 30 * 1000; // 30秒冷却

        if (now - lastGuessTime < cooldownTime) {
            const remaining = Math.ceil((cooldownTime - (now - lastGuessTime)) / 1000);
            return {
                success: false,
                message: `❌ 猜测冷却中，请等待 ${remaining} 秒`
            };
        }

        const guess = params.join(' ');
        try {
            // 使用 AI 评估猜测
            const evaluation = await this.evaluateGuess(data.truth, guess);

            // 记录猜测
            const guessEntry: GuessEntry = {
                userId,
                userName: userId,
                guess,
                isCorrect: evaluation.isCorrect,
                similarity: evaluation.similarity,
                feedback: evaluation.feedback,
                timestamp: now
            };

            data.guessAttempts.push(guessEntry);
            data.guessCooldowns.set(userId, now);

            // 如果猜测正确
            if (evaluation.isCorrect) {
                data.winner = userId;
                session.state = 'SOLVED';

                // 私聊回复
                const privateMessage = [
                    `🎉 恭喜！您猜对了！`,
                    ``,
                    `🎯 您的猜测：${guess}`,
                    `📊 相似度：${evaluation.similarity}%`,
                    `💬 ${evaluation.feedback}`,
                    ``,
                    `🏁 游戏结果即将在群聊中公布！`
                ].join('\n');

                // 异步通知群聊（不阻塞响应）
                setTimeout(() => {
                    this.notifyGameEnd(session, userId);
                }, 1000); // 延迟1秒发送，确保私聊消息先到达

                return {
                    success: true,
                    message: privateMessage,
                    newState: 'SOLVED',
                    shouldEnd: true
                };
            } else {
                // 猜测错误，给出反馈
                const remainingAttempts = data.maxGuessesPerUser - userGuesses.length - 1;

                let responseMessage = [
                    `🎯 猜测已评估`,
                    ``,
                    `📊 相似度：${evaluation.similarity}%`,
                    // `💬 反馈：${evaluation.feedback}`,
                    ``,
                    `⏳ 剩余猜测次数：${remainingAttempts}`
                ];

                // 根据相似度给出鼓励
                if (evaluation.similarity >= 70) {
                    responseMessage.push(`💡 非常接近了！继续加油！`);
                } else if (evaluation.similarity >= 50) {
                    responseMessage.push(`💡 有一定道理，但还需要更多细节`);
                } else if (evaluation.similarity >= 30) {
                    responseMessage.push(`💡 方向有些偏离，重新思考一下`);
                } else {
                    responseMessage.push(`💡 建议先在群聊中多问几个问题`);
                }

                if (remainingAttempts === 0) {
                    responseMessage.push(`❌ 您的猜测次数已用完`);
                }

                return {
                    success: true,
                    message: responseMessage.join('\n'),
                    updateData: {
                        guessAttempts: data.guessAttempts,
                        guessCooldowns: data.guessCooldowns
                    }
                };
            }

        } catch (error) {
            console.error('评估猜测时出错:', error);
            return {
                success: false,
                message: "❌ 评估失败，请稍后重试"
            };
        }
    }
    // 辅助方法
    private generateGameId(): string {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // 修改获取随机模板方法
    private getRandomTemplate(): StoryTemplate {
        const template = this.configManager.getRandomTemplate();
        if (!template) {
            throw new Error('没有可用的故事模板');
        }
        return template;
    }

    private async generateStory(template: StoryTemplate): Promise<{ story: string, opening: string, truth: string }> {
        const prompt = `
基于以下模板生成一个海龟汤故事：

模板信息：
- 名称：${template.name}
- 类别：${template.category}
- 难度：${template.difficulty}
- 模板：${template.template}
- 变量：${template.variables?.join(', ') || '无'}

请生成：
1. story: 完整的故事背景（包含所有关键细节和因果关系）
2. opening: 游戏开头的一句话描述（吸引人但不透露关键信息）
3. truth: 简洁明了的真相答案

要求：
- 故事要有逻辑性和合理性
- 开头要引人入胜但不剧透
- 真相要简洁但完整
- 适合${template.difficulty}难度等级

以JSON格式回复：
{
  "story": "详细的完整故事...",
  "opening": "吸引人的开头描述...",
  "truth": "简洁的真相答案..."
}
`;

        const systemPrompt = "你是一个创意丰富的海龟汤故事创作者，善于创造有趣且逻辑严密的推理故事。";

        try {
            const response = await this.aiService.generateJsonResponse(prompt, systemPrompt);
            return {
                story: response.story || "故事生成失败",
                opening: response.opening || "游戏开头生成失败",
                truth: response.truth || "真相生成失败"
            };
        } catch (error) {
            console.error('AI生成故事失败:', error);
            // 返回默认故事
            return {
                story: "一个男人在深夜独自在家，突然听到楼下传来奇怪的声音。他小心翼翼地下楼查看，发现客厅的窗户开着，地上有水迹。第二天早上，邻居发现这个男人死在了自己家门口。",
                opening: "一个男人深夜听到楼下有声音，第二天早上被发现死在家门口。",
                truth: "男人是个梦游者，听到声音后梦游下楼，从开着的窗户掉了出去。水迹是雨水。"
            };
        }
    }


    private formatAnswer(answer: string): string {
        const answers = {
            'yes': '是的 ✅',
            'no': '不是 ❌',
            'irrelevant': '无关 🤷‍♂️'
        };
        return answers[answer] || answer;
    }

    private async notifyGameEnd(session: GameSession, winnerId: string): Promise<void> {
        const data = session.data as TurtleSoupData;

        // 生成游戏结束的群聊消息
        const groupMessage = [
            `🏆 恭喜 ${winnerId} 猜对了！`,
            ``,
            `🏁 海龟汤游戏结束！`,
            ``,
            `📖 完整故事：${data.story}`,
            ``,
            `🎯 真相：${data.truth}`,
            ``,
            `📊 游戏统计：`,
            `⏰ 游戏时长：${Math.floor((Date.now() - session.createdAt.getTime()) / 60000)} 分钟`,
            `❓ 总提问：${data.questionHistory.length} 个`,
            `🎯 总猜测：${data.guessAttempts.length} 次`
        ].join('\n');

        try {
            // 通过会话信息获取群ID
            const groupId = this.currentSessionInfo?.groupId || session.channelId;

            if (groupId && groupId !== 'unknown') {
                // 发送到群聊
                const success = await sendToGroup(groupId, groupMessage, this.oneBotApiUrl);

                if (success) {
                    console.log('游戏结束消息已发送到群聊:', groupId);
                } else {
                    console.error('发送游戏结束消息到群聊失败');
                }
            } else {
                console.warn('无法获取群聊ID，无法发送游戏结束消息');
            }
        } catch (error) {
            console.error('发送游戏结束消息时出错:', error);
        }
    }

    getConfigStats(): string {
        const stats = this.configManager.getStats();
        const categories = stats.categoriesWithCount.map(c => `${c.category}: ${c.count}`).join(', ');
        const difficulty = `简单: ${stats.difficultyDistribution.easy}, 中等: ${stats.difficultyDistribution.medium}, 困难: ${stats.difficultyDistribution.hard}`;

        return `📊 海龟汤配置统计:\n📚 总模板数: ${stats.totalTemplates}\n📁 分类分布: ${categories}\n⭐ 难度分布: ${difficulty}`;
    }
}