import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import type { CharBaseInfo, ModInfo, CharacterInfo, Word } from "./type";

const baseURL = "https://prts.wiki/w/";
const biliURL = "https://wiki.biligame.com/arknights/";

class ArkTooler {
  async generateArknightProfile(info: CharacterInfo): Promise<string> {
    const sections = [];

    // 角色概要
    sections.push(`# ${info.baseInfo.name} 
  `);

    // 增强型基础档案
    sections.push(`## 📜 基础档案
  ${createInfoTable([
    ["种族血脉", info.baseInfo.race],
    ["形体特征", `${info.baseInfo.height}cm`],
    ["诞辰之日", info.baseInfo.birthday],
    ["专属技艺", info.baseInfo.mastery],
  ])}`);

    // 模组叙事优化
    if (info.mod.length > 0) {
      sections.push(`## 🌀 模组叙事
  ${info.mod
    .map(
      (m) =>
        `### ${m.name}
  ${formatNarrative(m.baseInfo)}`
    )
    .join("\n\n")}`);
    }

    // 动态语音库
    sections.push(`## 🎧 语音档案
  ${info.words.map((w) => `> ${w.status}: ${w.content}`).join("\n\n")}`);

    sections.push(
      `## 要求

      1. 请根据以上信息，扮演角色进行对话。
      2. 请保持角色的性格特点，并根据以上信息做出对应的回答和行为。
      `
    );
    return sections.join("\n");
  }
}

const arkTooler = new ArkTooler();

class ArkChar {
  async parseCharInfo(char: string, dirpath?: string): Promise<CharacterInfo> {
    const url = biliURL + char;
    const res = (await axios.get(url)).data;
    const $ = cheerio.load(res);

    const baseInfo = await this.parseCharBaseInfo($, char);
    const mod = await this.parseModInfo($);
    const words = await this.parseWords($);

    if (dirpath) {
      const markdown = await arkTooler.generateArknightProfile({
        baseInfo,
        mod,
        words,
      });
      if (!fs.existsSync(dirpath)) {
        fs.mkdirSync(dirpath, { recursive: true });
      }

      fs.writeFileSync(`${dirpath}/${char}.md`, markdown);
    }

    return {
      baseInfo,
      mod,
      words,
    };
  }

  async parseCharBaseInfo(
    $: cheerio.CheerioAPI,
    char: string
  ): Promise<CharBaseInfo> {
    // 使用更精确的选择器
    const targetP = $('.mw-parser-output p:contains("【专精】")');
    const content = targetP.text().trim();

    // 提取各字段信息
    const mastery = content.match(/【专精】(.*?)(?:\n|【)/s)?.[1]?.trim() || "";
    const birthday =
      content.match(/【生日】(.*?)(?:\n|【)/s)?.[1]?.trim() || "";
    const race = content.match(/【种族】(.*?)(?:\n|【)/s)?.[1]?.trim() || "";
    const height =
      content.match(/【身高】(.*?)(?:cm|\n|【)/s)?.[1]?.trim() || "";

    // 特殊处理真实姓名(移除可能的HTML标签)
    const name = char;

    return {
      name,
      birthday,
      height,
      race,
      mastery,
    };
  }

  async parseModInfo($: cheerio.CheerioAPI): Promise<ModInfo[]> {
    const mods: ModInfo[] = [];
    let modname: string[] = [];
    let modcontent: string[] = [];

    $(".opreator-module-code").each((_, element) => {
      modname.push($(element).text().trim());
    });

    $(".operator-module-story-content").each((_, element) => {
      modcontent.push($(element).text().trim());
    });

    for (let i = 0; i < modname.length; i++) {
      mods.push({
        name: modname[i],
        baseInfo: modcontent[i],
      });
    }

    return mods;
  }

  async parseWords($: cheerio.CheerioAPI): Promise<Word[]> {
    const words: Word[] = [];

    // 选择所有语音行
    $("div.operator-page-label-cell").each((_, element) => {
      // 获取语音类型
      const status = $(element).text().trim();

      // 获取对应的内容单元格
      const contentCell = $(element)
        .nextAll("div.operator-page-value-cell")
        .first();

      // 提取文本内容并移除空段落
      const content = contentCell
        .find("p")
        .not(".mw-empty-elt")
        .first()
        .text()
        .trim();

      // 如果都存在则添加到结果中
      if (status && content) {
        words.push({
          status,
          content,
        });
      }
    });

    // 如果没有找到任何语音，抛出错误
    if (words.length === 0) {
      throw new Error("未找到语音文本");
    }

    return words;
  }

  async formatCharToMarkdown(info: CharacterInfo): Promise<string> {
    // AI角色扮演提示部分
    const promptMd = `## AI角色扮演提示
  请根据以下信息扮演角色：
  - 角色名称：${info.baseInfo.name}
  - 种族：${info.baseInfo.race}
  - 身高：${info.baseInfo.height}
  - 生日：${info.baseInfo.birthday}
  - 专精：${info.baseInfo.mastery}
  - 模组：${info.mod.map((m) => m.name).join("，")}
  
  请保持该角色的性格特点，并根据以上信息做出对应的回答和行为。
  `;

    // 基础信息部分
    const baseInfoMd = `# ${info.baseInfo.name}
  
  ## 基础信息
  - 种族：${info.baseInfo.race}
  - 身高：${info.baseInfo.height}
  - 生日：${info.baseInfo.birthday}
  - 专精：${info.baseInfo.mastery}
  `;

    // 模组信息部分
    const modsMd = `
  ## 模组信息
  ${info.mod.map((m) => `### ${m.name}\n${m.baseInfo}`).join("\n\n")}
  `;

    // 语音记录部分
    const wordsMd = `
  ## 语音记录
  ${info.words.map((w) => `> **${w.status}**: ${w.content}`).join("\n\n")}
  `;

    return `${promptMd}\n${baseInfoMd}\n${modsMd}\n${wordsMd}`;
  }
}

export const arkChar = new ArkChar();

// 辅助函数
function createInfoTable(rows: string[][]): string {
  return [
    "| 属性 | 描述 |",
    "|------|------|",
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
  ].join("\n");
}

function formatNarrative(text: string): string {
  return text
    .split("\n")
    .map((para) => `> ${para.replace(/([^\n]{40,}?)\s/g, "$1  \n> ")}`)
    .join("\n>\n> \n");
}

function groupVoiceLines(words: Word[]): string {
  const groups: { [key: string]: Word[] } = {};
  words.forEach((w) => {
    const category = w.status.replace(/\d+$/, "");
    groups[category] = groups[category] || [];
    groups[category].push(w);
  });

  return Object.entries(groups)
    .map(
      ([category, lines]) =>
        `### ${categoryToIcon(category)} ${category}
${lines.map((l) => `- ${l.status}\n  "${l.content}"`).join("\n")}`
    )
    .join("\n\n");
}

function categoryToIcon(category: string): string {
  const icons: { [key: string]: string } = {
    交谈: "💬",
    晋升: "📈",
    信赖: "❤️",
    作战: "⚔️",
    日常: "☕",
    庆典: "🎉",
  };
  return icons[category] || "🎯";
}
