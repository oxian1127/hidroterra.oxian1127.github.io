/**
 * Configuración centralizada para el módulo HIDROTERRA CLIMA
 * Sistema de Monitoreo Meteorológico y Análisis Agroclimático
 */

export const WEATHER_CONFIG = {
  // API Meteorológica Abierta Principal: Open-Meteo
  api: {
    baseUrl: 'https://api.open-meteo.com/v1/forecast',
    timezone: 'America/Bogota',
    temperatureUnit: 'celsius',
    windSpeedUnit: 'kmh',
    precipitationUnit: 'mm',
    forecastDays: 7,
    hourlyHoursWindow: 24,
    timeoutMs: 12000,
    coordinatePrecisionDecimals: 4, // ~11 metros: evita consultas duplicadas por mínimas variaciones GPS

    // Variables solicitadas al endpoint Open-Meteo (compatibles con el modelo global/IFS/GFS)
    currentVariables: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'rain',
      'weather_code',
      'cloud_cover',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m'
    ],
    hourlyVariables: [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'et0_fao_evapotranspiration',
      'soil_moisture_0_to_1cm',
      'soil_moisture_1_to_3cm',
      'soil_moisture_3_to_9cm'
    ],
    dailyVariables: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_hours',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'et0_fao_evapotranspiration_sum'
    ]
  },

  // Caché y persistencia local (IndexedDB + Fallback LocalStorage)
  cache: {
    storeName: 'weather_cache',
    localStorageFallbackKey: 'hidroterra_weather_cache_v1',
    lastLocationStorageKey: 'hidroterra_climate_last_location',
    ttlMinutes: 45, // Actualizar pronóstico cada 45 minutos por defecto
    maxStoredLocations: 30 // Límite para no consumir espacio excesivo en el dispositivo
  },

  // Ubicación de referencia regional si aún no hay puntos registrados en la base de datos
  defaultReferenceLocation: {
    name: 'Montes de María — Centro Territorial (El Carmen de Bolívar)',
    latitude: 9.7175,
    longitude: -75.1213,
    entityType: 'reference',
    entityId: null,
    municipality: 'El Carmen de Bolívar'
  },

  // Reglas configurables del Motor de Análisis Agroclimático (Sección 6)
  alertRules: {
    // Posible periodo seco: días consecutivos con lluvia pronosticada menor a dryDayThresholdMm
    dryDayThresholdMm: 1.0,
    consecutiveDryDaysAlert: 4,

    // Precipitación próxima significativa
    rainProbabilityThresholdPct: 70,
    significantDailyRainMm: 20.0,
    heavyDailyRainMm: 40.0,

    // Temperatura elevada en el territorio
    highTemperatureThresholdC: 34.0,
    veryHighTemperatureThresholdC: 37.0,

    // Evapotranspiración FAO ET0 y seguimiento hídrico
    highDailyEt0Mm: 4.8,
    highWeeklyEt0Mm: 30.0,
    waterFollowUpDryDays: 3,
    waterFollowUpWeeklyEt0Mm: 26.0
  }
};

/**
 * Catálogo estándar de códigos meteorológicos WMO (World Meteorological Organization)
 * utilizados por Open-Meteo, adaptados al español y a la iconografía FontAwesome de HIDROTERRA.
 */
export const WMO_WEATHER_CODES = {
  0:  { label: 'Cielo despejado', iconDay: 'fa-sun', iconNight: 'fa-moon', category: 'clear', color: '#f59e0b' },
  1:  { label: 'Mayormente despejado', iconDay: 'fa-cloud-sun', iconNight: 'fa-cloud-moon', category: 'clear', color: '#f59e0b' },
  2:  { label: 'Parcialmente nublado', iconDay: 'fa-cloud-sun', iconNight: 'fa-cloud-moon', category: 'cloudy', color: '#0284c7' },
  3:  { label: 'Nublado / Cubierto', iconDay: 'fa-cloud', iconNight: 'fa-cloud', category: 'cloudy', color: '#64748b' },
  45: { label: 'Niebla o bruma matinal', iconDay: 'fa-smog', iconNight: 'fa-smog', category: 'fog', color: '#64748b' },
  48: { label: 'Niebla densa', iconDay: 'fa-smog', iconNight: 'fa-smog', category: 'fog', color: '#64748b' },
  51: { label: 'Llovizna ligera', iconDay: 'fa-cloud-rain', iconNight: 'fa-cloud-rain', category: 'drizzle', color: '#0ea5e9' },
  53: { label: 'Llovizna moderada', iconDay: 'fa-cloud-rain', iconNight: 'fa-cloud-rain', category: 'drizzle', color: '#0284c7' },
  55: { label: 'Llovizna intensa', iconDay: 'fa-cloud-showers-heavy', iconNight: 'fa-cloud-showers-heavy', category: 'drizzle', color: '#0369a1' },
  56: { label: 'Llovizna fría ligera', iconDay: 'fa-cloud-rain', iconNight: 'fa-cloud-rain', category: 'drizzle', color: '#0284c7' },
  57: { label: 'Llovizna fría densa', iconDay: 'fa-cloud-showers-heavy', iconNight: 'fa-cloud-showers-heavy', category: 'drizzle', color: '#0369a1' },
  61: { label: 'Lluvia ligera', iconDay: 'fa-cloud-rain', iconNight: 'fa-cloud-rain', category: 'rain', color: '#0284c7' },
  63: { label: 'Lluvia moderada', iconDay: 'fa-cloud-showers-heavy', iconNight: 'fa-cloud-showers-heavy', category: 'rain', color: '#0369a1' },
  65: { label: 'Lluvia fuerte', iconDay: 'fa-cloud-showers-water', iconNight: 'fa-cloud-showers-water', category: 'rain', color: '#1d4ed8' },
  66: { label: 'Lluvia fría ligera', iconDay: 'fa-cloud-rain', iconNight: 'fa-cloud-rain', category: 'rain', color: '#0284c7' },
  67: { label: 'Lluvia fría intensa', iconDay: 'fa-cloud-showers-heavy', iconNight: 'fa-cloud-showers-heavy', category: 'rain', color: '#1d4ed8' },
  71: { label: 'Granizo / Nieve ligera', iconDay: 'fa-snowflake', iconNight: 'fa-snowflake', category: 'snow', color: '#38bdf8' },
  73: { label: 'Granizo moderado', iconDay: 'fa-snowflake', iconNight: 'fa-snowflake', category: 'snow', color: '#0284c7' },
  75: { label: 'Granizo fuerte', iconDay: 'fa-snowflake', iconNight: 'fa-snowflake', category: 'snow', color: '#1d4ed8' },
  77: { label: 'Granos de hielo', iconDay: 'fa-icicles', iconNight: 'fa-icicles', category: 'snow', color: '#38bdf8' },
  80: { label: 'Chubascos o aguaceros ligeros', iconDay: 'fa-cloud-sun-rain', iconNight: 'fa-cloud-moon-rain', category: 'showers', color: '#0284c7' },
  81: { label: 'Aguaceros moderados', iconDay: 'fa-cloud-showers-heavy', iconNight: 'fa-cloud-showers-heavy', category: 'showers', color: '#0369a1' },
  82: { label: 'Aguaceros torrenciales', iconDay: 'fa-cloud-showers-water', iconNight: 'fa-cloud-showers-water', category: 'showers', color: '#1e40af' },
  85: { label: 'Chubascos fríos ligeros', iconDay: 'fa-cloud-rain', iconNight: 'fa-cloud-rain', category: 'showers', color: '#0284c7' },
  86: { label: 'Chubascos fríos fuertes', iconDay: 'fa-cloud-showers-heavy', iconNight: 'fa-cloud-showers-heavy', category: 'showers', color: '#1e40af' },
  95: { label: 'Tormenta eléctrica', iconDay: 'fa-cloud-bolt', iconNight: 'fa-cloud-bolt', category: 'storm', color: '#7c3aed' },
  96: { label: 'Tormenta eléctrica con lluvia fuerte', iconDay: 'fa-cloud-bolt', iconNight: 'fa-cloud-bolt', category: 'storm', color: '#6d28d9' },
  99: { label: 'Tormenta eléctrica severa', iconDay: 'fa-cloud-bolt', iconNight: 'fa-cloud-bolt', category: 'storm', color: '#5b21b6' }
};

