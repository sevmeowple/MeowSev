import { browserManager } from "@utils";
import * as fs from "fs";
import * as path from "path";
// {
//   "夜刀": {
//     "name": "夜刀",
//     "profession": "先锋",
//     "tagList": [
//       "新手"
//     ],
//     "rarity": 1,
//     "position": "近战位"
//   },
//   "芬": {
//     "name": "芬",
//     "profession": "先锋",
//     "tagList": [
//       "费用回复"
//     ],
//     "rarity": 2,
//     "position": "近战位"
//   },}
interface Tag {
  name: string;
  profession: string;
  tagList: string[];
  rarity: number;
  position: string;
}

interface TagList {
  [key: string]: Tag;
}

class PRTS {
  url: string = "https://prts.wiki/";
  dir: string = path.join(process.cwd(), "data", "Arknights", "prts");
  tagList: TagList = {};
  // https://prts.wiki/index.php?search=%E6%8B%B1%E9%97%A8&title=%E7%89%B9%E6%AE%8A%3A%E6%90%9C%E7%B4%A2&go=%E5%89%8D%E5%BE%80
  constructor() {
    const dataPath = path.join(this.dir, "tagList.json");
    if (fs.existsSync(dataPath)) {
      this.tagList = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    } else {
      this.tagList = {};
      console.error("tagList.json not found");
    }
  }



  /**
   *
   * @param keyword
   * @returns
   * @description 搜索关键字,返回搜索结果的截图的路径
   */
  async search(keyword: string): Promise<string> {
    // const dir = path.join(process.cwd(), "data", "Arknights", "prts");

    // 确保目录存在,不存在则递归创建
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }

    const browser = await browserManager.getBrowser();
    const page = await browser.newPage();
    await page.goto(
      `${this.url}index.php?search=${encodeURIComponent(
        keyword
      )}&title=特殊:搜索&go=前往`
    );

    console.log(
      `${this.url}index.php?search=${encodeURIComponent(
        keyword
      )}&title=特殊:搜索&go=前往`
    );
    // 截图class为searchresults的元素,存放到@data/Arknights/prts
    // 名称为searchresults.png
    // 等待任一元素出现
    await Promise.race([
      page.waitForSelector(".searchresults"),
      page.waitForSelector("#mw-content-text"),
    ]);

    // 检查是否存在搜索结果页
    const searchResults = await page.$(".searchresults");
    const element = searchResults || (await page.$("#mw-content-text"));

    if (!element) {
      throw new Error("No content element found");
    }

    const searchResultsPath = path.join(this.dir, "searchresults.png");
    await element.screenshot({ path: searchResultsPath });
    await page.close();

    return searchResultsPath;
  }

  async tagGacha(tags: string[]): Promise<string[]> {
    // console.log("tags", tags);
    // 创建一个深拷贝，避免修改原始数组
    let remainingTags = [...tags];

    // 检查最后一个tag是否为4,5,6或者"4","5","6"
    const lastTag = remainingTags[remainingTags.length - 1];
    // console.log("lastTag", lastTag);
    if (lastTag && (lastTag == "4" || lastTag == "5" || lastTag == "6")) {
      // console.log("lastTag is a number");
      // 剔除最后一个tag
      remainingTags = remainingTags.slice(0, -1);
      return await this.tagGachaTar(remainingTags, parseInt(lastTag));
    }

    // 使用映射表简化匹配逻辑
    const rarityMapping = {
      "高级资深干员": 5,
      "高资": 5,
      "资深干员": 4
    };

    const professions = ["先锋", "近卫", "狙击", "医疗", "术师", "特种", "辅助", "重装", "医师"];
    const positions = ["近战位", "远程位"];

    // 初始化结果对象
    let checkTag: Tag = {
      name: "",
      profession: "",
      tagList: [],
      rarity: 0,
      position: "",
    };

    // 处理稀有度标签
    for (const [tag, value] of Object.entries(rarityMapping)) {
      if (remainingTags.includes(tag)) {
        checkTag.rarity = value;
        // 找到稀有度标签后立即从数组中移除
        remainingTags = remainingTags.filter(t => t !== tag);
        break; // 只匹配一个最高稀有度
      }
    }

    // 处理职业标签
    const professionTag = remainingTags.find(tag => professions.includes(tag));
    // 或者匹配profession+"干员"
    if (!professionTag) {
      const professionTag2 = remainingTags.find(tag => professions.includes(tag.slice(0, -2)));
      if (professionTag2) {
        checkTag.profession = professionTag2;
        remainingTags = remainingTags.filter(tag => tag !== professionTag2);
      }
    }
    if (professionTag) {
      checkTag.profession = professionTag;
      remainingTags = remainingTags.filter(tag => tag !== professionTag);
    }

    // 处理位置标签
    const positionTag = remainingTags.find(tag => positions.includes(tag));
    if (positionTag) {
      checkTag.position = positionTag;
      remainingTags = remainingTags.filter(tag => tag !== positionTag);
    }

    // 剩余的都是普通标签
    checkTag.tagList = remainingTags;

    // 确保tagList存在
    if (!this.tagList) {
      console.error("tagList is not initialized");
      return [];
    }

    // console.log("checkTag", checkTag);

    // 在匹配开始前检查 tagList 内容
    // console.log("tagList sample:", Object.keys(this.tagList).slice(0, 3));

    // 查找匹配的干员
    let matchedChar: string[] = [];
    for (const [char, charTag] of Object.entries(this.tagList)) {
      // 稀有度匹配 - 如果设置了稀有度筛选，才进行筛选
      if (checkTag.rarity > 0 && charTag.rarity !== checkTag.rarity) {
        continue;
      }

      // 职业匹配 - 如果设置了职业筛选，才进行筛选
      if (checkTag.profession && charTag.profession !== checkTag.profession) {
        continue;
      }

      // 位置匹配 - 如果设置了位置筛选，才进行筛选
      if (checkTag.position && charTag.position !== checkTag.position) {
        continue;
      }

      // 标签匹配 - 所有标签都必须匹配
      if (checkTag.tagList.length > 0) {
        // 将所有标签合并为一个字符串，便于检查
        const charTagsStr = charTag.tagList.join(' ');

        // 检查每个标签是否在合并后的字符串中存在
        const allTagsMatch = checkTag.tagList.every(tag =>
          charTagsStr.includes(tag)
        );

        if (!allTagsMatch) {
          continue;
        }
      }

      // console.log("matched", char);

      matchedChar.push(char);
    }

    // 在函数末尾添加
    // console.log("Matched characters:", matchedChar);
    return matchedChar;
  }

  /**
   * 标签抽卡模拟器 - 找出能锁定高星干员的最小标签组合
   * @param tags 用户选择的标签数组
   * @param rarity 目标稀有度（默认为4）
   * @returns 能锁定高星干员的有效标签组合
   */
  async tagGachaTar(tags: string[], rarity: number = 4): Promise<string[]> {
    // 确保tagList已初始化
    if (!this.tagList) {
      console.error("tagList is not initialized");
      return [];
    }

    // 创建一个深拷贝，避免修改原始数组
    let remainingTags = [...tags];

    // 使用Set记录已经找到的有效组合，避免重复检查
    const validCombinations: Set<string> = new Set();

    // 按组合大小排序，先检查小组合
    // 首先检查单标签
    for (const tag of tags) {
      // 检查单个标签是否能锁定高星干员
      if (this.canLockHighRarity([tag], rarity)) {
        validCombinations.add(tag);
      }
    }

    // 检查双标签组合，但排除已经包含有效单标签的组合
    for (let i = 0; i < tags.length; i++) {
      // 如果单个标签已经有效，跳过包含它的组合
      if (validCombinations.has(tags[i])) continue;

      for (let j = i + 1; j < tags.length; j++) {
        // 如果第二个标签已经有效，也跳过
        if (validCombinations.has(tags[j])) continue;

        const combo = [tags[i], tags[j]].sort().join(',');
        if (this.canLockHighRarity([tags[i], tags[j]], rarity)) {
          validCombinations.add(combo);
        }
      }
    }

    // 检查三标签组合，但排除已经包含有效组合的
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        // 检查当前两个标签是否构成有效组合
        const subCombo = [tags[i], tags[j]].sort().join(',');
        if (validCombinations.has(subCombo)) continue;

        // 检查当前标签是否单独有效
        if (validCombinations.has(tags[i]) || validCombinations.has(tags[j])) continue;

        for (let k = j + 1; k < tags.length; k++) {
          // 检查第三个标签是否单独有效
          if (validCombinations.has(tags[k])) continue;

          // 检查其他两个标签的组合是否有效
          const subCombo2 = [tags[i], tags[k]].sort().join(',');
          const subCombo3 = [tags[j], tags[k]].sort().join(',');
          if (validCombinations.has(subCombo2) || validCombinations.has(subCombo3)) continue;

          // 如果所有子组合都不是有效的，检查这个三标签组合
          const combo = [tags[i], tags[j], tags[k]].sort().join(',');
          if (this.canLockHighRarity([tags[i], tags[j], tags[k]], rarity)) {
            validCombinations.add(combo);
          }
        }
      }
    }

    // 修复：使用 map 而不是 flatMap，保留标签组合关系
    return Array.from(validCombinations);
  }

  /**
   * 检查标签组合是否能锁定高星干员
   * @param tagCombo 标签组合
   * @param minRarity 最低稀有度要求
   * @returns 是否能锁定高星干员
   */
  private canLockHighRarity(tagCombo: string[], minRarity: number): boolean {
    // 查找匹配这个标签组合的所有干员
    const matchedOperators: { name: string, rarity: number }[] = [];

    operatorLoop:
    for (const charName of Object.keys(this.tagList)) {
      const charData = this.tagList[charName];

      // 检查干员是否匹配所有标签
      for (const tag of tagCombo) {
        // 检查稀有度标签
        if (tag === "高级资深干员" && charData.rarity !== 6) continue operatorLoop;
        if (tag === "资深干员" && charData.rarity !== 5) continue operatorLoop;
        if (tag === "新手" && charData.rarity !== 1) continue operatorLoop;

        // 检查职业标签
        if (["先锋", "近卫", "狙击", "医疗", "术师", "特种", "辅助", "重装", "医师"].includes(tag) &&
          charData.profession !== tag) {
          continue operatorLoop;
        }

        // 检查位置标签
        if (["近战位", "远程位"].includes(tag) &&
          charData.position !== tag) {
          continue operatorLoop;
        }

        // 检查普通标签
        if (!["高级资深干员", "资深干员", "新手",
          "先锋", "近卫", "狙击", "医疗", "术师", "特种", "辅助", "重装", "医师",
          "近战位", "远程位"].includes(tag) &&
          !charData.tagList.includes(tag)) {
          continue operatorLoop;
        }
      }

      // 如果通过所有检查，则干员匹配该标签组合
      matchedOperators.push({
        name: charName,
        rarity: charData.rarity
      });
    }

    // 如果匹配到的干员为空，返回false
    if (matchedOperators.length === 0) return false;

    // 检查是否所有匹配的干员都是指定稀有度及以上
    return matchedOperators.every(op => op.rarity >= minRarity);
  }
}



export const prts = new PRTS();
