import path from "path";
import * as fs from "fs";

import { browserManager } from "@utils/browser";

class ArkNights {
  dir: string = path.join(process.cwd(), "data", "arknights");

  constructor() {
    // 检查目录是否存在
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  /**
   * @description  2025-2-2 骰子游戏 返回n个骰子的随机结果
   *
   * @async
   * @param {number} n
   * @returns {*}
   */
  async RandomDice(n: number,m: number) {
    let res = [];
    for (let i = 0; i < n; i++) {
      res.push(Math.floor(Math.random() * m) + 1);
    }
    let res_str = res.join(" ");
    return res_str;
  }
}

export const ark = new ArkNights();
