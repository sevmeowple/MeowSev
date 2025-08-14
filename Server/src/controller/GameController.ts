import { Elysia } from "elysia";
import { RouteRegistry } from "../routes/registry";
import { ContextService } from "../service/Base/Base_ContextService";
import { TurtleSoupGameHandler } from "../service/Game/TurtleSoup";
import { getTextToImageService } from "../service/TextToImageService";
import {
  MessageObject,
  SessionData,
  extractGameSessionInfo,
  extractRequestData,
  validateParams,
  createErrorMessage,
  createTextMessage,
  createInfoMessage
} from "../utils/message";
import { ConfigUnion } from "../config/config";
import { paramCase } from "koishi";

// 注册游戏相关路由
RouteRegistry.registerBatch([
  'game-create',
  'game-join',
  'game-status',
  'game-list',
  'game-end',
  // 海龟汤专用路由
  'turtle-start',
  'turtle-ask',
  'turtle-hint',
  'turtle-status',
  'turtle-end',
  'turtle-guess',
  'turtle-config'
]);

// 初始化服务
const contextService = new ContextService(ConfigUnion);
const turtleSoupHandler = new TurtleSoupGameHandler(ConfigUnion);
const textToImageService = getTextToImageService();

// 注册海龟汤游戏处理器
contextService.registerGameHandler(turtleSoupHandler);

// 定期清理过期图片
setInterval(() => {
  textToImageService.cleanupOldImages();
}, 6 * 60 * 60 * 1000); // 每6小时清理一次

/**
 * 辅助函数：判断是否需要渲染为图片
 */
function shouldRenderAsImage(message: string): boolean {
  // 检查消息长度
  if (message.length > 200) return true;

  // 检查特定关键词
  const imageKeywords = [
    '游戏开始', '游戏结束', '🐢', '🏁', '📖', '📊',
    '游戏状态', '真相', '完整故事', '恭喜'
  ];

  return imageKeywords.some(keyword => message.includes(keyword));
}

/**
 * 辅助函数：创建文本或图片消息
 */
async function createGameMessage(result: any, img: boolean = false, must?: boolean): Promise<MessageObject> {
  // 如果消息较长或包含特定内容，渲染为图片

  // 如果存在must参数,则must为true,则强制渲染为图片,为false强制渲染为文本
  if (must) {
    img = true;
  }
  else if (must === false) {
    return createTextMessage(result.message);
  }

  if (shouldRenderAsImage(result.message || img)) {
    try {
      const imagePath = await textToImageService.renderGameText(result.message);
      return {
        type: "image",
        src: `file://${imagePath}`,
        alt: "游戏消息图片",
        content: result.message.substring(0, 50) + "..." // 简短的alt文本
      };
    } catch (imageError) {
      console.error('渲染图片失败，回退到文本:', imageError);
      return createTextMessage(result.message);
    }
  } else {
    return createTextMessage(result.message);
  }
}

export const gameController = new Elysia()
  // ========== 通用游戏管理 ==========
  .post("/game-create", async ({ body }): Promise<MessageObject> => {
    console.log('Game create endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, params, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session 和 params");
    }

    const validation = validateParams(params, 1, "请指定游戏类型，例如：喵喵 game-create turtle-soup");
    if (!validation.isValid) {
      return validation.error!;
    }

    try {
      const [gameType] = params;
      const gameInfo = extractGameSessionInfo(session);

      const result = await contextService.createSession(
        gameInfo.platform,
        gameInfo.selfId,
        gameInfo.channelId,
        gameType,
        gameInfo.userId
      );

      return createTextMessage(result.message);
    } catch (error) {
      return createErrorMessage(`创建游戏失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  .post("/game-join", async ({ body }): Promise<MessageObject> => {
    console.log('Game join endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session");
    }

    try {
      const gameInfo = extractGameSessionInfo(session);

      const result = await contextService.joinGame(
        gameInfo.platform,
        gameInfo.selfId,
        gameInfo.channelId,
        gameInfo.userId
      );

      return createTextMessage(result.message);
    } catch (error) {
      return createErrorMessage(`加入游戏失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  .post("/game-status", ({ body }): MessageObject => {
    console.log('Game status endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session");
    }

    const gameInfo = extractGameSessionInfo(session);
    const status = contextService.getSessionStatus(
      gameInfo.platform,
      gameInfo.selfId,
      gameInfo.channelId
    );

    return createTextMessage(status);
  })

  .post("/game-list", ({ body }): MessageObject => {
    console.log('Game list endpoint 收到请求');

    const availableGames = contextService.getAvailableGames();
    return createTextMessage(availableGames);
  })

  .post("/game-end", async ({ body }): Promise<MessageObject> => {
    console.log('Game end endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session");
    }

    try {
      const gameInfo = extractGameSessionInfo(session);

      const result = await contextService.handleGameCommand(
        gameInfo.platform,
        gameInfo.selfId,
        gameInfo.channelId,
        gameInfo.userId,
        'end',
        []
      );

      return await createGameMessage(result);
    } catch (error) {
      return createErrorMessage(`结束游戏失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  // ========== 海龟汤专用路由 ==========
  .post("/turtle-start", async ({ body }): Promise<MessageObject> => {
    console.log('Turtle start endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, params, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session");
    }

    try {
      const gameInfo = extractGameSessionInfo(session);

      const result = await contextService.handleGameCommand(
        gameInfo.platform,
        gameInfo.selfId,
        gameInfo.channelId,
        gameInfo.userId,
        'turtle-start',
        params || []
      );

      return await createGameMessage(result, true, false);
    } catch (error) {
      return createErrorMessage(`开始游戏失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  .post("/turtle-ask", async ({ body }): Promise<MessageObject> => {
    console.log('Turtle ask endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, params, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session 和 params");
    }

    const validation = validateParams(params, 1, "请提供问题内容，例如：喵喵 turtle-ask 这个人是自杀的吗？");
    if (!validation.isValid) {
      return validation.error!;
    }

    try {
      const gameInfo = extractGameSessionInfo(session);

      const result = await contextService.handleGameCommand(
        gameInfo.platform,
        gameInfo.selfId,
        gameInfo.channelId,
        gameInfo.userId,
        'turtle-ask',
        params
      );

      return createTextMessage(result.message);
    } catch (error) {
      return createErrorMessage(`提问失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  .post("/turtle-hint", async ({ body }): Promise<MessageObject> => {
    console.log('Turtle hint endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session");
    }

    try {
      const gameInfo = extractGameSessionInfo(session);

      const result = await contextService.handleGameCommand(
        gameInfo.platform,
        gameInfo.selfId,
        gameInfo.channelId,
        gameInfo.userId,
        'turtle-hint',
        []
      );

      return createTextMessage(result.message);
    } catch (error) {
      return createErrorMessage(`获取提示失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  .post("/turtle-status", async ({ body }): Promise<MessageObject> => {
    console.log('Turtle status endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session");
    }

    try {
      const gameInfo = extractGameSessionInfo(session);

      const result = await contextService.handleGameCommand(
        gameInfo.platform,
        gameInfo.selfId,
        gameInfo.channelId,
        gameInfo.userId,
        'turtle-status',
        []
      );

      return await createGameMessage(result);
    } catch (error) {
      return createErrorMessage(`获取状态失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  .post("/turtle-end", async ({ body }): Promise<MessageObject> => {
    console.log('Turtle end endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, isValid } = extractRequestData(body);
    if (!isValid || !session) {
      return createErrorMessage("请求格式错误，需要 session");
    }

    try {
      const gameInfo = extractGameSessionInfo(session);

      const result = await contextService.handleGameCommand(
        gameInfo.platform,
        gameInfo.selfId,
        gameInfo.channelId,
        gameInfo.userId,
        'turtle-end',
        []
      );

      return await createGameMessage(result, true, false);
    } catch (error) {
      return createErrorMessage(`结束游戏失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  .post("/turtle-guess", async ({ body }): Promise<MessageObject> => {
    console.log('Turtle guess endpoint 收到请求:', JSON.stringify(body, null, 2));

    const { session, params, isValid } = extractRequestData(body);
    if (!isValid) {
      return createErrorMessage("请求格式错误，需要 session 和 params");
    }

    const validation = validateParams(params, 2, "请提供游戏ID和猜测内容，例如：喵喵 turtle-guess ABC123 我觉得是...");
    if (!validation.isValid) {
      return validation.error!;
    }

    try {
      const [gameId, ...guessWords] = params;
      const guess = guessWords.join(' ');

      // 从 session 中获取用户ID（私聊场景）
      const userId = session ? extractGameSessionInfo(session).userId : 'private-user';

      const result = await contextService.handlePrivateCommand(gameId, userId, 'guess', [guess]);

      return createTextMessage(result.message);
    } catch (error) {
      return createErrorMessage(`猜测失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  })

  .post("/turtle-config", ({ body }): MessageObject => {
    console.log('Turtle config endpoint 收到请求:', JSON.stringify(body, null, 2));

    try {
      const stats = turtleSoupHandler.getConfigStats();
      return createTextMessage(stats);
    } catch (error) {
      console.error('获取海龟汤配置失败:', error);
      return createErrorMessage("获取配置信息失败");
    }
  });