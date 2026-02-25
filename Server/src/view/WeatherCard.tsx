import React from 'react';
import {
    WiDaySunny,
    WiCloudy,
    WiRain,
    WiSnow,
    WiThunderstorm,
    WiDayCloudy,
    WiFog,
    WiShowers,
    WiDayHaze
} from 'react-icons/wi';
import {
    BiWind,
    BiWater,
    BiTime,
    BiCalendar,
    BiMap
} from 'react-icons/bi';
import { FaTemperatureHigh, FaTemperatureLow, FaTint } from "react-icons/fa";

// Types based on OpenMeteo API response
export interface WeatherData {
    current: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        is_day: number;
        precipitation: number;
        weather_code: number;
        cloud_cover: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
        time: string;
    };
    daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        sunrise: string[];
        sunset: string[];
        precipitation_probability_max: number[];
    };
    hourly: {
        time: string[];
        temperature_2m: number[];
        weather_code: number[];
        precipitation_probability: number[];
    };
    current_units: {
        temperature_2m: string;
        wind_speed_10m: string;
        precipitation: string;
    };
}

export interface WeatherCardProps {
    data: WeatherData;
    locationName: string;
}

// Catppuccin Latte Colors
const COLORS = {
    base: '#eff1f5',
    mantle: '#e6e9ef',
    crust: '#dce0e8',
    text: '#4c4f69',
    subtext0: '#6c6f85',
    subtext1: '#5c5f77',
    surface0: '#ccd0da',
    surface1: '#bcc0cc',
    surface2: '#acb0be',
    overlay0: '#9ca0b0',
    overlay1: '#8c8fa1',
    overlay2: '#7c7f93',
    blue: '#1e66f5',
    lavender: '#7287fd',
    sapphire: '#209fb5',
    sky: '#04a5e5',
    teal: '#179299',
    green: '#40a02b',
    yellow: '#df8e1d',
    peach: '#fe640b',
    maroon: '#e64553',
    red: '#d20f39',
    mauve: '#8839ef',
    pink: '#ea76cb',
    flamingo: '#dd7878',
    rosewater: '#dc8a78',
    // Custom requested light pink
    lightPink: '#fcecf6',
    palePinkBorder: '#f3d1e9'
};

const getWeatherIcon = (code: number, size: number = 24, color: string = COLORS.text) => {
    const props = { size, color };
    switch (code) {
        case 0: return <WiDaySunny {...props} color={COLORS.yellow} />;
        case 1:
        case 2: return <WiDayCloudy {...props} color={COLORS.yellow} />;
        case 3: return <WiCloudy {...props} color={COLORS.overlay2} />;
        case 45:
        case 48: return <WiFog {...props} color={COLORS.overlay1} />;
        case 51:
        case 53:
        case 55: return <WiShowers {...props} color={COLORS.sky} />;
        case 61:
        case 63:
        case 65: return <WiRain {...props} color={COLORS.blue} />;
        case 71:
        case 73:
        case 75: return <WiSnow {...props} color={COLORS.sapphire} />;
        case 77: return <WiSnow {...props} color={COLORS.sapphire} />;
        case 80:
        case 81:
        case 82: return <WiShowers {...props} color={COLORS.blue} />;
        case 85:
        case 86: return <WiSnow {...props} color={COLORS.sapphire} />;
        case 95:
        case 96:
        case 99: return <WiThunderstorm {...props} color={COLORS.mauve} />;
        default: return <WiDaySunny {...props} />;
    }
};

const getWeatherDesc = (code: number) => {
    switch (code) {
        case 0: return "晴朗";
        case 1: return "主要晴朗";
        case 2: return "局部多云";
        case 3: return "阴天";
        case 45: return "雾";
        case 48: return "沉积雾";
        case 51: return "毛毛雨(轻)";
        case 53: return "毛毛雨(中)";
        case 55: return "毛毛雨(密)";
        case 56: return "冻雨(轻)";
        case 57: return "冻雨(密)";
        case 61: return "小雨";
        case 63: return "中雨";
        case 65: return "大雨";
        case 66: return "冻雨(轻)";
        case 67: return "冻雨(重)";
        case 71: return "小雪";
        case 73: return "中雪";
        case 75: return "大雪";
        case 77: return "雪粒";
        case 80: return "阵雨(轻)";
        case 81: return "阵雨(中)";
        case 82: return "阵雨(暴)";
        case 85: return "阵雪(轻)";
        case 86: return "阵雪(重)";
        case 95: return "雷雨";
        case 96: return "雷雨伴冰雹";
        case 99: return "强雷暴伴冰雹";
        default: return "未知";
    }
};

const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const getDayName = (isoString: string) => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const d = new Date(isoString);
    return days[d.getDay()];
};

export default function WeatherCard({ data, locationName }: WeatherCardProps) {
    const { current, daily, hourly, current_units } = data;

    // 获取接下来的几个小时的数据 (Current time onwards)
    // Find index close to current time
    const currentHour = new Date(current.time).getHours();
    // Assuming hourly data starts from 00:00 today.
    // We want next 6 hours.
    // We can just find the index where time >= current.time roughly.
    // Or just simple index logic if we know the array structure.
    // OpenMeteo hourly usually covers 7 days.
    // We need to find the index of the start of "today" + current hour.
    // Simplified: just match the hour string in ISO
    const nowIndex = hourly.time.findIndex(t => t >= current.time);
    const nextHours = hourly.time.slice(nowIndex, nowIndex + 6).map((t, i) => {
        const idx = nowIndex + i;
        return {
            time: t,
            temp: hourly.temperature_2m[idx],
            code: hourly.weather_code[idx],
            prob: hourly.precipitation_probability[idx]
        };
    });

    // Daily Forecast: Skip today (index 0 is usually today) or include it?
    // Let's show today + next 4 days = 5 days total.
    const dailyForecast = daily.time.slice(0, 5).map((t, i) => ({
        time: t,
        code: daily.weather_code[i],
        max: daily.temperature_2m_max[i],
        min: daily.temperature_2m_min[i],
        prob: daily.precipitation_probability_max[i]
    }));

    return (
        <html lang="zh-CN">
            <head>
                <meta charSet="UTF-8" />
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
                <style dangerouslySetInnerHTML={{
                    __html: `
            body { 
              font-family: 'Noto Sans SC', sans-serif; 
              background-color: ${COLORS.base};
            }
          `
                }} />
            </head>
            <body className="flex justify-center items-center min-h-screen p-8">
                <div 
                  className="w-[500px] rounded-3xl shadow-2xl overflow-hidden relative"
                  style={{ backgroundColor: COLORS.lightPink }}
                >
                    {/* Header Section */}
                    <div className="p-8 pb-4 relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: COLORS.text }}>
                                    <BiMap className="text-2xl" style={{ color: COLORS.pink }} />
                                    {locationName}
                                </h1>
                                <p className="text-lg mt-1 font-medium opacity-80" style={{ color: COLORS.subtext0 }}>
                                    {formatDate(current.time)} {getDayName(current.time)}
                                </p>
                            </div>
                            <div className="px-3 py-1 rounded-full text-sm font-bold bg-white/50 backdrop-blur-sm shadow-sm" style={{ color: COLORS.pink }}>
                                Live
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-6">
                            <div className="flex flex-col">
                                <span className="text-7xl font-bold tracking-tighter" style={{ color: COLORS.text }}>
                                    {Math.round(current.temperature_2m)}°
                                </span>
                                <span className="text-xl font-medium mt-1 ml-1" style={{ color: COLORS.subtext1 }}>
                                    {getWeatherDesc(current.weather_code)}
                                </span>
                            </div>
                            <div className="transform scale-150 p-4">
                                {getWeatherIcon(current.weather_code, 80)}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="px-6 py-4 mx-6 rounded-2xl bg-white/40 backdrop-blur-md grid grid-cols-2 gap-4 shadow-sm border border-white/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-white/60 text-xl" style={{ color: COLORS.blue }}>
                                <BiWind />
                            </div>
                            <div>
                                <p className="text-xs opacity-70" style={{ color: COLORS.subtext1 }}>风速</p>
                                <p className="font-bold text-sm" style={{ color: COLORS.text }}>{current.wind_speed_10m} {current_units.wind_speed_10m}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-white/60 text-xl" style={{ color: COLORS.teal }}>
                                <BiWater />
                            </div>
                            <div>
                                <p className="text-xs opacity-70" style={{ color: COLORS.subtext1 }}>湿度</p>
                                <p className="font-bold text-sm" style={{ color: COLORS.text }}>{current.relative_humidity_2m}%</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-white/60 text-xl" style={{ color: COLORS.mauve }}>
                                <FaTemperatureHigh />
                            </div>
                            <div>
                                <p className="text-xs opacity-70" style={{ color: COLORS.subtext1 }}>体感</p>
                                <p className="font-bold text-sm" style={{ color: COLORS.text }}>{current.apparent_temperature}°</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-white/60 text-xl" style={{ color: COLORS.sky }}>
                                <FaTint />
                            </div>
                            <div>
                                <p className="text-xs opacity-70" style={{ color: COLORS.subtext1 }}>降水</p>
                                <p className="font-bold text-sm" style={{ color: COLORS.text }}>{current.precipitation}mm</p>
                            </div>
                        </div>
                    </div>

                    {/* Hourly Forecast */}
                    <div className="p-6">
                        <h3 className="text-sm font-bold mb-3 uppercase tracking-wider opacity-70 ml-1" style={{ color: COLORS.subtext0 }}>小时预报</h3>
                        <div className="flex justify-between gap-2 overflow-hidden">
                            {nextHours.map((item, idx) => (
                                <div key={idx} className="flex flex-col items-center p-2 rounded-xl bg-white/30 flex-1 min-w-[50px]">
                                    <span className="text-xs mb-2 font-medium" style={{ color: COLORS.subtext1 }}>
                                        {formatTime(item.time)}
                                    </span>
                                    <div className="mb-2">
                                        {getWeatherIcon(item.code, 24)}
                                    </div>
                                    <span className="text-sm font-bold" style={{ color: COLORS.text }}>
                                        {Math.round(item.temp)}°
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Daily Forecast */}
                    <div className="bg-white rounded-t-[2.5rem] p-6 pb-8 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]" style={{ backgroundColor: '#ffffff' }}>
                         <h3 className="text-sm font-bold mb-4 uppercase tracking-wider opacity-70 ml-1" style={{ color: COLORS.subtext0 }}>未来预报</h3>
                         <div className="space-y-4">
                            {dailyForecast.map((day, idx) => (
                                <div key={idx} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded-lg transition-colors">
                                    <span className="w-20 font-medium" style={{ color: idx === 0 ? COLORS.pink : COLORS.subtext1 }}>
                                        {idx === 0 ? '今天' : getDayName(day.time)}
                                    </span>
                                    <div className="flex items-center gap-2 flex-1 justify-center">
                                        {getWeatherIcon(day.code, 20)}
                                        {day.prob > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">
                                                {day.prob}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-4 w-24 justify-end text-sm font-bold">
                                         <span style={{ color: COLORS.text }}>{Math.round(day.max)}°</span>
                                         <span style={{ color: COLORS.overlay1 }}>{Math.round(day.min)}°</span>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
