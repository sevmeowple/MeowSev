import React from "react";
import {
  Reservation,
  ReservationDetail,
  ReservationOption,
  ReservationChoiceWithParsedOptions,
  OptionStat,
} from "@/models/Reservation";

// ============ 列表卡片 ============

interface ReservationListCardProps {
  reservations: Reservation[];
  groupName?: string;
}

export function ReservationListCard({
  reservations,
  groupName = "本群",
}: ReservationListCardProps) {
  const activeCount = reservations.filter((r) => r.status === "active").length;

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                font-family: 'Noto Sans SC', sans-serif;
                margin: 0;
                padding: 0;
                background: #121212;
              }
              .card-container {
                background: linear-gradient(180deg, #1E1E1E 0%, #181818 100%);
                border: 1px solid #2A2A2A;
              }
              .accent-border {
                border-left: 3px solid #ff5000;
              }
              .status-active {
                background: rgba(255, 80, 0, 0.15);
                color: #ff5000;
              }
              .status-closed {
                background: rgba(128, 128, 128, 0.15);
                color: #888;
              }
            `,
          }}
        />
      </head>
      <body>
        <div
          className="card-container"
          style={{ width: 600, minHeight: 200, position: "relative" }}
        >
          {/* Header */}
          <div className="p-5 border-b border-[#2A2A2A]">
            <div className="flex items-center gap-3">
              <div
                className="w-1 h-6 rounded-full"
                style={{ background: "#ff5000" }}
              />
              <h1 className="text-xl font-bold text-white">预约列表</h1>
              <span className="text-sm text-gray-400">
                {groupName} · 共 {reservations.length} 个
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-400">
              进行中: <span className="text-[#ff5000] font-medium">{activeCount}</span> 个
            </div>
          </div>

          {/* List */}
          <div className="p-4">
            {reservations.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <div className="text-4xl mb-3">📋</div>
                <div>暂无预约</div>
                <div className="text-sm mt-1">使用「预约创建」命令创建新预约</div>
              </div>
            ) : (
              <div className="space-y-3">
                {reservations.map((r) => (
                  <div
                    key={r.id}
                    className="accent-border bg-[#252525] rounded-r-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[#ff5000] font-bold">
                            #{r.id}
                          </span>
                          <span className="text-white font-medium">
                            {r.title}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              r.status === "active"
                                ? "status-active"
                                : "status-closed"
                            }`}
                          >
                            {r.status === "active" ? "进行中" : "已关闭"}
                          </span>
                        </div>
                        {r.description && (
                          <div className="text-sm text-gray-400 mt-1 line-clamp-1">
                            {r.description}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>
                            {r.selection_mode === "single" ? "单选" : "多选"}
                          </span>
                          {r.deadline && (
                            <span>
                              截止: {formatDate(r.deadline)}
                            </span>
                          )}
                          <span>创建者: {r.creator_name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#2A2A2A] text-xs text-gray-500 text-center">
            发送「预约详情 [ID]」查看详情 · 发送「预约 [ID] [选项]」参与
          </div>
        </div>
      </body>
    </html>
  );
}

// ============ 详情卡片 ============

interface ReservationDetailCardProps {
  reservation: ReservationDetail;
  optionStats: OptionStat[];
  highlightUserId?: string;
}

export function ReservationDetailCard({
  reservation,
  optionStats,
  highlightUserId,
}: ReservationDetailCardProps) {
  const totalParticipants = new Set(reservation.choices.map((c) => c.user_id))
    .size;

  // 获取用户的选择
  const getUserChoice = (userId: string) => {
    const choice = reservation.choices.find((c) => c.user_id === userId);
    if (!choice) return null;
    return choice.parsedOptions
      .map((idx) => reservation.options.find((o) => o.option_index === idx)?.label)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                font-family: 'Noto Sans SC', sans-serif;
                margin: 0;
                padding: 0;
                background: #121212;
              }
              .card-container {
                background: linear-gradient(180deg, #1E1E1E 0%, #181818 100%);
                border: 1px solid #2A2A2A;
              }
              .option-bar-bg {
                background: #2A2A2A;
              }
              .option-bar-fill {
                background: linear-gradient(90deg, #ff5000 0%, #ff7040 100%);
              }
            `,
          }}
        />
      </head>
      <body>
        <div
          className="card-container"
          style={{ width: 700, position: "relative" }}
        >
          {/* Cover Image */}
          {reservation.cover_image && (
            <div className="w-full h-40 overflow-hidden">
              <img
                src={`file://${reservation.cover_image}`}
                alt="cover"
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0 h-40"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 0%, #1E1E1E 100%)",
                }}
              />
            </div>
          )}

          {/* Header */}
          <div className={`p-6 ${reservation.cover_image ? "-mt-10" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-[#ff5000]">
                    #{reservation.id}
                  </span>
                  <h1 className="text-2xl font-bold text-white">
                    {reservation.title}
                  </h1>
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${
                      reservation.status === "active"
                        ? "bg-[#ff5000]/15 text-[#ff5000]"
                        : "bg-gray-700/50 text-gray-400"
                    }`}
                  >
                    {reservation.status === "active" ? "进行中" : "已关闭"}
                  </span>
                </div>
                {reservation.description && (
                  <p className="text-gray-400 mt-2">{reservation.description}</p>
                )}
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
              <span className="bg-[#252525] px-3 py-1 rounded-full">
                模式: {reservation.selection_mode === "single" ? "单选" : "多选"}
              </span>
              {reservation.deadline && (
                <span className="bg-[#252525] px-3 py-1 rounded-full">
                  截止: {formatDate(reservation.deadline)}
                </span>
              )}
              <span className="bg-[#252525] px-3 py-1 rounded-full">
                创建者: {reservation.creator_name}
              </span>
              <span className="bg-[#252525] px-3 py-1 rounded-full">
                参与人数: {totalParticipants} 人
              </span>
            </div>
          </div>

          {/* Options */}
          <div className="px-6 pb-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-[#ff5000]" />
              选项统计
            </h2>

            <div className="space-y-4">
              {optionStats.map((stat) => {
                const percentage =
                  totalParticipants > 0
                    ? Math.round((stat.count / totalParticipants) * 100)
                    : 0;

                return (
                  <div key={stat.optionIndex} className="bg-[#252525] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#ff5000] font-bold">
                          {stat.optionIndex}.
                        </span>
                        <span className="text-white font-medium">
                          {stat.label}
                        </span>
                        {stat.isFull && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                            已满
                          </span>
                        )}
                      </div>
                      <span className="text-gray-400">
                        {stat.count} 人 ({percentage}%)
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="option-bar-bg h-2 rounded-full overflow-hidden">
                      <div
                        className="option-bar-fill h-full rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* User list */}
                    {stat.users.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {stat.users.map((user, idx) => (
                          <span
                            key={idx}
                            className={`text-xs px-2 py-1 rounded ${
                              highlightUserId &&
                              reservation.choices.find(
                                (c) =>
                                  c.user_name === user &&
                                  c.user_id === highlightUserId
                              )
                                ? "bg-[#ff5000]/30 text-[#ff5000]"
                                : "bg-[#1E1E1E] text-gray-400"
                            }`}
                          >
                            {user}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Your Choice */}
            {highlightUserId && (
              <div className="mt-6 p-4 bg-[#252525] rounded-lg border border-[#ff5000]/30">
                <div className="text-sm text-gray-400">您的选择</div>
                <div className="text-lg font-medium text-[#ff5000] mt-1">
                  {getUserChoice(highlightUserId) || "未参与"}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#2A2A2A] text-xs text-gray-500 text-center">
            发送「预约 {reservation.id} [选项序号]」参与 · 发送「预约 {reservation.id} 取消」退出
          </div>
        </div>
      </body>
    </html>
  );
}

// ============ 工具函数 ============

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return `今天 ${timeStr}`;
  } else if (isTomorrow) {
    return `明天 ${timeStr}`;
  } else {
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
