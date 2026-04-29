import React from 'react';
import { useWeather } from '../hooks';
import { Cloud, CloudRain, Sun, Wind, Droplets } from 'lucide-react';

interface WeatherWidgetProps {
  latitude: number | null;
  longitude: number | null;
}

export default function WeatherWidget({ latitude, longitude }: WeatherWidgetProps) {
  const { weather, forecast, alerts, loading, error } = useWeather(latitude, longitude);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="h-24 flex items-center justify-center">
          <span className="text-stone-500">Cargando clima...</span>
        </div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <p className="text-sm text-stone-500">No se pudo cargar el clima</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Weather */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-blue-700 mb-1">Clima Actual</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-blue-900">{weather.temperature}°</span>
              <span className="text-lg text-blue-700">C</span>
            </div>
            <p className="text-sm text-blue-600 mt-2">{weather.description}</p>
            <p className="text-xs text-blue-500 mt-1">Se siente como {weather.feelsLike}°C</p>
          </div>
          <div className="text-5xl">{weather.icon}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-blue-200">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-xs text-blue-600">Humedad</p>
              <p className="font-semibold text-blue-900">{weather.humidity}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-xs text-blue-600">Viento</p>
              <p className="font-semibold text-blue-900">{weather.windSpeed} km/h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-stone-700">Alertas Climáticas</p>
          {alerts.slice(0, 3).map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border text-sm ${
                alert.severity === 'high'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : alert.severity === 'medium'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <p className="font-medium">{alert.message}</p>
              <p className="text-xs opacity-75 mt-1">{new Date(alert.date).toLocaleDateString('es-AR')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Forecast */}
      {forecast.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-stone-700 mb-2">Pronóstico (5 días)</p>
          <div className="grid grid-cols-5 gap-2">
            {forecast.slice(0, 5).map((day, idx) => (
              <div key={idx} className="bg-stone-50 rounded-lg p-2 text-center text-xs">
                <p className="font-medium text-stone-700 mb-1">
                  {new Date(day.date).toLocaleDateString('es-AR', { weekday: 'short' })}
                </p>
                <p className="text-lg mb-1">
                  {day.tempMax}° / {day.tempMin}°
                </p>
                <p className="text-blue-600 font-semibold">{day.precipitation}mm</p>
                {day.riskOfFrost && <p className="text-xs text-red-600 mt-1">⚠️ Helada</p>}
                {day.riskOfDrought && <p className="text-xs text-orange-600 mt-1">🌡️ Sequía</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
