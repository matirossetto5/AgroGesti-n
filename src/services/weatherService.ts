import axios from 'axios';

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  feelsLike: number;
}

export interface WeatherForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  windSpeed: number;
  description: string;
  riskOfFrost: boolean;
  riskOfDrought: boolean;
}

export interface WeatherAlert {
  type: 'frost' | 'drought' | 'heavy_rain' | 'storm' | 'hail';
  severity: 'low' | 'medium' | 'high';
  message: string;
  date: string;
}

const API_BASE = 'https://api.open-meteo.com/v1';

export const weatherService = {
  async getCurrentWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
    try {
      const response = await axios.get(`${API_BASE}/forecast`, {
        params: {
          latitude,
          longitude,
          current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature',
          temperature_unit: 'celsius',
          timezone: 'auto'
        }
      });

      const current = response.data.current;
      return {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        feelsLike: current.apparent_temperature,
        description: this.getWeatherDescription(current.weather_code),
        icon: this.getWeatherIcon(current.weather_code)
      };
    } catch (error) {
      console.error('Error fetching weather:', error);
      return null;
    }
  },

  async getForecast(latitude: number, longitude: number, days: number = 7): Promise<WeatherForecast[]> {
    try {
      const response = await axios.get(`${API_BASE}/forecast`, {
        params: {
          latitude,
          longitude,
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
          timezone: 'auto',
          forecast_days: days,
          temperature_unit: 'celsius'
        }
      });

      return response.data.daily.time.map((date: string, index: number) => {
        const tempMax = response.data.daily.temperature_2m_max[index];
        const tempMin = response.data.daily.temperature_2m_min[index];
        const precipitation = response.data.daily.precipitation_sum[index] || 0;
        const windSpeed = response.data.daily.wind_speed_10m_max[index];
        const weatherCode = response.data.daily.weather_code[index];

        return {
          date,
          tempMax,
          tempMin,
          precipitation,
          windSpeed,
          description: this.getWeatherDescription(weatherCode),
          riskOfFrost: tempMin <= 0,
          riskOfDrought: precipitation < 5 && tempMax > 25
        };
      });
    } catch (error) {
      console.error('Error fetching forecast:', error);
      return [];
    }
  },

  analyzeAlertsFromForecast(forecast: WeatherForecast[]): WeatherAlert[] {
    const alerts: WeatherAlert[] = [];

    forecast.forEach((day, index) => {
      // Frost risk
      if (day.riskOfFrost) {
        alerts.push({
          type: 'frost',
          severity: day.tempMin < -5 ? 'high' : 'medium',
          message: `Riesgo de helada: temperatura mínima de ${day.tempMin}°C`,
          date: day.date
        });
      }

      // Drought risk
      if (day.riskOfDrought && index < 3) {
        alerts.push({
          type: 'drought',
          severity: 'low',
          message: 'Bajo riesgo de sequía. Considere riego si es necesario.',
          date: day.date
        });
      }

      // Heavy rain
      if (day.precipitation > 50) {
        alerts.push({
          type: 'heavy_rain',
          severity: 'high',
          message: `Lluvia intensa esperada: ${day.precipitation}mm`,
          date: day.date
        });
      }

      // Storm/hail risk
      if (day.windSpeed > 50) {
        alerts.push({
          type: 'storm',
          severity: 'high',
          message: `Riesgo de tormenta. Vientos de ${day.windSpeed} km/h`,
          date: day.date
        });
      }
    });

    return alerts;
  },

  private getWeatherDescription(code: number): string {
    const descriptions: Record<number, string> = {
      0: 'Despejado',
      1: 'Parcialmente nublado',
      2: 'Nublado',
      3: 'Muy nublado',
      45: 'Niebla',
      48: 'Niebla escarcha',
      51: 'Llovizna ligera',
      53: 'Llovizna moderada',
      55: 'Llovizna densa',
      61: 'Lluvia ligera',
      63: 'Lluvia moderada',
      65: 'Lluvia fuerte',
      71: 'Nieve ligera',
      73: 'Nieve moderada',
      75: 'Nieve fuerte',
      77: 'Granos de nieve',
      80: 'Lluvia ligera',
      81: 'Lluvia moderada',
      82: 'Lluvia fuerte',
      85: 'Nieve ligera',
      86: 'Nieve fuerte',
      95: 'Tormenta eléctrica',
      96: 'Tormenta con granizo',
      99: 'Tormenta con granizo fuerte'
    };
    return descriptions[code] || 'Desconocido';
  },

  private getWeatherIcon(code: number): string {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code >= 80 && code <= 82) return '⛈️';
    if (code >= 95) return '⚡';
    return '🌤️';
  }
};
