// 整体群聊记录
interface OverallGroupChat {
  // 定义整体群聊的属性和方法
  // 该群的ID
  groupId: string;
  
  //   所有群友最新昵称和ID的映射table
  memberNames: Record<string, string>;
  // 顺序存储总发言排行榜
  totalSpeechesRank: Array<{ memberId: string; speechCount: number }>;
}
// 单个群友总结所需要的数据

interface HotWord {
  word: string;
  count: number;
  sentences: string[];
}

interface GMemeberSummaryData {
  // 个人年度热词->单个
  personalYearlyHotWords: HotWord[];
  // 个人总发言数
  totalSpeechCount: number;
  // 个人发言排行
  personalSpeechRank: number;
  // 前一个排名的发言总数
  previousRankSpeechCount: number;
  // 前一个人名的昵称
  previousRankMemberName: string;

  // 发表情包次数
  memeUsageCount: number;
  // 发图片次数
  imageUsageCount: number;
  // 发分享Card次数
  SharedSegmentCount: number;
  // 最活跃时间段
  mostActiveTimePeriod: string;

  MAXMentionSentenceNum: 20;
  // 提到的所有干员及其提到次数,并记录所有对应的句子
  mentionedOperators: Record<string, { count: number; sentences: string[] }>;

  // 最适配干员检测
  bestMatchingOperator: string;
  // 干员祝福语
  operatorBlessing: string;
  // 随机两句记录里关于该干员的语句
  relatedSentences: string[];

  // 自有记录以来的第一句话,带时间戳
  firstMessage: SentenceWithTimestamp;
  // 截止到12.23的最后一句话
  lastMessage: SentenceWithTimestamp;
}

interface SentenceWithTimestamp {
  timestamp: string; // 时间戳
  sentence: string; // 句子内容
}

export type { OverallGroupChat, GMemeberSummaryData, HotWord };
