import React from "react";
import fs from "fs";
import path from "path";
import type { GMemeberSummaryData, OverallGroupChat } from "./type";
import {
  FaTrophy,
  FaRegImage,
  FaRegSmile,
  FaShareAlt,
  FaQuoteLeft,
  FaClock,
  FaFingerprint,
} from "react-icons/fa";

interface ReportCardProps {
  reportData: GMemeberSummaryData;
  overallData: OverallGroupChat;
}

// 辅助组件：科技感信息块
const TechBlock: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
  className?: string;
}> = ({ icon, label, value, color = "text-cyan-400", className = "" }) => (
  <div
    className={`relative bg-slate-900/60 border border-slate-700/50 p-4 flex flex-col items-center justify-center text-center backdrop-blur-sm group overflow-hidden ${className}`}
  >
    {/* 装饰角标 */}
    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-400/50"></div>
    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-400/50"></div>

    <div
      className={`text-2xl mb-2 ${color} drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]`}
    >
      {icon}
    </div>
    <div className="text-xl font-bold text-slate-100 tracking-wider font-mono">
      {value}
    </div>
    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
      {label}
    </div>
  </div>
);

// 读取本地图片（在组件外部，只读取一次）
const currentDir = import.meta.dir; // 保持你原有的写法
const imagePath = path.join(currentDir, "image.png");
// const imageBuffer = fs.readFileSync(imagePath);
// const BACKGROUND_IMAGE = `data:image/png;base64,${imageBuffer.toString(
//   "base64"
// )}`;
const BACKGROUND_IMAGE = `file://${imagePath}`;
let tailwindScriptContent = "";
try {
  const tailwindPath = path.join(currentDir, "tailwindcss.js");
  if (fs.existsSync(tailwindPath)) {
    tailwindScriptContent = fs.readFileSync(tailwindPath, "utf-8");
    console.log("✅ 已加载本地 Tailwind 脚本");
  } else {
    console.warn("⚠️ 未找到本地 Tailwind 脚本，将回退到 CDN");
  }
} catch (e) {
  console.error("读取 Tailwind 脚本失败:", e);
}
export const AnnualReportCard: React.FC<ReportCardProps> = ({
  reportData,
  overallData,
}) => {
  const {
    personalYearlyHotWords,
    totalSpeechCount,
    personalSpeechRank,
    previousRankSpeechCount,
    previousRankMemberName,
    memeUsageCount,
    imageUsageCount,
    SharedSegmentCount,
    mostActiveTimePeriod,
    mentionedOperators,
    bestMatchingOperator,
    relatedSentences,
    firstMessage,
    lastMessage,
  } = reportData;

  const sortedOperators = Object.entries(mentionedOperators)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 6);

  const speechDiff = previousRankSpeechCount - totalSpeechCount;

  // 生成随机星星
  const stars = React.useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.7 + 0.3,
        delay: `${Math.random() * 5}s`,
      })),
    []
  );

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        {tailwindScriptContent ? (
          <script
            dangerouslySetInnerHTML={{ __html: tailwindScriptContent }}
          ></script>
        ) : (
          <script src="https://cdn.tailwindcss.com"></script>
        )}
        {/* <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" /> */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          body { font-family: 'Noto Sans SC', sans-serif; }
          .font-mono { font-family: 'JetBrains Mono', monospace; }
          .star {
            position: absolute;
            background: white;
            border-radius: 50%;
            animation: twinkle 3s infinite ease-in-out;
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          .scanline {
            background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.3) 51%);
            background-size: 100% 4px;
          }
        `,
          }}
        />
      </head>
      <body className="bg-slate-900 flex justify-center items-center min-h-screen py-10">
        {/* ---- 报告主容器 ---- */}
        <div
          id="report-container"
          className="relative w-[700px] overflow-hidden bg-[#0a0f1c] text-slate-200 shadow-2xl border border-slate-800"
        >
          {/* 背景层 */}
          <div className="absolute inset-0 z-0">
            {/* 图片背景 */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-luminosity"
              style={{ backgroundImage: `url('${BACKGROUND_IMAGE}')` }}
            ></div>
            {/* 渐变遮罩：深蓝 -> 底部红色 */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/90 via-[#0f172a]/70 to-[#450a0a]/80"></div>
            {/* 星空 */}
            {stars.map((star, i) => (
              <div
                key={i}
                className="star"
                style={{
                  left: star.left,
                  top: star.top,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  opacity: star.opacity,
                  animationDelay: star.delay,
                }}
              />
            ))}
            {/* 扫描线纹理 */}
            <div className="absolute inset-0 scanline opacity-10 pointer-events-none"></div>
          </div>

          {/* 内容层 */}
          <div className="relative z-10 flex flex-col h-full">
            {/* 1. 顶部 Header */}
            <header className="p-8 flex justify-between items-end border-b border-white/10 bg-gradient-to-r from-slate-900/80 to-transparent backdrop-blur-sm">
              <div>
                <div className="flex items-center gap-2 text-cyan-400 mb-1">
                  <FaFingerprint />
                  <span className="text-xs tracking-[0.3em] font-mono">
                    IDENTITY CONFIRMED
                  </span>
                </div>
                <h1 className="text-4xl font-black tracking-tighter text-white italic">
                  ANNUAL <span className="text-cyan-400">REPORT</span>
                </h1>
                <div className="text-sm text-slate-400 mt-1 font-mono">
                  NO.{overallData.groupId} // 2025
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white font-mono">
                  {overallData.memberNames[
                    overallData.totalSpeechesRank[personalSpeechRank - 1]
                      ?.memberId
                  ] || "DOCTOR"}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 mt-1 inline-block rounded-sm">
                  Rhodes Island Terminal
                </div>
              </div>
            </header>

            <main className="p-8 space-y-8">
              {/* 2. 核心数据 - 扁平化科技风格 */}
              <section className="grid grid-cols-12 gap-4">
                {/* 左侧大数字 */}
                <div className="col-span-7 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <FaTrophy className="text-8xl text-white" />
                  </div>
                  <div className="text-xs text-cyan-500 tracking-widest mb-2">
                    TOTAL TRANSMISSIONS
                  </div>
                  <div className="text-6xl font-black text-white font-mono tracking-tight">
                    {totalSpeechCount.toLocaleString()}
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-sm">
                    <div className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 border border-yellow-500/30 font-mono">
                      RANK #{personalSpeechRank}
                    </div>
                    {personalSpeechRank > 1 && (
                      <span className="text-slate-500 text-xs">
                        TARGET: {previousRankMemberName} (-{speechDiff})
                      </span>
                    )}
                  </div>
                </div>

                {/* 右侧小数据块 */}
                <div className="col-span-5 grid grid-cols-2 gap-2">
                  <TechBlock
                    icon={<FaRegSmile />}
                    label="MEME"
                    value={memeUsageCount}
                    color="text-green-400"
                  />
                  <TechBlock
                    icon={<FaRegImage />}
                    label="IMAGE"
                    value={imageUsageCount}
                    color="text-blue-400"
                  />
                  <TechBlock
                    icon={<FaShareAlt />}
                    label="SHARE"
                    value={SharedSegmentCount}
                    color="text-purple-400"
                  />
                  <TechBlock
                    icon={<FaClock />}
                    label="ACTIVE"
                    value={mostActiveTimePeriod}
                    color="text-orange-400"
                    className="text-sm"
                  />
                </div>
              </section>

              {/* 3. 关键词与干员分析 */}
              <section className="grid grid-cols-2 gap-6">
                {/* 关键词 */}
                <div>
                  <h2 className="text-sm font-bold text-slate-400 border-b border-slate-700 pb-2 mb-4 flex justify-between items-center">
                    <span>HOT WORDS</span>
                    <span className="text-[10px] font-mono opacity-50">
                      ANALYSIS_MODULE_01
                    </span>
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {personalYearlyHotWords.slice(0, 8).map((word, idx) => (
                      <div
                        key={word.word}
                        className={`px-3 py-1 text-sm font-medium border ${
                          idx === 0
                            ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                            : "bg-slate-800/40 border-slate-700 text-slate-300"
                        }`}
                      >
                        {word.word}{" "}
                        <span className="text-[10px] opacity-50 ml-1 font-mono">
                          {word.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 干员适配 */}
                <div className="relative">
                  <div className="absolute -inset-2 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none"></div>
                  <h2 className="text-sm font-bold text-slate-400 border-b border-slate-700 pb-2 mb-4 flex justify-between items-center">
                    <span>OPERATOR SYNC</span>
                    <span className="text-[10px] font-mono opacity-50">
                      SYNC_RATE: 100%
                    </span>
                  </h2>
                  <div className="bg-slate-800/40 border-l-2 border-yellow-500 p-4">
                    <div className="text-xs text-slate-500 mb-1">
                      BEST MATCH
                    </div>
                    <div className="text-3xl font-bold text-white mb-2">
                      {bestMatchingOperator}
                    </div>
                    <div className="text-xs text-slate-400 italic border-t border-white/5 pt-2 mt-2">
                      <FaQuoteLeft className="inline mr-2 text-slate-600" />
                      {relatedSentences[0] || "..."}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {sortedOperators.map(([name, data]) => (
                      <span
                        key={name}
                        className="text-[10px] bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-slate-400"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* 4. 记忆回溯 */}
              <section className="border-t border-slate-800 pt-6 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0a0f1c] px-4 text-xs text-slate-600 font-mono">
                  TIMELINE RECORD
                </div>
                <div className="flex justify-between text-sm gap-8">
                  <div className="flex-1">
                    <div className="text-cyan-500 text-xs font-mono mb-1">
                      {new Date(firstMessage.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-slate-300 opacity-80">
                      "{firstMessage.sentence}"
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-red-500 text-xs font-mono mb-1">
                      {new Date(lastMessage.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-slate-300 opacity-80">
                      "{lastMessage.sentence}"
                    </div>
                  </div>
                </div>
              </section>
            </main>

            {/* 底部装饰 - 红色斗争感 */}
            <footer className="mt-auto relative h-12 bg-gradient-to-t from-[#450a0a] to-transparent flex items-center justify-center">
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-600/50"></div>
              <div className="text-[10px] text-red-200/50 font-mono tracking-[0.5em]">
                MEOWSEV SYSTEM // END OF REPORT
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
};
