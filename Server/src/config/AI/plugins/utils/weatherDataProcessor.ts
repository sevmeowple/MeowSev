// src/config/AI/plugins/utils/weatherDataProcessor.ts

export interface WeatherData {
  current_condition: Array<{
    temp_C: string;
    FeelsLikeC: string;
    humidity: string;
    windspeedKmph: string;
    visibility: string;
    pressure: string;
    weatherCode: string;
    weatherDesc: Array<{ value: string }>;
  }>;
  weather: Array<{
    date: string;
    maxtempC: string;
    mintempC: string;
    astronomy: Array<{
      sunrise: string;
      sunset: string;
      moonrise: string;
      moonset: string;
      moon_phase: string;
    }>;
    hourly: Array<{
      time: string;
      weatherCode: string;
      weatherDesc: Array<{ value: string }>;
    }>;
  }>;
}

export interface ProcessedWeatherData {
  location: string;
  currentTime: string;
  currentEmoji: string;
  currentTemp: string;
  currentDesc: string;
  feelsLike: string;
  humidity: string;
  windSpeed: string;
  visibility: string;
  pressure: string;
  todayEmoji: string;
  todayDesc: string;
  todayMinTemp: string;
  todayMaxTemp: string;
  tomorrowForecast: string;
  moonEmoji: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moonPhase: string;
}

/**
 * 获取天气图标emoji
 */
export function getWeatherEmoji(code: string): string {
  const weatherCodes: { [key: string]: string } = {
    '113': '☀️',  // Sunny/Clear
    '116': '⛅',  // Partly cloudy
    '119': '☁️',  // Cloudy
    '122': '☁️',  // Overcast
    '143': '🌫️',  // Mist
    '176': '🌦️',  // Patchy rain possible
    '179': '🌨️',  // Patchy snow possible
    '182': '🌨️',  // Patchy sleet possible
    '185': '🌨️',  // Patchy freezing drizzle possible
    '200': '⛈️',  // Thundery outbreaks possible
    '227': '❄️',  // Blowing snow
    '230': '❄️',  // Blizzard
    '248': '🌫️',  // Fog
    '260': '🌫️',  // Freezing fog
    '263': '🌦️',  // Patchy light drizzle
    '266': '🌦️',  // Light drizzle
    '281': '🌨️',  // Freezing drizzle
    '284': '🌨️',  // Heavy freezing drizzle
    '293': '🌧️',  // Patchy light rain
    '296': '🌧️',  // Light rain
    '299': '🌧️',  // Moderate rain at times
    '302': '🌧️',  // Moderate rain
    '305': '🌧️',  // Heavy rain at times
    '308': '🌧️',  // Heavy rain
    '311': '🌨️',  // Light freezing rain
    '314': '🌨️',  // Moderate or heavy freezing rain
    '317': '🌨️',  // Light sleet
    '320': '🌨️',  // Moderate or heavy sleet
    '323': '❄️',  // Patchy light snow
    '326': '❄️',  // Light snow
    '329': '❄️',  // Patchy moderate snow
    '332': '❄️',  // Moderate snow
    '335': '❄️',  // Patchy heavy snow
    '338': '❄️',  // Heavy snow
    '350': '🌨️',  // Ice pellets
    '353': '🌦️',  // Light rain shower
    '356': '🌧️',  // Moderate or heavy rain shower
    '359': '🌧️',  // Torrential rain shower
    '362': '🌨️',  // Light sleet showers
    '365': '🌨️',  // Moderate or heavy sleet showers
    '368': '❄️',  // Light snow showers
    '371': '❄️',  // Moderate or heavy snow showers
    '374': '🌨️',  // Light showers of ice pellets
    '377': '🌨️',  // Moderate or heavy showers of ice pellets
    '386': '⛈️',  // Patchy light rain with thunder
    '389': '⛈️',  // Moderate or heavy rain with thunder
    '392': '⛈️',  // Patchy light snow with thunder
    '395': '⛈️',  // Moderate or heavy snow with thunder
  };
  return weatherCodes[code] || '🌤️';
}

/**
 * 获取月相emoji
 */
export function getMoonPhase(moonPhase: string): string {
  const phases: { [key: string]: string } = {
    'New Moon': '🌑',
    'Waxing Crescent': '🌒',
    'First Quarter': '🌓', 
    'Waxing Gibbous': '🌔',
    'Full Moon': '🌕',
    'Waning Gibbous': '🌖',
    'Last Quarter': '🌗',
    'Waning Crescent': '🌘'
  };
  return phases[moonPhase] || '🌙';
}

/**
 * 获取中午12点的天气数据（用于当天预报）
 */
function getNoonWeatherData(hourly: any[]) {
  // 查找12:00时间点的数据
  return hourly.find(hour => hour.time === '1200') || hourly[Math.floor(hourly.length / 2)] || hourly[0];
}

/**
 * 处理天气数据，转换为模板所需格式
 */
export function processWeatherData(weatherData: WeatherData, location: string): ProcessedWeatherData {
  const current = weatherData.current_condition[0];
  const today = weatherData.weather[0];
  const tomorrow = weatherData.weather[1] || null;
  
  // 获取今天中午的天气数据
  const todayNoon = getNoonWeatherData(today.hourly);
  const tomorrowNoon = tomorrow ? getNoonWeatherData(tomorrow.hourly) : null;
  
  // 生成明天的预报HTML
  let tomorrowForecast = '';
  if (tomorrow && tomorrowNoon) {
    const tomorrowEmoji = getWeatherEmoji(tomorrowNoon.weatherCode);
    tomorrowForecast = `
            <div class="forecast-item">
                <div class="forecast-left">
                    <span class="forecast-emoji">${tomorrowEmoji}</span>
                    <div class="forecast-info">
                        <div class="forecast-day">明天</div>
                        <div class="forecast-desc">${tomorrowNoon.weatherDesc[0].value}</div>
                    </div>
                </div>
                <div class="forecast-temp">${tomorrow.mintempC}° ~ ${tomorrow.maxtempC}°</div>
            </div>`;
  }
  
  return {
    location,
    currentTime: new Date().toLocaleString('zh-CN'),
    currentEmoji: getWeatherEmoji(current.weatherCode),
    currentTemp: current.temp_C,
    currentDesc: current.weatherDesc[0].value,
    feelsLike: current.FeelsLikeC,
    humidity: current.humidity,
    windSpeed: current.windspeedKmph,
    visibility: current.visibility,
    pressure: current.pressure,
    todayEmoji: getWeatherEmoji(todayNoon.weatherCode),
    todayDesc: todayNoon.weatherDesc[0].value,
    todayMinTemp: today.mintempC,
    todayMaxTemp: today.maxtempC,
    tomorrowForecast,
    moonEmoji: getMoonPhase(today.astronomy[0].moon_phase),
    sunrise: today.astronomy[0].sunrise,
    sunset: today.astronomy[0].sunset,
    moonrise: today.astronomy[0].moonrise,
    moonset: today.astronomy[0].moonset,
    moonPhase: today.astronomy[0].moon_phase,
  };
}

/**
 * 渲染HTML模板
 */
export function renderTemplate(template: string, data: ProcessedWeatherData): string {
  let result = template;
  
  // 替换所有模板变量
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value));
  });
  
  return result;
}
