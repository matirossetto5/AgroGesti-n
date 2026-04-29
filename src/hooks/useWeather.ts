import { useState, useEffect } from 'react';
import { weatherService, WeatherData, WeatherForecast, WeatherAlert } from '../services';

export function useWeather(latitude: number | null, longitude: number | null) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!latitude || !longitude) return;

    const fetchWeatherData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [weatherData, forecastData] = await Promise.all([
          weatherService.getCurrentWeather(latitude, longitude),
          weatherService.getForecast(latitude, longitude)
        ]);

        setWeather(weatherData);
        setForecast(forecastData);

        if (forecastData.length > 0) {
          const generatedAlerts = weatherService.analyzeAlertsFromForecast(forecastData);
          setAlerts(generatedAlerts);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching weather');
      } finally {
        setLoading(false);
      }
    };

    fetchWeatherData();

    // Refresh every 30 minutes
    const interval = setInterval(fetchWeatherData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [latitude, longitude]);

  return { weather, forecast, alerts, loading, error };
}
