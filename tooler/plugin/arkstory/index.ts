import * as fs from "fs"
import { stringify } from "smol-toml"

interface Dialog {
  character: string;
  text: string;
}

interface ArkStory {
  header: Record<string, any>;
  intro?: string;   // 添加简介字段
  dialogs: Dialog[];
}

function parseArkStory(content: string, introContent?: string): ArkStory {
  const result: ArkStory = {
    header: {},
    dialogs: []
  };
  
  // 如果提供了简介内容，添加到结果中
  if (introContent) {
    result.intro = introContent.trim();
  }
  
  // 提取HEADER标签内容
  const headerRegex = /\[HEADER\((.*?)\)\]/;
  const headerMatch = headerRegex.exec(content);
  
  if (headerMatch && headerMatch[1]) {
    const headerParams = headerMatch[1];
    // 使用更精确的正则表达式解析键值对，考虑引号内的逗号
    const keyValueRegex = /(\w+)\s*=\s*(?:"([^"]+)"|(\w+))/g;
    let kvMatch;
    
    while ((kvMatch = keyValueRegex.exec(headerParams)) !== null) {
      const key = kvMatch[1];
      // 值可能在第2个或第3个捕获组
      let value: any = kvMatch[2] !== undefined ? kvMatch[2] : kvMatch[3];
      
      // 处理布尔值和数字
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && typeof value === 'string') value = Number(value);
      
      result.header[key] = value;
    }
  }
  
  // 修复对话提取正则表达式
  // 首先匹配[name="角色名"]标签和其后的文本
  const nameRegex = /\[name="([^"]+)"\]\s*(.*?)(?=\[name="|\[(?!name=)|$)/gs;
  let nameMatch;
  
  while ((nameMatch = nameRegex.exec(content)) !== null) {
    const character = nameMatch[1];
    let dialogText = nameMatch[2].trim();
    
    // 如果对话文本不为空
    if (dialogText) {
      // 过滤掉所有 [...] 格式的标签
      dialogText = dialogText.replace(/\[.*?\]/g, '').trim();
      
      // 只有在文本不为空的情况下才添加对话
      if (dialogText) {
        result.dialogs.push({
          character,
          text: dialogText
        });
      }
    }
  }
  
  return result;
}

function convertToToml(story: ArkStory): string {
  // 使用 smol-toml 的 stringify 函数
  try {
    // 准备用于 stringify 的对象
    const tomlObj: any = {
      header: story.header,
    };
    
    // 如果有简介，添加到TOML对象
    if (story.intro) {
      tomlObj.intro = story.intro;
    }
    
    // 添加对话
    tomlObj.dialogs = story.dialogs;
    
    return stringify(tomlObj);
  } catch (error) {
    console.error('转换为TOML时出错:', error);
    
    // 如果 stringify 失败，回退到手动生成 TOML
    let toml = '';
    
    // 添加header部分
    toml += '[header]\n';
    Object.entries(story.header).forEach(([key, value]) => {
      if (typeof value === 'string') {
        toml += `${key} = "${value}"\n`;
      } else {
        toml += `${key} = ${value}\n`;
      }
    });
    
    // 添加简介部分
    if (story.intro) {
      toml += '\n# 故事简介\n';
      toml += `intro = """${story.intro}"""\n`;
    }
    
    // 添加对话部分
    if (story.dialogs.length > 0) {
      toml += '\n';
      story.dialogs.forEach((dialog) => {
        toml += '[[dialogs]]\n';
        toml += `character = "${dialog.character}"\n`;
        toml += `text = "${dialog.text.replace(/"/g, '\\"')}"\n\n`;
      });
    } else {
      toml += '\n# 没有找到对话内容\n';
    }
    
    return toml;
  }
}

// 修改主函数，接收简介文件路径
function processStoryFile(filePath: string, introPath: string | null, outputPath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 如果提供了简介文件路径，读取简介内容
    let introContent: string | undefined;
    if (introPath && fs.existsSync(introPath)) {
      introContent = fs.readFileSync(introPath, 'utf8');
    }
    
    const story = parseArkStory(content, introContent);
    const tomlContent = convertToToml(story);
    
    fs.writeFileSync(outputPath, tomlContent);
    // console.log(`成功将故事内容转换为TOML格式，输出到: ${outputPath}`);
    
    // 打印一下提取的结果便于调试
    // console.log(`提取了 ${Object.keys(story.header).length} 个header键值对`);
    if (story.intro) {
      // console.log(`提取了简介: ${story.intro.substring(0, 50)}${story.intro.length > 50 ? '...' : ''}`);
    }
    // console.log(`提取了 ${story.dialogs.length} 条对话`);
    if (story.dialogs.length > 0) {
      // console.log("第一条对话示例:", story.dialogs[0]);
    }
    return true;
  } catch (error) {
    console.error('处理文件时出错:', error);
    return false;
  }
}

// 处理命令行参数
function parseCommandLineArgs(): { storyPath: string, introPath: string | null, outputPath: string } {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('使用方法: node script.js <故事文件路径> [简介文件路径] [输出文件路径]');
    process.exit(1);
  }
  
  const storyPath = args[0];
  const introPath = args.length > 1 ? args[1] : null;
  const outputPath = args.length > 2 ? args[2] : storyPath.replace(/\.txt$/, '.toml');
  
  return { storyPath, introPath, outputPath };
}

// 如果是直接运行脚本，处理文件
if (require.main === module) {
  // 从命令行参数获取路径
  const { storyPath, introPath, outputPath } = parseCommandLineArgs();
  processStoryFile(storyPath, introPath, outputPath);
}

// 导出函数供其他模块使用
export { parseArkStory, convertToToml, processStoryFile };