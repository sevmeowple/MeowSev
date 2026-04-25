import { ConfigUnionType } from "@/config/config";
import Database from "bun:sqlite";
import {
  Reservation,
  ReservationOption,
  ReservationChoice,
  ReservationDetail,
  ReservationChoiceWithParsedOptions,
  OptionStat,
  ReservationSchema,
  ReservationOptionSchema,
  ReservationChoiceSchema,
  ReservationIndexes,
} from "@/models/Reservation";
import { sendToGroup } from "@/utils/message";
import { promises as fs } from "fs";
import path from "path";

// 封面图存储路径
const COVER_IMAGE_DIR = path.join(process.cwd(), "data", "reservations");

// 活跃提醒任务映射
const activeReminders = new Map<number, NodeJS.Timeout>();

export class ReservationService {
  private db: Database;
  private appConfig: ConfigUnionType["app"];

  constructor(ConfigUnion: ConfigUnionType) {
    this.db = ConfigUnion.database;
    this.appConfig = ConfigUnion.app;

    // 初始化数据库表
    this.initDatabase();

    // 恢复未完成的提醒任务
    this.restoreReminders();
  }

  // 初始化数据库
  private initDatabase() {
    this.db.exec(ReservationSchema.createTable);
    this.db.exec(ReservationOptionSchema.createTable);
    this.db.exec(ReservationChoiceSchema.createTable);

    // 创建索引
    ReservationIndexes.forEach((indexSql) => {
      this.db.exec(indexSql);
    });
  }

  // ============ 预约管理 ============

  /**
   * 创建预约
   */
  async createReservation(data: {
    title: string;
    description?: string;
    options: { label: string; description?: string; maxCount?: number }[];
    selectionMode: "single" | "multiple";
    groupId: string;
    channelId: string;
    creatorId: string;
    creatorName: string;
    deadline?: number;
    reminderMinutes?: number;
  }): Promise<Reservation> {
    const insertReservation = this.db.query(
      `INSERT INTO reservations (
        title, description, group_id, channel_id, creator_id, creator_name,
        selection_mode, deadline, reminder_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`
    );

    const reservation = insertReservation.get(
      data.title,
      data.description || null,
      data.groupId,
      data.channelId,
      data.creatorId,
      data.creatorName,
      data.selectionMode,
      data.deadline || null,
      data.reminderMinutes || null
    ) as Reservation;

    // 插入选项
    const insertOption = this.db.query(
      `INSERT INTO reservation_options (
        reservation_id, option_index, label, description, max_count
      ) VALUES (?, ?, ?, ?, ?)`
    );

    data.options.forEach((opt, index) => {
      insertOption.run(
        reservation.id,
        index + 1, // 从1开始
        opt.label,
        opt.description || null,
        opt.maxCount || null
      );
    });

    // 设置提醒
    if (data.deadline && data.reminderMinutes) {
      this.scheduleReminder(reservation.id!, data.deadline, data.reminderMinutes);
    }

    return reservation;
  }

  /**
   * 关闭预约
   */
  async closeReservation(reservationId: number): Promise<boolean> {
    const update = this.db.query(
      `UPDATE reservations
       SET status = 'closed', closed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'active'
       RETURNING *`
    );

    const result = update.get(reservationId);

    if (result) {
      // 取消提醒任务
      this.cancelReminder(reservationId);
      return true;
    }

    return false;
  }

  /**
   * 获取预约详情
   */
  async getReservationDetail(
    reservationId: number
  ): Promise<ReservationDetail | null> {
    // 获取预约基本信息
    const reservationQuery = this.db.query(
      "SELECT * FROM reservations WHERE id = ?"
    );
    const reservation = reservationQuery.get(reservationId) as
      | Reservation
      | undefined;

    if (!reservation) return null;

    // 获取选项
    const optionsQuery = this.db.query(
      "SELECT * FROM reservation_options WHERE reservation_id = ? ORDER BY option_index"
    );
    const options = optionsQuery.all(reservationId) as ReservationOption[];

    // 获取用户选择
    const choicesQuery = this.db.query(
      "SELECT * FROM reservation_choices WHERE reservation_id = ? ORDER BY updated_at DESC"
    );
    const choicesRaw = choicesQuery.all(reservationId) as ReservationChoice[];
    const choices: ReservationChoiceWithParsedOptions[] = choicesRaw.map(
      (choice) => ({
        ...choice,
        parsedOptions: JSON.parse(choice.selected_options),
      })
    );

    return {
      ...reservation,
      options,
      choices,
    };
  }

  /**
   * 获取群聊中活跃的预约列表
   */
  async getActiveReservations(groupId: string): Promise<Reservation[]> {
    const query = this.db.query(
      `SELECT * FROM reservations
       WHERE group_id = ? AND status = 'active'
       ORDER BY created_at DESC`
    );
    return query.all(groupId) as Reservation[];
  }

  /**
   * 获取群聊中所有预约（包括已关闭）
   */
  async getAllReservations(groupId: string): Promise<Reservation[]> {
    const query = this.db.query(
      `SELECT * FROM reservations
       WHERE group_id = ?
       ORDER BY
         CASE WHEN status = 'active' THEN 0 ELSE 1 END,
         created_at DESC`
    );
    return query.all(groupId) as Reservation[];
  }

  // ============ 用户选择 ============

  /**
   * 用户做出选择
   */
  async makeChoice(
    reservationId: number,
    userId: string,
    userName: string,
    selectedOptions: number[]
  ): Promise<{
    success: boolean;
    message: string;
    choice?: ReservationChoice;
  }> {
    // 检查预约是否存在且活跃
    const reservation = await this.getReservationDetail(reservationId);
    if (!reservation) {
      return { success: false, message: "预约不存在" };
    }
    if (reservation.status === "closed") {
      return { success: false, message: "预约已关闭" };
    }

    // 检查选项是否有效
    const validOptionIndexes = reservation.options.map((o) => o.option_index);
    const invalidOptions = selectedOptions.filter(
      (o) => !validOptionIndexes.includes(o)
    );
    if (invalidOptions.length > 0) {
      return { success: false, message: `无效选项: ${invalidOptions.join(", ")}` };
    }

    // 检查选择模式
    if (
      reservation.selection_mode === "single" &&
      selectedOptions.length !== 1
    ) {
      return { success: false, message: "此预约为单选模式，只能选择一个选项" };
    }

    // 检查人数限制
    for (const optionIndex of selectedOptions) {
      const option = reservation.options.find((o) => o.option_index === optionIndex);
      if (option?.max_count) {
        const currentCount = this.countOptionParticipants(
          reservation.choices,
          optionIndex,
          userId
        );
        if (currentCount >= option.max_count) {
          return {
            success: false,
            message: `选项 "${option.label}" 已满员（${option.max_count}人）`,
          };
        }
      }
    }

    // 插入或更新选择
    const insertOrReplace = this.db.query(
      `INSERT OR REPLACE INTO reservation_choices
       (reservation_id, user_id, user_name, selected_options, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       RETURNING *`
    );

    const choice = insertOrReplace.get(
      reservationId,
      userId,
      userName,
      JSON.stringify(selectedOptions)
    ) as ReservationChoice;

    return {
      success: true,
      message: "选择成功",
      choice,
    };
  }

  /**
   * 取消参与
   */
  async cancelChoice(
    reservationId: number,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    // 检查预约是否存在且活跃
    const reservationQuery = this.db.query(
      "SELECT status FROM reservations WHERE id = ?"
    );
    const reservation = reservationQuery.get(reservationId) as
      | { status: string }
      | undefined;

    if (!reservation) {
      return { success: false, message: "预约不存在" };
    }
    if (reservation.status === "closed") {
      return { success: false, message: "预约已关闭，无法取消" };
    }

    const deleteQuery = this.db.query(
      "DELETE FROM reservation_choices WHERE reservation_id = ? AND user_id = ?"
    );
    const result = deleteQuery.run(reservationId, userId);

    if (result.changes > 0) {
      return { success: true, message: "已取消参与" };
    } else {
      return { success: false, message: "您尚未参与此预约" };
    }
  }

  /**
   * 统计选项参与人数
   */
  private countOptionParticipants(
    choices: ReservationChoiceWithParsedOptions[],
    optionIndex: number,
    excludeUserId?: string
  ): number {
    return choices.filter(
      (c) =>
        c.parsedOptions.includes(optionIndex) && c.user_id !== excludeUserId
    ).length;
  }

  /**
   * 获取选项统计信息
   */
  async getOptionStats(reservationId: number): Promise<OptionStat[]> {
    const detail = await this.getReservationDetail(reservationId);
    if (!detail) return [];

    return detail.options.map((option) => {
      const users = detail.choices
        .filter((c) => c.parsedOptions.includes(option.option_index))
        .map((c) => c.user_name);

      return {
        optionIndex: option.option_index,
        label: option.label,
        count: users.length,
        users,
        isFull: option.max_count ? users.length >= option.max_count : false,
      };
    });
  }

  // ============ 提醒功能 ============

  /**
   * 设置提醒
   */
  async setReminder(
    reservationId: number,
    minutes: number
  ): Promise<{ success: boolean; message: string }> {
    const reservation = await this.getReservationDetail(reservationId);
    if (!reservation) {
      return { success: false, message: "预约不存在" };
    }
    if (reservation.status === "closed") {
      return { success: false, message: "预约已关闭" };
    }

    // 更新数据库
    const update = this.db.query(
      "UPDATE reservations SET reminder_minutes = ? WHERE id = ? RETURNING *"
    );
    const updated = update.get(minutes, reservationId) as
      | Reservation
      | undefined;

    if (!updated) {
      return { success: false, message: "设置提醒失败" };
    }

    // 如果有截止时间，重新安排提醒
    if (reservation.deadline) {
      this.scheduleReminder(reservationId, reservation.deadline, minutes);
    }

    return { success: true, message: `已设置截止前 ${minutes} 分钟提醒` };
  }

  /**
   * 安排提醒任务
   */
  private scheduleReminder(
    reservationId: number,
    deadline: number,
    reminderMinutes: number
  ) {
    // 取消现有提醒
    this.cancelReminder(reservationId);

    const now = Date.now();
    const reminderTime = deadline - reminderMinutes * 60 * 1000;
    const delay = reminderTime - now;

    if (delay <= 0) return;

    const timeout = setTimeout(() => {
      this.sendReminder(reservationId);
    }, delay);

    activeReminders.set(reservationId, timeout);
    console.log(
      `⏰ 已设置预约 #${reservationId} 的提醒，将在 ${reminderMinutes} 分钟前触发`
    );
  }

  /**
   * 取消提醒任务
   */
  private cancelReminder(reservationId: number) {
    const existing = activeReminders.get(reservationId);
    if (existing) {
      clearTimeout(existing);
      activeReminders.delete(reservationId);
    }
  }

  /**
   * 发送提醒消息
   */
  private async sendReminder(reservationId: number) {
    try {
      const detail = await this.getReservationDetail(reservationId);
      if (!detail || detail.status === "closed" || detail.reminder_sent) {
        return;
      }

      const participantCount = detail.choices.length;
      const message = `⏰ 预约 [#${detail.id} ${detail.title}] 即将截止，目前已有 ${participantCount} 人参与`;

      // 发送到群聊
      await sendToGroup(detail.group_id, message);

      // 标记已发送
      const update = this.db.query(
        "UPDATE reservations SET reminder_sent = 1 WHERE id = ?"
      );
      update.run(reservationId);

      activeReminders.delete(reservationId);
      console.log(`✅ 已发送预约 #${reservationId} 的提醒`);
    } catch (error) {
      console.error(`发送预约 #${reservationId} 提醒失败:`, error);
    }
  }

  /**
   * 恢复未完成的提醒任务（服务启动时调用）
   */
  private restoreReminders() {
    const query = this.db.query(
      `SELECT id, deadline, reminder_minutes FROM reservations
       WHERE status = 'active'
       AND reminder_sent = 0
       AND deadline IS NOT NULL
       AND reminder_minutes IS NOT NULL`
    );
    const reservations = query.all() as {
      id: number;
      deadline: number;
      reminder_minutes: number;
    }[];

    reservations.forEach((r) => {
      this.scheduleReminder(r.id, r.deadline, r.reminder_minutes);
    });

    console.log(`🔄 已恢复 ${reservations.length} 个预约提醒任务`);
  }

  // ============ 封面图 ============

  /**
   * 保存封面图片
   */
  async saveCoverImage(
    reservationId: number,
    imageBuffer: Buffer
  ): Promise<string> {
    const dir = path.join(COVER_IMAGE_DIR, reservationId.toString());
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, "cover.jpg");
    await fs.writeFile(filePath, imageBuffer);

    // 更新数据库
    const update = this.db.query(
      "UPDATE reservations SET cover_image = ? WHERE id = ? RETURNING *"
    );
    update.run(filePath, reservationId);

    return filePath;
  }

  /**
   * 获取封面图片路径
   */
  async getCoverImagePath(reservationId: number): Promise<string | null> {
    const query = this.db.query(
      "SELECT cover_image FROM reservations WHERE id = ?"
    );
    const result = query.get(reservationId) as { cover_image?: string } | undefined;
    return result?.cover_image || null;
  }
}
