import * as path from "path";
import fs from "fs";
import { ToolDefinition, ToolResult } from "..";
import { z } from "zod";
import { MessageObject } from "@/utils/message";
import axios from "axios";
import pinyin from "pinyin";
import { tsxToPic } from "@/utils/plugin/browser/tsxToPic";
import WeatherCard, { WeatherData } from "@/view/WeatherCard";

/* ------------------------------------------------------------------ */
/* 1. Open-Meteo API Functions                                       */
/* ------------------------------------------------------------------ */

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  country_code: string;
  timezone: string;
  country: string;
}

async function fetchGeocoding(location: string): Promise<GeoResult> {
  const url = `https://geocoding-api.open-meteo.com/v1/search`;
  console.log(`📡 获取地理位置信息: ${location}`);
  
  const search = async (name: string) => {
    const response = await axios.get(url, {
      params: {
        name: name,
        count: 5,
        language: 'zh',
        format: 'json'
      },
      timeout: 10000
    });
    return response.data.results;
  };

  try {
    let results = await search(location);

    if (!results || results.length === 0) {
       // 尝试拼音 fallback
       try {
           // @ts-ignore
           const pinyinResult = pinyin(location, {
               style: pinyin.STYLE_NORMAL
           });
           const pinyinName = pinyinResult.flat().join("");
           
           if (pinyinName && pinyinName !== location) {
               console.log(`⚠️ 原名未找到，尝试使用拼音搜素: ${pinyinName}`);
               results = await search(pinyinName);
           }
       } catch (pyError) {
           console.warn("拼音转换失败:", pyError);
       }
    }

    if (!results || results.length === 0) {
      throw new Error(`未找到位置: ${location}`);
    }

    return results[0];
  } catch (error) {
    console.error("Geocoding failed:", error);
    throw new Error(`无法获取位置信息: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast`;
  console.log(`📡 获取天气数据 (Lat: ${lat}, Lon: ${lon})`);

  try {
    const response = await axios.get(url, {
      params: {
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
        hourly: 'temperature_2m,weather_code,precipitation_probability',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max',
        timezone: 'auto',
        wind_speed_unit: 'ms'
      },
      timeout: 15000
    });

    return response.data as WeatherData;
  } catch (error) {
    console.error("Weather fetch failed:", error);
    throw new Error(`无法获取天气数据: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/* ------------------------------------------------------------------ */
/* 2. Tool Definition                                                */
/* ------------------------------------------------------------------ */

export const weatherAltTool: ToolDefinition = {
  name: "getWeather",
  description: "查询天气信息，支持全球城市名",
  inputSchema: z.object({
    location: z
      .string()
      .describe("城市名称，如：北京、上海、Tokyo、New York"),
  }),
  execute: async ({ location }): Promise<ToolResult> => {
    console.log(`🔍 开始天气查询任务: ${location}`);
    
    try {
      // 1. Get Coordinates
      const geoInfo = await fetchGeocoding(location);
      const { latitude, longitude, name, country } = geoInfo;
      const displayName = `${name}${country ? `, ${country}` : ''}`;
      
      // 2. Get Weather Data
      const weatherData = await fetchWeatherData(latitude, longitude);
      
      // 3. Render Image
      const outputDir = path.join(process.cwd(), "public", "weather");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const safeName = location.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
      const fileName = `weather_${safeName}_${Date.now()}.png`;
      
      const imagePath = await tsxToPic(WeatherCard, {
        data: weatherData,
        locationName: displayName
      }, {
        width: 500,
        height: 800, // Explicit height, or auto
        outputDir: outputDir,
        outputFileName: fileName,
        deviceScaleFactor: 2,
        selector: 'body > div' // Ensure we capture the card div
      });
      
      console.log(`✅ 天气卡片已生成: ${imagePath}`);
      
      const aiResponse = `已生成 ${displayName} 的天气预报卡片`;
      
      const userMessages: MessageObject[] = [{
        type: "image",
        src: `file://${imagePath}`,
        alt: aiResponse,
      }];
      
      return {
        success: true,
        responseType: "image",
        resUrl: `file://${imagePath}`,
        aiResponse,
        userMessages,
      };

    } catch (error) {
      console.error("天气查询失败:", error);
      return {
        success: false,
        errorInfo: `查询失败: ${error instanceof Error ? error.message : "未知错误"}`,
        aiResponse: `抱歉，查询 ${location} 天气失败。${error instanceof Error ? error.message : ""}`,
      };
    }
  },
};
