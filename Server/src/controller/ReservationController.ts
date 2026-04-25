import { Elysia } from "elysia";
import { RouteRegistry } from "@/routes/registry";
import { HelpRegistry } from "@/utils/HelpRegistry";
import { authPlugin } from "@/middleware/auth";
import {
  MessageObject,
  SessionData,
  extractGameSessionInfo,
  getUserDisplayName,
  createErrorMessage,
  createSuccessMessage,
} from "@/utils/message";
import { ReservationService } from "@/service/ReservationService";
import { ConfigUnion } from "@/config/config";
import { tsxToPic } from "@/utils/plugin/browser/tsxToPic";
import { ReservationListCard, ReservationDetailCard } from "@/view/ReservationCard";
import { sendToGroup } from "@/utils/message";

// 注册路由和帮助信息
RouteRegistry.registerBatch([
  "预约",
  "预约创建",
  "预约关闭",
  "预约列表",
  "预约详情",
  "预约提醒",
]);

HelpRegistry.register({
  command: "预约",
  description: "参与预约或查看预约详情",
  usage: "预约 [预约ID] [选项序号/取消] | 预约详情 [ID] | 预约列表",
  examples: [
    "预约 1 1          # 预约#1选择选项1",
    "预约 1 1,2        # 预约#1选择选项1和2（多选模式）",
    "预约 1 取消       # 取消预约#1的参与",
    "预约列表          # 查看所有预约",
    "预约详情 1        # 查看预约#1详情",
  ],
  details:
    '用户参与预约的单条命令。单选模式只能选一个选项，多选模式可以选多个（用逗号分隔）。发送"预约详情 [ID]"查看详情卡片，发送"预约列表"查看所有进行中的预约。',
});

HelpRegistry.register({
  command: "预约创建",
  description: "创建新的预约（仅限超级管理员）",
  usage:
    '预约创建 标题=xxx 描述=xxx 选项=A,B,C 模式=[单选/多选] 截止=[可选]',
  examples: [
    "预约创建 标题=周末聚餐 描述=周六晚上7点 选项=参加,不参加,待定 模式=单选",
    "预约创建 标题=活动报名 描述=下周活动 选项=方案A,方案B,方案C 模式=多选 截止=2025-03-10 18:00",
  ],
  details:
    '创建新的预约活动。选项用逗号分隔，模式可以是"单选"或"多选"。创建成功后系统会返回预约详情，并提示可以上传封面图片（60秒内发送图片即可）。',
});

HelpRegistry.register({
  command: "预约关闭",
  description: "关闭预约（仅限超级管理员）",
  usage: "预约关闭 [预约ID]",
  examples: ["预约关闭 5"],
  details: "关闭指定的预约，关闭后用户不能再参与或修改选择。",
});

HelpRegistry.register({
  command: "预约提醒",
  description: "设置预约截止提醒（仅限超级管理员）",
  usage: "预约提醒 [预约ID] [提前分钟数]",
  examples: ["预约提醒 5 30  # 预约#5截止前30分钟提醒"],
  details: "为指定预约设置截止前提醒，将在截止前指定时间发送提醒消息到群聊。",
});

// 初始化服务
const reservationService = new ReservationService(ConfigUnion);

// 封面图等待列表（用户ID -> {reservationId, timeout}）
const coverImageWaitList = new Map<
  string,
  { reservationId: number; timeout: NodeJS.Timeout }
>();

export const reservationController = new Elysia()
  .use(authPlugin)
  // 统一入口 - 根据子命令分发
  .post("/预约", async ({ body }): Promise<MessageObject> => {
    const { session, params } = body as {
      session: SessionData;
      params?: string[];
    };

    if (!session) {
      return createErrorMessage("无法获取会话信息");
    }

    const { groupId, userId } = extractGameSessionInfo(session);
    if (!groupId || groupId === "unknown") {
      return createErrorMessage("请在群聊中使用此功能");
    }

    if (!params || params.length === 0) {
      return createErrorMessage("参数不足。用法: 预约 [预约ID] [选项序号] 或 预约列表");
    }

    const subCommand = params[0];

    // 子命令分发
    switch (subCommand) {
      case "创建":
      case "create":
        return createErrorMessage("请使用专用命令: 预约创建");
      case "关闭":
      case "close":
        return createErrorMessage("请使用专用命令: 预约关闭");
      case "列表":
      case "list":
        return handleList(session, groupId);
      case "详情":
      case "detail":
        return handleDetail(session, groupId, params.slice(1));
      case "提醒":
      case "reminder":
        return createErrorMessage("请使用专用命令: 预约提醒");
      default:
        // 直接参与预约: 预约 [ID] [选项]
        return handleMakeChoice(session, groupId, userId, getUserDisplayName(session), params);
    }
  })
  // 创建预约（superadmin only）
  .post("/预约创建", async ({ body }): Promise<MessageObject> => {
    const { session, params } = body as {
      session: SessionData;
      params?: string[];
    };

    if (!session) {
      return createErrorMessage("无法获取会话信息");
    }

    const { groupId, channelId, userId } = extractGameSessionInfo(session);
    if (!groupId || groupId === "unknown") {
      return createErrorMessage("请在群聊中使用此功能");
    }

    if (!params || params.length === 0) {
      return createErrorMessage(
        "参数不足。用法: 预约创建 标题=xxx 描述=xxx 选项=A,B,C 模式=单选/多选 [截止=2025-03-10 18:00]"
      );
    }

    // 解析参数
    const parsed = parseCreateParams(params.join(" "));
    if (!parsed.success) {
      return createErrorMessage(parsed.error || "参数解析失败");
    }

    const { title, description, options, mode, deadline } = parsed.data;

    if (!title) {
      return createErrorMessage("缺少标题参数");
    }
    if (!options || options.length === 0) {
      return createErrorMessage("缺少选项参数");
    }
    if (options.length > 10) {
      return createErrorMessage("选项数量不能超过10个");
    }

    try {
      const reservation = await reservationService.createReservation({
        title,
        description,
        options: options.map((label) => ({ label })),
        selectionMode: mode === "多选" ? "multiple" : "single",
        groupId,
        channelId,
        creatorId: userId,
        creatorName: getUserDisplayName(session),
        deadline,
      });

      // 设置封面图等待（60秒）
      setupCoverImageWait(userId, reservation.id!);

      // 获取详情生成卡片
      const detail = await reservationService.getReservationDetail(reservation.id!);
      const stats = await reservationService.getOptionStats(reservation.id!);

      if (detail) {
        const picPath = await tsxToPic(
          ReservationDetailCard,
          { reservation: detail, optionStats: stats },
          { width: 700, outputFileName: `reservation_${reservation.id}` }
        );

        return {
          type: "image",
          src: `file://${picPath}`,
        } as MessageObject;
      }

      return createSuccessMessage(
        `预约 #${reservation.id} 「${reservation.title}」创建成功！\n📎 如需添加封面图，请在60秒内发送图片`
      );
    } catch (error) {
      console.error("创建预约失败:", error);
      return createErrorMessage("创建预约失败，请稍后重试");
    }
  }, { requireSuperAdmin: true })
  // 关闭预约（superadmin only）
  .post("/预约关闭", async ({ body }): Promise<MessageObject> => {
    const { session, params } = body as {
      session: SessionData;
      params?: string[];
    };

    if (!session) {
      return createErrorMessage("无法获取会话信息");
    }

    if (!params || params.length === 0) {
      return createErrorMessage("参数不足。用法: 预约关闭 [预约ID]");
    }

    const reservationId = parseInt(params[0]);
    if (isNaN(reservationId)) {
      return createErrorMessage("无效的预约ID");
    }

    try {
      const success = await reservationService.closeReservation(reservationId);
      if (success) {
        return createSuccessMessage(`预约 #${reservationId} 已关闭`);
      } else {
        return createErrorMessage("预约不存在或已关闭");
      }
    } catch (error) {
      console.error("关闭预约失败:", error);
      return createErrorMessage("关闭预约失败");
    }
  }, { requireSuperAdmin: true })
  // 预约列表
  .post("/预约列表", async ({ body }): Promise<MessageObject> => {
    const { session } = body as { session: SessionData };

    if (!session) {
      return createErrorMessage("无法获取会话信息");
    }

    const { groupId } = extractGameSessionInfo(session);
    if (!groupId || groupId === "unknown") {
      return createErrorMessage("请在群聊中使用此功能");
    }

    return handleList(session, groupId);
  })
  // 预约详情
  .post("/预约详情", async ({ body }): Promise<MessageObject> => {
    const { session, params } = body as {
      session: SessionData;
      params?: string[];
    };

    if (!session) {
      return createErrorMessage("无法获取会话信息");
    }

    const { groupId } = extractGameSessionInfo(session);
    if (!groupId || groupId === "unknown") {
      return createErrorMessage("请在群聊中使用此功能");
    }

    return handleDetail(session, groupId, params || []);
  })
  // 设置提醒（superadmin only）
  .post("/预约提醒", async ({ body }): Promise<MessageObject> => {
    const { session, params } = body as {
      session: SessionData;
      params?: string[];
    };

    if (!session) {
      return createErrorMessage("无法获取会话信息");
    }

    if (!params || params.length < 2) {
      return createErrorMessage("参数不足。用法: 预约提醒 [预约ID] [提前分钟数]");
    }

    const reservationId = parseInt(params[0]);
    const minutes = parseInt(params[1]);

    if (isNaN(reservationId) || isNaN(minutes) || minutes <= 0) {
      return createErrorMessage("无效的参数");
    }

    try {
      const result = await reservationService.setReminder(reservationId, minutes);
      if (result.success) {
        return createSuccessMessage(result.message);
      } else {
        return createErrorMessage(result.message);
      }
    } catch (error) {
      console.error("设置提醒失败:", error);
      return createErrorMessage("设置提醒失败");
    }
  }, { requireSuperAdmin: true });

// ============ 处理器函数 ============

async function handleList(session: SessionData, groupId: string): Promise<MessageObject> {
  try {
    const reservations = await reservationService.getAllReservations(groupId);

    const picPath = await tsxToPic(
      ReservationListCard,
      { reservations, groupName: "本群" },
      { width: 600, outputFileName: `reservation_list_${groupId}` }
    );

    return {
      type: "image",
      src: `file://${picPath}`,
    } as MessageObject;
  } catch (error) {
    console.error("获取预约列表失败:", error);
    return createErrorMessage("获取预约列表失败");
  }
}

async function handleDetail(
  session: SessionData,
  groupId: string,
  params: string[]
): Promise<MessageObject> {
  if (!params || params.length === 0) {
    return createErrorMessage("参数不足。用法: 预约详情 [预约ID]");
  }

  const reservationId = parseInt(params[0]);
  if (isNaN(reservationId)) {
    return createErrorMessage("无效的预约ID");
  }

  try {
    const detail = await reservationService.getReservationDetail(reservationId);

    if (!detail) {
      return createErrorMessage("预约不存在");
    }

    // 检查是否属于当前群聊
    if (detail.group_id !== groupId) {
      return createErrorMessage("该预约不在当前群聊中");
    }

    const stats = await reservationService.getOptionStats(reservationId);
    const userId = session.user.id;

    const picPath = await tsxToPic(
      ReservationDetailCard,
      {
        reservation: detail,
        optionStats: stats,
        highlightUserId: userId,
      },
      { width: 700, outputFileName: `reservation_detail_${reservationId}` }
    );

    return {
      type: "image",
      src: `file://${picPath}`,
    } as MessageObject;
  } catch (error) {
    console.error("获取预约详情失败:", error);
    return createErrorMessage("获取预约详情失败");
  }
}

async function handleMakeChoice(
  session: SessionData,
  groupId: string,
  userId: string,
  userName: string,
  params: string[]
): Promise<MessageObject> {
  if (params.length < 2) {
    return createErrorMessage("参数不足。用法: 预约 [预约ID] [选项序号/取消]");
  }

  const reservationId = parseInt(params[0]);
  if (isNaN(reservationId)) {
    return createErrorMessage("无效的预约ID");
  }

  const choiceParam = params[1];

  // 处理取消
  if (choiceParam === "取消" || choiceParam === "cancel") {
    try {
      const result = await reservationService.cancelChoice(reservationId, userId);
      if (result.success) {
        // 返回更新后的详情
        return handleDetail(session, groupId, [params[0]]);
      } else {
        return createErrorMessage(result.message);
      }
    } catch (error) {
      console.error("取消预约失败:", error);
      return createErrorMessage("取消预约失败");
    }
  }

  // 处理选择
  const selectedOptions = choiceParam
    .split(/[,，]/)
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));

  if (selectedOptions.length === 0) {
    return createErrorMessage("无效的选项序号");
  }

  try {
    const result = await reservationService.makeChoice(
      reservationId,
      userId,
      userName,
      selectedOptions
    );

    if (result.success) {
      // 返回更新后的详情
      return handleDetail(session, groupId, [params[0]]);
    } else {
      return createErrorMessage(result.message);
    }
  } catch (error) {
    console.error("提交选择失败:", error);
    return createErrorMessage("提交选择失败");
  }
}

// ============ 工具函数 ============

function parseCreateParams(input: string): {
  success: boolean;
  data?: {
    title?: string;
    description?: string;
    options?: string[];
    mode?: string;
    deadline?: number;
  };
  error?: string;
} {
  const data: {
    title?: string;
    description?: string;
    options?: string[];
    mode?: string;
    deadline?: number;
  } = {};

  // 匹配 key=value 格式
  const regex = /(\w+)=([^\s]+(?:\s+[^\s=]+)*?)(?=\s+\w+=|$)/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    const key = match[1];
    const value = match[2].trim();

    switch (key) {
      case "标题":
      case "title":
        data.title = value;
        break;
      case "描述":
      case "desc":
      case "description":
        data.description = value;
        break;
      case "选项":
      case "options":
        data.options = value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        break;
      case "模式":
      case "mode":
        data.mode = value;
        break;
      case "截止":
      case "deadline":
        const deadlineDate = parseDeadline(value);
        if (deadlineDate) {
          data.deadline = deadlineDate.getTime();
        }
        break;
    }
  }

  // 如果没有匹配到任何参数，尝试简单解析
  if (!data.title && input.includes(" ")) {
    const parts = input.split(/\s+/);
    if (parts.length >= 2) {
      data.title = parts[0];
      data.options = parts.slice(1).join(" ").split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  return { success: true, data };
}

function parseDeadline(value: string): Date | null {
  // 尝试解析多种格式：
  // 2025-03-10 18:00
  // 2025/03/10 18:00
  // 3-10 18:00
  // 明天 18:00
  // 18:00

  const now = new Date();

  // 处理"明天"
  if (value.startsWith("明天")) {
    const timeMatch = value.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const tomorrow = new Date(now.getTime() + 86400000);
      tomorrow.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
      return tomorrow;
    }
  }

  // 处理完整日期格式
  const fullDateMatch = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (fullDateMatch) {
    return new Date(
      parseInt(fullDateMatch[1]),
      parseInt(fullDateMatch[2]) - 1,
      parseInt(fullDateMatch[3]),
      parseInt(fullDateMatch[4]),
      parseInt(fullDateMatch[5])
    );
  }

  // 处理简化日期格式
  const shortDateMatch = value.match(/(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (shortDateMatch) {
    return new Date(
      now.getFullYear(),
      parseInt(shortDateMatch[1]) - 1,
      parseInt(shortDateMatch[2]),
      parseInt(shortDateMatch[3]),
      parseInt(shortDateMatch[4])
    );
  }

  // 处理仅时间（今天）
  const timeOnlyMatch = value.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnlyMatch) {
    const date = new Date(now);
    date.setHours(parseInt(timeOnlyMatch[1]), parseInt(timeOnlyMatch[2]), 0, 0);
    // 如果时间已过，设为明天
    if (date < now) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  return null;
}

function setupCoverImageWait(userId: string, reservationId: number) {
  // 清除之前的等待
  const existing = coverImageWaitList.get(userId);
  if (existing) {
    clearTimeout(existing.timeout);
  }

  // 设置新的等待（60秒）
  const timeout = setTimeout(() => {
    coverImageWaitList.delete(userId);
    console.log(`⏰ 用户 ${userId} 的封面图等待已超时`);
  }, 60000);

  coverImageWaitList.set(userId, { reservationId, timeout });

  // 发送提示消息
  setTimeout(async () => {
    await sendToGroup(
      "",
      `📎 预约 #${reservationId} 创建成功！\n如需添加封面图片，请在60秒内发送图片（可选）`
    );
  }, 100);
}

// 处理图片上传（用于设置封面图）
export async function handleReservationImage(
  session: SessionData,
  imageBuffer: Buffer
): Promise<boolean> {
  const userId = session.user.id;
  const waitInfo = coverImageWaitList.get(userId);

  if (!waitInfo) {
    return false; // 用户没有在等待上传封面图
  }

  try {
    await reservationService.saveCoverImage(waitInfo.reservationId, imageBuffer);

    // 清除等待
    clearTimeout(waitInfo.timeout);
    coverImageWaitList.delete(userId);

    // 发送更新后的详情
    const detail = await reservationService.getReservationDetail(waitInfo.reservationId);
    if (detail) {
      const stats = await reservationService.getOptionStats(waitInfo.reservationId);
      const picPath = await tsxToPic(
        ReservationDetailCard,
        { reservation: detail, optionStats: stats },
        { width: 700, outputFileName: `reservation_${waitInfo.reservationId}` }
      );

      await sendToGroup(
        detail.group_id,
        {
          type: "image",
          src: `file://${picPath}`,
        }
      );
    }

    return true;
  } catch (error) {
    console.error("保存封面图失败:", error);
    return false;
  }
}
