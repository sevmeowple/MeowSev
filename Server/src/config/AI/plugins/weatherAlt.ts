// src/config/AI/plugins/weatherAlt.ts
import { browserManager } from "@utils/browser";
import * as path from "path";
import fs from "fs";
import { ToolDefinition, ToolResult } from "..";
import { z } from "zod";
import { MessageObject } from "@/utils/message";
import axios from "axios";
import { processWeatherData, renderTemplate, type WeatherData } from "./utils/weatherDataProcessor";

/* ------------------------------------------------------------------ */
/* 1. 获取JSON天气数据                                               */
/* ------------------------------------------------------------------ */
async function fetchWeatherData(location: string) {
  try {
    const url = buildSafeWeatherUrl(location, 'j1'); // JSON格式
    console.log(`📡 获取JSON天气数据: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 30000,
      responseType: 'text' // 先以文本形式获取，再手动解析
    });
    
    console.log('API返回的原始数据类型:', typeof response.data);
    console.log('API返回的前200字符:', response.data.substring(0, 200));
    
    // 检查返回的数据
    let jsonData;
    if (typeof response.data === 'string') {
      // 清理可能的非JSON字符
      const cleanData = response.data.trim();
      
      // 检查是否以{开头（JSON对象）
      if (!cleanData.startsWith('{')) {
        throw new Error(`API返回的不是JSON格式数据，内容开头: ${cleanData.substring(0, 100)}`);
      }
      
      try {
        jsonData = JSON.parse(cleanData);
      } catch (parseError) {
        console.error('JSON解析错误，原始数据:', cleanData.substring(0, 500));
        throw new Error(`JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    } else if (typeof response.data === 'object') {
      // 如果axios已经解析为对象，直接使用
      jsonData = response.data;
    } else {
      throw new Error(`未预期的响应数据类型: ${typeof response.data}`);
    }
    
    // 验证必要的数据结构
    if (!jsonData.current_condition || !jsonData.weather) {
      throw new Error('API返回的数据结构不完整，缺少必要字段');
    }
    
    return jsonData;
    
  } catch (error) {
    console.error("获取JSON数据失败:", error);
    
    // 如果主要API失败，尝试备用方案
    if ((error as any)?.code === 'ECONNABORTED' || (error as any)?.code === 'ENOTFOUND') {
      console.log('尝试备用天气数据获取方案...');
      return await fetchWeatherDataFallback(location);
    }
    
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* 1.1 备用天气数据获取方案                                          */
/* ------------------------------------------------------------------ */
async function fetchWeatherDataFallback(location: string) {
  try {
    // 尝试不同的格式参数
    const formats = ['j1', 'json', '%j'];
    
    for (const format of formats) {
      try {
        const url = `https://wttr.in/${encodeURIComponent(location)}?format=${format}`;
        console.log(`🔄 尝试备用格式: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'curl/7.68.0',
            'Accept': '*/*',
          },
          timeout: 15000,
          responseType: 'text'
        });
        
        if (response.data && response.data.trim().startsWith('{')) {
          return JSON.parse(response.data.trim());
        }
        
      } catch (formatError) {
        console.log(`格式 ${format} 失败，尝试下一个...`);
        continue;
      }
    }
    
    throw new Error('所有备用方案都失败了');
    
  } catch (error) {
    console.error("备用方案也失败了:", error);
    throw new Error(`无法获取${location}的天气数据，请检查网络连接或稍后重试`);
  }
}

/* ------------------------------------------------------------------ */
/* 2. 创建可爱的天气卡片HTML                                         */
/* ------------------------------------------------------------------ */
function createCuteWeatherCard(weatherData: WeatherData, location: string): string {
  // 读取HTML模板
  const templatePath = path.join(__dirname, 'templates', 'weatherCard.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  
  // 处理天气数据
  const processedData = processWeatherData(weatherData, location);
  
  // 渲染模板
  return renderTemplate(template, processedData);
}

/* ------------------------------------------------------------------ */
/* 3. 混合截图函数：获取JSON数据并渲染可爱卡片                        */
/* ------------------------------------------------------------------ */
async function createCuteWeatherScreenshot(
  location: string,
  outputPath: string,
  options: { width?: number; height?: number } = {}
): Promise<{ weatherData: WeatherData; screenshotPath: string }> {
  const { width = 500, height = 800 } = options;
  
  try {
    // Step 1: 获取JSON天气数据
    const weatherData = await fetchWeatherData(location);
    console.log(`✅ 获取到完整天气数据`);
    
    // Step 2: 创建可爱的天气卡片HTML
    const htmlContent = createCuteWeatherCard(weatherData, location);
    
    // Step 3: 保存临时HTML文件
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const tempHtmlPath = path.join(tempDir, `cute_weather_${location.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}_${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
    
    console.log(`📄 可爱天气卡片HTML已创建`);
    
    // Step 4: 用Puppeteer渲染截图
    const page = await browserManager.newPage();
    
    try {
      await page.setViewport({ width, height, deviceScaleFactor: 2 }); // 高清截图
      
      const fileUrl = `file://${tempHtmlPath}`;
      await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // 等待页面完全渲染和动画
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 截图天气卡片
      const cardElement = await page.$('.weather-card');
      if (cardElement) {
        const screenshotBuffer = await cardElement.screenshot({ 
          type: 'png'
        });
        fs.writeFileSync(outputPath, screenshotBuffer);
      } else {
        const screenshotBuffer = await page.screenshot({ 
          fullPage: true,
          type: 'png'
        });
        fs.writeFileSync(outputPath, screenshotBuffer);
      }
      
      console.log(`📸 可爱天气卡片截图已保存: ${outputPath}`);
      
      await page.close();
      fs.unlinkSync(tempHtmlPath); // 清理临时文件
      
      return {
        weatherData,
        screenshotPath: outputPath
      };
      
    } catch (puppeteerError) {
      await page.close();
      if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
      throw puppeteerError;
    }
    
  } catch (error) {
    console.error("创建可爱天气卡片失败:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* 4. URL构建函数                                                     */
/* ------------------------------------------------------------------ */
function buildSafeWeatherUrl(location: string, format: string = 'T') {
  const citySafe = location
    .trim()
    .replace(/[^A-Za-z0-9\u4e00-\u9fff\-+ ]+/g, "")
    .slice(0, 64);
    
  if (/^[\d.]+$|^[\d-]+,[\d-]+$|^@/.test(citySafe)) {
    throw new Error("输入包含不支持的格式（坐标/IP/域名）");
  }
  
  if (!citySafe.trim()) {
    throw new Error("位置名称不能为空");
  }
  
  return `https://wttr.in/${encodeURIComponent(citySafe.replace(/ /g, "+"))}?format=${format}`;
}

/* ------------------------------------------------------------------ */
/* 5. 天气工具定义                                                    */
/* ------------------------------------------------------------------ */
export const weatherAltTool: ToolDefinition = {
  name: "getWeather", 
  description: "查询天气信息，支持中英文城市名",
  inputSchema: z.object({
    location: z
      .string()
      .describe("城市名称，如：北京、上海、深圳、New York、London；支持中英文"),
  }),
  execute: async ({ location }): Promise<ToolResult> => {
    console.log(`🔍 查询${location}的天气并生成可爱卡片`);
    
    try {
      // 准备输出目录和文件路径
      const outputDir = path.join(process.cwd(), "public", "weather");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const safeCityName = location.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
      const fileName = `cute_weather_${safeCityName}_${Date.now()}.png`;
      const filePath = path.join(outputDir, fileName);
      
      // 创建可爱天气卡片
      const result = await createCuteWeatherScreenshot(location, filePath, {
        width: 500,
        height: 800
      });
      
      console.log(`✅ 成功生成${location}的可爱天气卡片`);
      
      // 构建AI回复文本
      const current = result.weatherData.current_condition[0];
      const today = result.weatherData.weather[0];
      
      const aiResponse = `已为${location}生成可爱的天气卡片！

当前天气：${current.weatherDesc[0].value}
温度：${current.temp_C}°C (体感 ${current.FeelsLikeC}°C)
今日温度范围：${today.mintempC}°C ~ ${today.maxtempC}°C
湿度：${current.humidity}% | 风速：${current.windspeedKmph}km/h
日出：${today.astronomy[0].sunrise} | 日落：${today.astronomy[0].sunset}
月相：${today.astronomy[0].moon_phase}

卡片已生成完毕，包含详细的天气信息和未来预报～`;

      const userMessages: MessageObject[] = [{
        type: "image",
        src: `file://${filePath}`,
        alt: `${location}的可爱天气卡片`,
      }];
      
      return {
        success: true,
        responseType: "text",
        aiResponse,
        userMessages,
      };
      
    } catch (error) {
      console.error("生成可爱天气卡片失败:", error);
      
      return {
        success: false,
        errorInfo: `生成天气卡片时发生错误: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
        aiResponse: `抱歉，无法为${location}生成天气卡片。请检查城市名称是否正确，或稍后重试。错误：${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
};