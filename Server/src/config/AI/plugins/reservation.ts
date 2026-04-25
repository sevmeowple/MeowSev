import { z } from "zod";
import type { ToolDefinition, ToolResult } from "..";
import type { SessionData } from "@/utils/message";
import { ReservationService } from "@/service/ReservationService";
import { ConfigUnion } from "@/config/config";
import { tsxToPic } from "@/utils/plugin/browser/tsxToPic";
import { ReservationDetailCard } from "@/view/ReservationCard";
import { extractGameSessionInfo, getUserDisplayName } from "@/utils/message";

// 延迟初始化预约服务（避免循环依赖）
let reservationService: ReservationService | null = null;
function getReservationService(): ReservationService {
  if (!reservationService) {
    reservationService = new ReservationService(ConfigUnion);
  }
  return reservationService;
}

/**
 * 创建预约工具
 * AI可以直接调用此工具帮用户创建预约
 */
export const createReservationTool: ToolDefinition = {
  name: "createReservation",
  description: "在群聊中创建一个新的预约/投票活动。只有超级管理员可以使用此功能创建预约。",
  inputSchema: z.object({
    title: z.string().describe("预约标题，如：周末聚餐、KTV时间投票"),
    description: z.string().optional().describe("预约描述/说明，可选"),
    options: z.array(z.string()).describe("选项列表，每个选项是一个字符串，如：['参加', '不参加', '待定']"),
    mode: z.enum(["single", "multiple"]).describe("选择模式：single(单选) 或 multiple(多选)"),
    deadline: z.string().optional().describe("截止时间，格式：YYYY-MM-DD HH:mm 或相对时间如'明天 18:00'，可选"),
  }),
  execute: async (
    params: {
      title: string;
      description?: string;
      options: string[];
      mode: "single" | "multiple";
      deadline?: string;
    },
    session?: SessionData
  ): Promise<ToolResult> => {
    try {
      // 检查session
      if (!session) {
        return {
          success: false,
          errorInfo: "无法获取会话信息",
          aiResponse: "抱歉，无法获取当前会话信息，无法创建预约。",
        };
      }

      const { groupId, channelId, userId } = extractGameSessionInfo(session);

      if (!groupId || groupId === "unknown") {
        return {
          success: false,
          errorInfo: "不在群聊中",
          aiResponse: "预约功能只能在群聊中使用。",
        };
      }

      // 检查是否为超级管理员（从config中读取）
      const superAdmins = ConfigUnion.app.superAdmins || [];
      if (!superAdmins.includes(userId)) {
        return {
          success: false,
          errorInfo: "权限不足",
          aiResponse: "抱歉，只有超级管理员才能创建预约。请让管理员来创建。",
        };
      }

      // 检查选项数量
      if (params.options.length === 0) {
        return {
          success: false,
          errorInfo: "选项不能为空",
          aiResponse: "创建预约需要至少一个选项。",
        };
      }

      if (params.options.length > 10) {
        return {
          success: false,
          errorInfo: "选项过多",
          aiResponse: "选项数量不能超过10个。",
        };
      }

      // 解析截止时间
      let deadlineTimestamp: number | undefined;
      if (params.deadline) {
        const parsed = parseDeadline(params.deadline);
        if (parsed) {
          deadlineTimestamp = parsed.getTime();
        }
      }

      // 创建预约
      const reservation = await getReservationService().createReservation({
        title: params.title,
        description: params.description,
        options: params.options.map((label) => ({ label })),
        selectionMode: params.mode,
        groupId,
        channelId,
        creatorId: userId,
        creatorName: getUserDisplayName(session),
        deadline: deadlineTimestamp,
      });

      // 获取详情生成卡片
      const detail = await getReservationService().getReservationDetail(reservation.id!);
      const stats = await getReservationService().getOptionStats(reservation.id!);

      if (detail) {
        const picPath = await tsxToPic(
          ReservationDetailCard,
          { reservation: detail, optionStats: stats },
          { width: 700, outputFileName: `reservation_${reservation.id}` }
        );

        return {
          success: true,
          responseType: "image",
          resUrl: `file://${picPath}`,
          aiResponse: `已成功创建预约 #${reservation.id}「${reservation.title}」！\n选项：${params.options.join(", ")}\n模式：${params.mode === "single" ? "单选" : "多选"}${deadlineTimestamp ? "\n截止时间：" + params.deadline : ""}\n\n提示：如需添加封面图，请在60秒内发送图片。`,
          userMessages: [
            {
              type: "image",
              src: `file://${picPath}`,
            },
          ],
        };
      }

      return {
        success: true,
        responseType: "text",
        aiResponse: `已成功创建预约 #${reservation.id}「${reservation.title}」！\n选项：${params.options.join(", ")}\n模式：${params.mode === "single" ? "单选" : "多选"}`,
      };
    } catch (error) {
      console.error("创建预约工具执行失败:", error);
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        errorInfo: msg,
        aiResponse: `创建预约失败：${msg}`,
      };
    }
  },
};

/**
 * 列出预约工具
 */
export const listReservationsTool: ToolDefinition = {
  name: "listReservations",
  description: "列出当前群聊中的所有预约（包括进行中和已关闭的）",
  inputSchema: z.object({}),
  execute: async (_params: {}, session?: SessionData): Promise<ToolResult> => {
    try {
      if (!session) {
        return {
          success: false,
          errorInfo: "无法获取会话信息",
          aiResponse: "无法获取当前会话信息。",
        };
      }

      const { groupId } = extractGameSessionInfo(session);

      if (!groupId || groupId === "unknown") {
        return {
          success: false,
          errorInfo: "不在群聊中",
          aiResponse: "此功能只能在群聊中使用。",
        };
      }

      const reservations = await getReservationService().getAllReservations(groupId);

      if (reservations.length === 0) {
        return {
          success: true,
          responseType: "text",
          aiResponse: "当前群聊中暂无预约活动。",
        };
      }

      const activeCount = reservations.filter((r) => r.status === "active").length;
      const listText = reservations
        .map((r) => {
          const status = r.status === "active" ? "进行中" : "已关闭";
          return `#${r.id} ${r.title} [${status}] - ${r.selection_mode === "single" ? "单选" : "多选"}`;
        })
        .join("\n");

      return {
        success: true,
        responseType: "text",
        aiResponse: `当前群聊共有 ${reservations.length} 个预约（${activeCount} 个进行中）：\n\n${listText}\n\n发送「预约详情 [ID]」查看详细信息，发送「预约 [ID] [选项序号]」参与预约。`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        errorInfo: msg,
        aiResponse: `获取预约列表失败：${msg}`,
      };
    }
  },
};

/**
 * 获取预约详情工具
 */
export const getReservationDetailTool: ToolDefinition = {
  name: "getReservationDetail",
  description: "获取指定预约的详细信息和当前投票统计",
  inputSchema: z.object({
    reservationId: z.number().describe("预约ID，如：5"),
  }),
  execute: async (
    params: { reservationId: number },
    session?: SessionData
  ): Promise<ToolResult> => {
    try {
      if (!session) {
        return {
          success: false,
          errorInfo: "无法获取会话信息",
          aiResponse: "无法获取当前会话信息。",
        };
      }

      const { groupId, userId } = extractGameSessionInfo(session);

      if (!groupId || groupId === "unknown") {
        return {
          success: false,
          errorInfo: "不在群聊中",
          aiResponse: "此功能只能在群聊中使用。",
        };
      }

      const detail = await getReservationService().getReservationDetail(params.reservationId);

      if (!detail) {
        return {
          success: false,
          errorInfo: "预约不存在",
          aiResponse: `未找到预约 #${params.reservationId}。`,
        };
      }

      if (detail.group_id !== groupId) {
        return {
          success: false,
          errorInfo: "无权查看",
          aiResponse: "该预约不在当前群聊中。",
        };
      }

      const stats = await getReservationService().getOptionStats(params.reservationId);

      // 生成统计文本
      const statsText = stats
        .map((s) => `${s.optionIndex}. ${s.label}: ${s.count}人${s.isFull ? " [已满]" : ""}`)
        .join("\n");

      const totalParticipants = new Set(detail.choices.map((c) => c.user_id)).size;

      return {
        success: true,
        responseType: "text",
        aiResponse: `预约 #${detail.id}「${detail.title}」\n状态：${detail.status === "active" ? "进行中" : "已关闭"}\n模式：${detail.selection_mode === "single" ? "单选" : "多选"}\n参与人数：${totalParticipants}人\n\n选项统计：\n${statsText}\n\n发送「预约 ${detail.id} [选项序号]」参与预约。`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        errorInfo: msg,
        aiResponse: `获取预约详情失败：${msg}`,
      };
    }
  },
};

// 解析截止时间
function parseDeadline(value: string): Date | null {
  const now = new Date();

  // 处理"明天"
  if (value.startsWith("明天") || value.startsWith("明日")) {
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
    if (date < now) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  return null;
}
