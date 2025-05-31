import { M3LogWrapper } from "@utils/m3log";
import type { Tool, ToolParameters } from "fastmcp";
import { type } from "arktype";
import fs from "fs";
import path from "path";

interface WeatherLive {
  city: string;
  weather: string;
  temperature: string;
  winddirection: string;
  windpower: string;
  humidity: string;
  reporttime: string;
}

interface WeatherCast {
  date: string;
  dayweather: string;
  daytemp: string;
  daywind: string;
  daypower: string;
  nightweather: string;
  nighttemp: string;
  nightwind: string;
  nightpower: string;
}

interface WeatherForecast {
  city: string;
  casts: WeatherCast[];
}

interface AmapResponse {
  status: string;
  info?: string;
  lives?: WeatherLive[];
  forecasts?: WeatherForecast[];
}

class WeatherTool {
  logger: M3LogWrapper = new M3LogWrapper(["WeatherTool"], false, true);
  private cityToAdcode: Map<string, string> = new Map();
  private readonly AMAP_API_BASE = "https://restapi.amap.com/v3/weather/weatherInfo";
  private readonly AMAP_API_KEY = process.env.AMAP_API_KEY || "";
  private readonly USER_AGENT = "amap-weather-mcp-server/1.0";

  constructor() {
    this.loadCityAdcodeMap();
  }

  private loadCityAdcodeMap(): boolean {
    try {
      const currentDir = __dirname;
      const csvFilePath = path.join(currentDir, "AMap_adcode_citycode.csv");
      
      if (!fs.existsSync(csvFilePath)) {
        this.logger.warn("城市编码文件不存在");
        return false;
      }

      const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
      const lines = csvContent.split('\n');
      
      // 跳过表头
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length >= 2) {
          const cityName = row[0].trim();
          const adcode = row[1].trim();
          this.cityToAdcode.set(cityName, adcode);
        }
      }
      
      this.logger.info(`加载了 ${this.cityToAdcode.size} 个城市编码`);
      return true;
    } catch (error) {
      this.logger.error(`加载城市编码文件失败: ${error}`);
      return false;
    }
  }

  private getAdcodeByCity(cityName: string): string | null {
    // 先尝试直接匹配
    if (this.cityToAdcode.has(cityName)) {
      return this.cityToAdcode.get(cityName)!;
    }

    // 如果未找到，尝试添加"市"或"省"后缀再查找
    if (!cityName.endsWith("市") && !cityName.endsWith("省")) {
      const cityWithSuffix = cityName + "市";
      if (this.cityToAdcode.has(cityWithSuffix)) {
        return this.cityToAdcode.get(cityWithSuffix)!;
      }

      const provinceWithSuffix = cityName + "省";
      if (this.cityToAdcode.has(provinceWithSuffix)) {
        return this.cityToAdcode.get(provinceWithSuffix)!;
      }
    }

    // 对于区级城市，尝试判断是否为区名
    for (const [fullName, code] of this.cityToAdcode.entries()) {
      if (cityName.includes(fullName) && (fullName.endsWith("区") || fullName.includes("区"))) {
        return code;
      }
    }

    return null;
  }

  private async makeAmapRequest(params: Record<string, string>): Promise<AmapResponse | null> {
    const searchParams = new URLSearchParams({
      ...params,
      key: this.AMAP_API_KEY
    });

    try {
      const response = await fetch(`${this.AMAP_API_BASE}?${searchParams}`, {
        headers: {
          "User-Agent": this.USER_AGENT
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`API请求失败: ${error}`);
      return null;
    }
  }

  private formatCurrentWeather(weatherData: AmapResponse): string {
    if (!weatherData || !weatherData.lives || weatherData.lives.length === 0) {
      return "无法获取天气信息或数据格式错误";
    }

    const live = weatherData.lives[0];

    return `
城市: ${live.city || '未知'}
天气: ${live.weather || '未知'}
温度: ${live.temperature || '未知'}°C
风向: ${live.winddirection || '未知'}
风力: ${live.windpower || '未知'}级
湿度: ${live.humidity || '未知'}%
发布时间: ${live.reporttime || '未知'}
`;
  }

  private formatForecastWeather(weatherData: AmapResponse): string {
    if (!weatherData || !weatherData.forecasts || weatherData.forecasts.length === 0) {
      return "无法获取天气预报信息或数据格式错误";
    }

    const forecast = weatherData.forecasts[0];
    const city = forecast.city || '未知';
    const casts = forecast.casts || [];

    if (casts.length === 0) {
      return `${city}: 无天气预报数据`;
    }

    const forecasts = casts.map(cast => `
日期: ${cast.date || '未知'}
白天天气: ${cast.dayweather || '未知'}
白天温度: ${cast.daytemp || '未知'}°C
白天风向: ${cast.daywind || '未知'}
白天风力: ${cast.daypower || '未知'}级
夜间天气: ${cast.nightweather || '未知'}
夜间温度: ${cast.nighttemp || '未知'}°C
夜间风向: ${cast.nightwind || '未知'}
夜间风力: ${cast.nightpower || '未知'}级
`);

    return `城市: ${city}\n\n${forecasts.join('\n---\n')}`;
  }

  async getCurrentWeather(city: string): Promise<string> {
    const adcode = this.getAdcodeByCity(city);
    if (!adcode) {
      return `无法找到城市'${city}'的编码，请检查城市名称是否正确`;
    }

    const params = {
      city: adcode,
      extensions: "base" // 获取实时天气
    };

    const data = await this.makeAmapRequest(params);

    if (!data) {
      return `获取${city}的天气信息失败`;
    }

    if (data.status !== "1") {
      return `API返回错误: ${data.info || '未知错误'}`;
    }

    return this.formatCurrentWeather(data);
  }

  async getWeatherForecast(city: string): Promise<string> {
    const adcode = this.getAdcodeByCity(city);
    if (!adcode) {
      return `无法找到城市'${city}'的编码，请检查城市名称是否正确`;
    }

    const params = {
      city: adcode,
      extensions: "all" // 获取未来天气预报
    };

    const data = await this.makeAmapRequest(params);

    if (!data) {
      return `获取${city}的天气预报失败`;
    }

    if (data.status !== "1") {
      return `API返回错误: ${data.info || '未知错误'}`;
    }

    return this.formatForecastWeather(data);
  }

  searchCity(keyword: string): string {
    const matchedCities: string[] = [];

    for (const cityName of this.cityToAdcode.keys()) {
      if (cityName.includes(keyword)) {
        matchedCities.push(cityName);
      }
    }

    if (matchedCities.length === 0) {
      return `未找到包含'${keyword}'的城市`;
    }

    return "找到以下匹配的城市:\n" + matchedCities.slice(0, 20).join('\n');
  }
}

const weatherTool = new WeatherTool();

const getCurrentWeatherSchema: Tool<undefined, ToolParameters> = {
  name: "get_current_weather",
  description: "获取指定城市的实时天气",
  parameters: type({
    city: "string"
  }),
  execute: async (args: any) => {
    return weatherTool.getCurrentWeather(args.city);
  }
};

const getWeatherForecastSchema: Tool<undefined, ToolParameters> = {
  name: "get_weather_forecast",
  description: "获取指定城市的天气预报（未来3-4天）",
  parameters: type({
    city: "string"
  }),
  execute: async (args: any) => {
    return weatherTool.getWeatherForecast(args.city);
  }
};

const searchCitySchema: Tool<undefined, ToolParameters> = {
  name: "search_city",
  description: "根据关键词搜索匹配的城市",
  parameters: type({
    keyword: "string"
  }),
  execute: async (args: any) => {
    return weatherTool.searchCity(args.keyword);
  }
};

export { getCurrentWeatherSchema, getWeatherForecastSchema, searchCitySchema };