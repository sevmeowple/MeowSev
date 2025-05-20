import * as fs from "fs"
import * as path from "path"
import {processStoryFile} from "./index"

// 定义源文件夹路径
const storyFolder = "../../../ArknightsGameData/zh_CN/gamedata/story/obt/"
const infoFolder = "../../../ArknightsGameData/zh_CN/gamedata/story/[uc]info/obt/"
const outputFolder = "./output/"

// 确保输出文件夹存在
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder, { recursive: true });
}

/**
 * 遍历文件夹和子文件夹，查找所有 .txt 文件
 * @param folderPath 要遍历的文件夹路径
 * @returns 找到的所有 .txt 文件的路径列表
 */
function findTextFiles(folderPath: string): string[] {
  const result: string[] = [];
  
  function traverse(currentPath: string) {
    const files = fs.readdirSync(currentPath);
    
    for (const file of files) {
      const fullPath = path.join(currentPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 递归遍历子文件夹
        traverse(fullPath);
      } else if (file.toLowerCase().endsWith('.txt')) {
        // 只收集 .txt 文件
        result.push(fullPath);
      }
    }
  }
  
  traverse(folderPath);
  return result;
}

/**
 * 处理一个故事文件，找到相应的简介文件，并生成TOML输出
 * @param storyPath 故事文件路径
 * @param infoBasePath 简介文件夹基路径
 * @returns 是否成功处理
 */
function processOneStoryFile(storyPath: string, infoBasePath: string): boolean {
  try {
    // 从故事文件路径获取相对路径部分（相对于故事基路径）
    const relativePath = path.relative(storyFolder, storyPath);
    
    // 构建可能的简介文件路径
    const infoPath = path.join(infoBasePath, relativePath);
    
    // 构建输出路径
    const outputPath = path.join(outputFolder, relativePath.replace(/\.txt$/, '.toml'));
    
    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 检查简介文件是否存在
    const infoExists = fs.existsSync(infoPath);
    const infoPathToUse = infoExists ? infoPath : null;
    
    // 处理文件
    const success = processStoryFile(storyPath, infoPathToUse, outputPath);
    
    console.log(`处理文件 ${storyPath} ${success ? '成功' : '失败'}`);
    if (infoExists) {
      console.log(`- 使用简介文件: ${infoPath}`);
    } else {
      console.log(`- 没有找到简介文件`);
    }
    console.log(`- 输出到: ${outputPath}`);
    
    return success;
  } catch (error) {
    console.error(`处理文件 ${storyPath} 时出错:`, error);
    return false;
  }
}

/**
 * 主函数 - 处理所有故事文件
 */
function main() {
  // 查找所有故事文件
  const storyFiles = findTextFiles(storyFolder);
  console.log(`找到 ${storyFiles.length} 个故事文件`);
  
  // 依次处理每个故事文件
  let successCount = 0;
  let failCount = 0;
  
  for (const storyFile of storyFiles) {
    const success = processOneStoryFile(storyFile, infoFolder);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`处理完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
}

// 运行主函数
main();