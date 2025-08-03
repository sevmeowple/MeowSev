import { ToolDefinition, ToolResult } from "..";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { MessageObject } from "@/utils/message";
import { fetchWeatherApi } from 'openmeteo';
import { createCanvas } from 'canvas';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

// 天气编码映射
const WEATHER_CODE_MAP: Record<number, string> = {
    0: "晴朗", 1: "主要晴朗", 2: "部分多云", 3: "阴天",
    45: "雾", 48: "结霜雾",
    51: "小毛毛雨", 53: "中毛毛雨", 55: "大毛毛雨",
    56: "轻结冰毛毛雨", 57: "重结冰毛毛雨",
    61: "小雨", 63: "中雨", 65: "大雨",
    66: "轻结冰雨", 67: "重结冰雨",
    71: "小雪", 73: "中雪", 75: "大雪",
    77: "雪粒", 80: "小阵雨", 81: "中阵雨", 82: "暴雨",
    85: "小阵雪", 86: "大阵雪",
    95: "雷暴", 96: "雷暴伴小冰雹", 99: "雷暴伴大冰雹"
};

// 天气图标映射（根据天气代码）
const WEATHER_ICONS: Record<number, string> = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️",
    56: "🌧️", 57: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "⛈️",
    66: "🌧️", 67: "🌧️",
    71: "🌨️", 73: "❄️", 75: "❄️",
    77: "🌨️", 80: "🌦️", 81: "🌧️", 82: "⛈️",
    85: "🌨️", 86: "❄️",
    95: "⛈️", 96: "⛈️", 99: "⛈️"
};

// 城市数据接口
interface CityData {
    area: string;
    city: string;
    country: string;
    lat: string;
    lng: string;
    province: string;
}

// 天气数据接口
interface WeatherData {
    location: string;
    coordinates: { latitude: number; longitude: number; };
    current: {
        temperature: number;
        humidity: number;
        windSpeed: number;
        weatherCode: number;
        time: string;
    };
    hourly: {
        time: Date[];
        temperature: number[];
        precipitation: number[];
        cloudCover: number[];
        windSpeed: number[];
        weatherCode: number[];
    };
}

// 加载本地城市数据
function loadCityData(): CityData[] {
    try {
        const dataPath = path.join(process.cwd(), 'data', 'citygeo.json');
        const data = fs.readFileSync(dataPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.warn('无法加载本地城市数据:', error);
        return [];
    }
}

// 模糊搜索城市
function fuzzySearchCity(query: string, cities: CityData[]): CityData | null {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 精确匹配
    let match = cities.find(city => 
        city.city.toLowerCase() === normalizedQuery ||
        city.area.toLowerCase() === normalizedQuery ||
        city.province.toLowerCase() === normalizedQuery
    );
    
    if (match) return match;
    
    // 包含匹配
    match = cities.find(city => 
        city.city.toLowerCase().includes(normalizedQuery) ||
        city.area.toLowerCase().includes(normalizedQuery) ||
        city.province.toLowerCase().includes(normalizedQuery)
    );
    
    if (match) return match;
    
    // 去掉"市"、"区"、"县"等后缀再匹配
    const cleanQuery = normalizedQuery.replace(/[市区县]/g, '');
    if (cleanQuery.length > 0) {
        match = cities.find(city => {
            const cleanCity = city.city.toLowerCase().replace(/[市区县]/g, '');
            const cleanArea = city.area.toLowerCase().replace(/[市区县]/g, '');
            const cleanProvince = city.province.toLowerCase().replace(/[市区县]/g, '');
            
            return cleanCity.includes(cleanQuery) ||
                   cleanArea.includes(cleanQuery) ||
                   cleanProvince.includes(cleanQuery);
        });
    }
    
    return match || null;
}

// 通过 Open-Meteo SDK 获取地理位置
async function geocodeLocation(location: string): Promise<{ lat: number; lng: number; name: string } | null> {
    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=zh&format=json`
        );
        
        if (!response.ok) {
            throw new Error(`地理编码API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            return {
                lat: result.latitude,
                lng: result.longitude,
                name: result.name
            };
        }
        
        return null;
    } catch (error) {
        console.error('地理编码失败:', error);
        return null;
    }
}

function getTimezoneByCoordinates(lat: number, lng: number): string {
    // 中国大陆及周边地区
    if (lat >= 15 && lat <= 55 && lng >= 70 && lng <= 140) {
        return "Asia/Shanghai";
    }
    // 日本
    if (lat >= 24 && lat <= 46 && lng >= 123 && lng <= 146) {
        return "Asia/Tokyo";
    }
    // 美国东部
    if (lat >= 25 && lat <= 50 && lng >= -85 && lng <= -65) {
        return "America/New_York";
    }
    // 美国西部
    if (lat >= 32 && lat <= 50 && lng >= -125 && lng <= -100) {
        return "America/Los_Angeles";
    }
    // 欧洲
    if (lat >= 35 && lat <= 72 && lng >= -10 && lng <= 40) {
        return "Europe/London";
    }
    
    // 默认使用 auto 让 API 自动检测
    return "CN";
}


// 使用 Open-Meteo SDK 获取天气数据
async function getWeatherData(lat: number, lng: number, locationName: string): Promise<WeatherData | null> {
    try {
        const timezone = getTimezoneByCoordinates(lat, lng);

        const responses = await fetchWeatherApi("https://api.open-meteo.com/v1/forecast", {
            latitude: lat,
            longitude: lng,
            current: ["temperature_2m", "relative_humidity_2m", "weather_code", "wind_speed_10m"],
            hourly: ["temperature_2m", "precipitation", "cloud_cover", "wind_speed_10m", "weather_code"],
            timezone: timezone,
            forecast_days: 3
        });

        if (!responses || responses.length === 0) {
            return null;
        }

        const response = responses[0];
        
        // 当前天气
        const current = response.current()!;
        const currentTime = new Date((Number(current.time()) + response.utcOffsetSeconds()) * 1000);
        
        // 小时预报
        const hourly = response.hourly()!;
        const hourlyTime = range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
            (t) => new Date((t + response.utcOffsetSeconds()) * 1000)
        );

        return {
            location: locationName,
            coordinates: { latitude: lat, longitude: lng },
            current: {
                temperature: current.variables(0)!.value(),
                humidity: current.variables(1)!.value(),
                weatherCode: current.variables(2)!.value(),
                windSpeed: current.variables(3)!.value(),
                time: currentTime.toISOString()
            },
            hourly: {
                time: hourlyTime,
                temperature: Array.from({ length: hourlyTime.length }, (_, i) => hourly.variables(0)!.valuesArray()![i]),
                precipitation: Array.from({ length: hourlyTime.length }, (_, i) => hourly.variables(1)!.valuesArray()![i]),
                cloudCover: Array.from({ length: hourlyTime.length }, (_, i) => hourly.variables(2)!.valuesArray()![i]),
                windSpeed: Array.from({ length: hourlyTime.length }, (_, i) => hourly.variables(3)!.valuesArray()![i]),
                weatherCode: Array.from({ length: hourlyTime.length }, (_, i) => hourly.variables(4)!.valuesArray()![i])
            }
        };
    } catch (error) {
        console.error('获取天气数据失败:', error);
        return null;
    }
}

// 辅助函数：创建时间范围
function range(start: number, stop: number, step: number): number[] {
    return Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);
}

// 生成天气图表并保存到本地
async function generateWeatherChart(weatherData: WeatherData): Promise<string> {
    const width = 1200;
    const height = 800;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 配置 Chart.js 使用 Canvas
    Chart.defaults.font.family = 'Arial, sans-serif';
    Chart.defaults.font.size = 12;

    // 准备数据 - 只取未来24小时的数据
    const next24Hours = weatherData.hourly.time.slice(0, 24);
    const temperatureData = weatherData.hourly.temperature.slice(0, 24);
    const precipitationData = weatherData.hourly.precipitation.slice(0, 24);
    const cloudCoverData = weatherData.hourly.cloudCover.slice(0, 24);
    const windSpeedData = weatherData.hourly.windSpeed.slice(0, 24);

    const chart = new Chart(ctx as any, {
        type: 'line',
        data: {
            labels: next24Hours.map(time => time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })),
            datasets: [
                {
                    label: '温度 (°C)',
                    data: temperatureData,
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: '降水量 (mm)',
                    data: precipitationData,
                    type: 'bar' as const,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: '#36a2eb',
                    yAxisID: 'y1',
                    order: 2
                },
                {
                    label: '云量 (%)',
                    data: cloudCoverData,
                    borderColor: '#feca57',
                    backgroundColor: 'rgba(254, 202, 87, 0.1)',
                    yAxisID: 'y2',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '风速 (km/h)',
                    data: windSpeedData,
                    borderColor: '#48cab2',
                    backgroundColor: 'rgba(72, 202, 178, 0.1)',
                    yAxisID: 'y3',
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: false,
            animation: false,
            plugins: {
                title: {
                    display: true,
                    text: `${weatherData.location} - 24小时天气预报`,
                    font: { size: 20, weight: 'bold' },
                    padding: 20
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '时间'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '温度 (°C)',
                        color: '#ff6b6b'
                    },
                    ticks: { color: '#ff6b6b' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '降水量 (mm)',
                        color: '#36a2eb'
                    },
                    ticks: { color: '#36a2eb' },
                    grid: { drawOnChartArea: false }
                },
                y2: {
                    type: 'linear',
                    display: false,
                    min: 0,
                    max: 100
                },
                y3: {
                    type: 'linear',
                    display: false,
                    min: 0
                }
            },
            elements: {
                point: {
                    radius: 3,
                    hoverRadius: 6
                }
            }
        }
    });

    // 等待图表渲染完成
    await new Promise(resolve => setTimeout(resolve, 100));

    // 确保输出目录存在
    const outputDir = path.join(process.cwd(), 'public', 'weather');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 生成文件名
    const timestamp = new Date().getTime();
    const fileName = `weather_${weatherData.location.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${timestamp}.png`;
    const filePath = path.join(outputDir, fileName);

    // 保存图片
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);

    // 销毁图表以释放内存
    chart.destroy();

    console.log(`✅ 天气图表已生成: ${filePath}`);
    return filePath;
}

// 导出天气工具
export const weatherTool: ToolDefinition = {
    name: 'getWeather',
    description: '获取指定地点的实时天气信息和24小时预报图表，支持中国城市名称查询',
    inputSchema: z.object({
        location: z.string().describe('城市名称，如：北京、上海、深圳、杭州等')
    }),
    execute: async ({ location }: { location: string }): Promise<ToolResult> => {
        console.log(`🔍 查询天气信息: ${location}`);
        try {
            let coordinates: { lat: number; lng: number; name: string } | null = null;
            
            // 模式1: 本地模糊搜索
            const cities = loadCityData();
            if (cities.length > 0) {
                const cityMatch = fuzzySearchCity(location, cities);
                if (cityMatch) {
                    coordinates = {
                        lat: parseFloat(cityMatch.lat),
                        lng: parseFloat(cityMatch.lng),
                        name: `${cityMatch.province}${cityMatch.city}${cityMatch.area}`.replace(/^(.+?)市(.+)$/, '$1$2') || location
                    };
                    console.log(`✅ 本地搜索找到: ${coordinates.name}`);
                }
            }
            
            // 模式2: 在线地理编码（本地搜索失败时的后备方案）
            if (!coordinates) {
                console.log(`🔍 本地搜索失败，尝试在线地理编码: ${location}`);
                coordinates = await geocodeLocation(location);
                if (coordinates) {
                    console.log(`✅ 在线搜索找到: ${coordinates.name}`);
                }
            }
            
            if (!coordinates) {
                return {
                    success: false,
                    errorInfo: `无法找到地点"${location}"的地理位置信息`,
                    aiResponse: `抱歉，我无法找到"${location}"的地理位置信息。请检查地点名称是否正确。`
                };
            }
            
            // 获取天气数据
            const weatherData = await getWeatherData(coordinates.lat, coordinates.lng, coordinates.name);
            if (!weatherData) {
                return {
                    success: false,
                    errorInfo: `无法获取"${location}"的天气数据`,
                    aiResponse: `抱歉，我无法获取"${location}"的天气数据，请稍后重试。`
                };
            }
            
            // 生成天气图表
            const chartPath = await generateWeatherChart(weatherData);
            
            // 当前天气信息
            const currentWeather = weatherData.current;
            const weatherIcon = WEATHER_ICONS[currentWeather.weatherCode] || "🌤️";
            const weatherDesc = WEATHER_CODE_MAP[currentWeather.weatherCode] || "未知天气";
            
            // 给 AI 的简化响应
            const aiResponse = `已获取${coordinates.name}的天气信息：
当前天气：${weatherDesc} ${weatherIcon}
温度：${currentWeather.temperature.toFixed(1)}°C
湿度：${currentWeather.humidity.toFixed(0)}%
风速：${currentWeather.windSpeed.toFixed(1)}km/h
我已为你生成了包含24小时温度、降水、云量和风速预报的详细图表。`;
            
            // 给用户的完整消息
            const userMessages: MessageObject[] = [
//                 {
//                     type: 'text',
//                     content: `${weatherIcon} ${coordinates.name} 当前天气：${weatherDesc}
// 🌡️ 温度：${currentWeather.temperature.toFixed(1)}°C
// 💧 湿度：${currentWeather.humidity.toFixed(0)}%
// 💨 风速：${currentWeather.windSpeed.toFixed(1)}km/h
// 📊 以下是24小时详细预报图表：`
//                 },
                {
                    type: 'image',
                    src: `file://${chartPath}`,
                    alt: `${coordinates.name}24小时天气预报图表`
                }
            ];
            
            return {
                success: true,
                aiResponse,
                userMessages
            };
            
        } catch (error) {
            console.error('天气查询失败:', error);
            return {
                success: false,
                errorInfo: `查询天气时发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
                aiResponse: '抱歉，查询天气时发生了错误，请稍后重试。'
            };
        }
    }
};