import { MessageObject } from "@/utils/message";

// 骰子结果接口
interface DiceResult {
  expression: string;      // 原始表达式，如 "1d20"
  results: number[];       // 每个骰子的结果
  total: number;          // 总和
  modifier?: number;      // 修正值
  success: boolean;       // 是否成功解析
  error?: string;         // 错误信息
}

// 单个骰子投掷结果
interface SingleDice {
  sides: number;          // 骰子面数
  result: number;         // 结果
}

export class TRPGService {
  
  /**
   * 解析并投掷骰子
   * @param expression 骰子表达式，如 "1d20", "2d6+3", "3d8-1"
   * @returns 投掷结果
   */
  rollDice(expression: string): MessageObject {
    try {
      const result = this.parseDiceExpression(expression);
      
      if (!result.success) {
        return {
          type: "text",
          content: `❌ 骰子表达式错误: ${result.error}`
        };
      }

      return this.formatDiceResult(result);
      
    } catch (error) {
      console.error('投骰子失败:', error);
      return {
        type: "text",
        content: "❌ 投骰子时出现错误"
      };
    }
  }

  /**
   * 解析骰子表达式
   * @param expression 表达式字符串
   * @returns 解析结果
   */
  private parseDiceExpression(expression: string): DiceResult {
    // 清理输入，移除空格并转为小写
    const cleanExpression = expression.trim().toLowerCase();
    
    // 基础骰子表达式正则：支持 NdM±X 格式
    // 例：1d20, 2d6+3, 3d8-2, d20（默认1个）
    const diceRegex = /^(\d*)d(\d+)([+-]\d+)?$/;
    
    const match = cleanExpression.match(diceRegex);
    
    if (!match) {
      return {
        expression: cleanExpression,
        results: [],
        total: 0,
        success: false,
        error: "无效的骰子表达式。格式应为: NdM 或 NdM±X (如: 1d20, 2d6+3)"
      };
    }

    const [, diceCountStr, diceSidesStr, modifierStr] = match;
    
    // 解析参数
    const diceCount = diceCountStr ? parseInt(diceCountStr) : 1;
    const diceSides = parseInt(diceSidesStr);
    const modifier = modifierStr ? parseInt(modifierStr) : 0;

    // 验证参数
    if (diceCount < 1 || diceCount > 100) {
      return {
        expression: cleanExpression,
        results: [],
        total: 0,
        success: false,
        error: "骰子数量必须在 1-100 之间"
      };
    }

    if (diceSides < 2 || diceSides > 1000) {
      return {
        expression: cleanExpression,
        results: [],
        total: 0,
        success: false,
        error: "骰子面数必须在 2-1000 之间"
      };
    }

    // 投掷骰子
    const results: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      const roll = Math.floor(Math.random() * diceSides) + 1;
      results.push(roll);
    }

    const diceTotal = results.reduce((sum, roll) => sum + roll, 0);
    const finalTotal = diceTotal + modifier;

    return {
      expression: cleanExpression,
      results,
      total: finalTotal,
      modifier: modifier !== 0 ? modifier : undefined,
      success: true
    };
  }

  /**
   * 格式化骰子结果为消息
   * @param result 骰子结果
   * @returns 格式化的消息
   */
  private formatDiceResult(result: DiceResult): MessageObject {
    const { expression, results, total, modifier } = result;
    
    // 构建结果显示
    let content = `🎲 ${expression.toUpperCase()}\n`;
    
    // 显示每个骰子的结果
    if (results.length === 1) {
      content += `骰子结果: ${results[0]}`;
    } else {
      content += `骰子结果: [${results.join(', ')}]`;
      content += `\n骰子总和: ${results.reduce((sum, roll) => sum + roll, 0)}`;
    }
    
    // 显示修正值和最终结果
    if (modifier !== undefined) {
      const modifierStr = modifier > 0 ? `+${modifier}` : `${modifier}`;
      content += `\n修正值: ${modifierStr}`;
    }
    
    if (modifier !== undefined || results.length > 1) {
      content += `\n最终结果: ${total}`;
    }

    // 添加特殊结果提示
    const specialResult = this.getSpecialResult(results, modifier);
    if (specialResult) {
      content += `\n${specialResult}`;
    }

    return {
      type: "text",
      content
    };
  }

  /**
   * 获取特殊结果提示
   * @param results 骰子结果数组
   * @param modifier 修正值
   * @returns 特殊结果字符串或null
   */
  private getSpecialResult(results: number[], modifier?: number): string | null {
    // 检查大成功/大失败（仅对d20有效）
    if (results.length === 1) {
      const roll = results[0];
      
      // 假设是d20系统
      if (roll === 20) {
        return "🎉 天然20！大成功！";
      } else if (roll === 1) {
        return "💥 天然1！大失败！";
      }
    }

    // 检查是否全是最大值
    const allMax = results.every((roll, index) => {
      // 这里我们假设是常见的骰子面数
      const commonSides = [4, 6, 8, 10, 12, 20, 100];
      return commonSides.some(sides => roll === sides);
    });

    if (results.length > 1 && results.every(roll => roll === Math.max(...results))) {
      return "✨ 全部最大值！太幸运了！";
    }

    // 检查是否全是最小值
    if (results.length > 1 && results.every(roll => roll === 1)) {
      return "😱 全部都是1！真是倒霉...";
    }

    return null;
  }

  /**
   * 快速投掷常用骰子
   */
  quickRoll = {
    d4: () => this.rollDice("1d4"),
    d6: () => this.rollDice("1d6"),
    d8: () => this.rollDice("1d8"),
    d10: () => this.rollDice("1d10"),
    d12: () => this.rollDice("1d12"),
    d20: () => this.rollDice("1d20"),
    d100: () => this.rollDice("1d100")
  };

  /**
   * 投掷多个相同骰子（便利方法）
   * @param count 骰子数量
   * @param sides 骰子面数
   * @param modifier 修正值
   */
  rollMultiple(count: number, sides: number, modifier: number = 0): MessageObject {
    const modifierStr = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : '';
    const expression = `${count}d${sides}${modifierStr}`;
    return this.rollDice(expression);
  }

  /**
   * 获取支持的骰子格式说明
   */
  getHelp(): MessageObject {
    return {
      type: "text",
      content: `🎲 TRPG 骰子使用说明

基本格式：
• 1d20 - 投掷1个20面骰子
• 2d6 - 投掷2个6面骰子
• 3d8+2 - 投掷3个8面骰子，加2点修正
• d20 - 默认投掷1个20面骰子

常用骰子：
• d4, d6, d8, d10, d12, d20, d100

修正值：
• +N 或 -N 添加或减少修正值
• 例：1d20+5, 2d6-1

限制：
• 骰子数量：1-100个
• 骰子面数：2-1000面

特殊提示：
• 天然20显示大成功
• 天然1显示大失败
• 全最大值/最小值有特殊提示`
    };
  }
}