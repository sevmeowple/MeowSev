// 预约主表接口
export interface Reservation {
  id?: number;
  title: string;
  description?: string;
  cover_image?: string;           // 封面图片路径
  group_id: string;               // 群ID
  channel_id: string;             // 频道ID
  creator_id: string;             // 创建者ID
  creator_name: string;           // 创建者名称
  selection_mode: 'single' | 'multiple';  // 选择模式
  status: 'active' | 'closed';    // 状态
  deadline?: number;              // 截止时间戳（可选）
  reminder_minutes?: number;      // 提前提醒分钟数
  reminder_sent: boolean;         // 是否已发送提醒
  created_at?: string;            // 创建时间
  closed_at?: string;             // 关闭时间
}

// 选项表接口
export interface ReservationOption {
  id?: number;
  reservation_id: number;
  option_index: number;           // 1,2,3... 用于用户选择
  label: string;
  description?: string;
  max_count?: number;             // 人数限制（可选）
}

// 用户选择表接口
export interface ReservationChoice {
  id?: number;
  reservation_id: number;
  user_id: string;
  user_name: string;
  selected_options: string;       // JSON数组 [1,2]
  updated_at?: string;
}

// 完整的预约详情（包含选项和选择）
export interface ReservationDetail extends Reservation {
  options: ReservationOption[];
  choices: ReservationChoiceWithParsedOptions[];
}

// 用户选择（解析后的选项）
export interface ReservationChoiceWithParsedOptions extends ReservationChoice {
  parsedOptions: number[];
}

// 选项统计
export interface OptionStat {
  optionIndex: number;
  label: string;
  count: number;
  users: string[];
  isFull: boolean;
}

// ============ 数据库 Schema ============

export const ReservationSchema = {
  tableName: 'reservations',
  createTable: `
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      group_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      selection_mode TEXT DEFAULT 'single',
      status TEXT DEFAULT 'active',
      deadline INTEGER,
      reminder_minutes INTEGER,
      reminder_sent BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    )
  `
};

export const ReservationOptionSchema = {
  tableName: 'reservation_options',
  createTable: `
    CREATE TABLE IF NOT EXISTS reservation_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL,
      option_index INTEGER NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      max_count INTEGER,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
    )
  `
};

export const ReservationChoiceSchema = {
  tableName: 'reservation_choices',
  createTable: `
    CREATE TABLE IF NOT EXISTS reservation_choices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      selected_options TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
      UNIQUE(reservation_id, user_id)
    )
  `
};

// ============ 索引 ============

export const ReservationIndexes = [
  `CREATE INDEX IF NOT EXISTS idx_reservations_group ON reservations(group_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status)`,
  `CREATE INDEX IF NOT EXISTS idx_reservations_deadline ON reservations(deadline)`,
  `CREATE INDEX IF NOT EXISTS idx_options_reservation ON reservation_options(reservation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_choices_reservation ON reservation_choices(reservation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_choices_user ON reservation_choices(user_id)`,
];
