/**
 * Servicio de Consulta Meteorológica (Open-Meteo API Client)
 * Centraliza las peticiones HTTP, deduplicación en vuelo, tiempos de espera y caché local.
 */

import { WEATHER_CONFIG } from '../config/weatherConfig.js';
import {
  validateWeatherCoordinates,
  normalizeCoordKey,
  validateOpenMeteoResponse,
  safeNumber
} from '../utils/weatherValidators.js';
import { weatherCache } from './weatherCache.js';
import { logger } from '../../../core/logger.js';

class WeatherApiService {
  constructor() {
    // Mapa de promesas en curso por coordKey para evitar solicitudes simultáneas duplicadas
    this.inFlightRequests = new Map();
    this.activeAbortController = null;
  }

  /**
   * Cancela cualquier solicitud activa cuando el componente se desmonta o el usuario cambia rápido de punto
   */
  cancelActiveRequests() {
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {
        // Ignorar
      }
      this.activeAbortController = null;
    }
  }

  /**
   * Construye la URL de consulta hacia Open-Meteo con los parámetros oficiales requeridos
   */
  buildOpenMeteoUrl(latitude, longitude) {
    const { api } = WEATHER_CONFIG;
    const coordValidation = validateWeatherCoordinates(latitude, longitude);
    if (!coordValidation.valid) {
      throw new Error(coordValidation.error);
    }

    const latRound = Number(coordValidation.latitude.toFixed(api.coordinatePrecisionDecimals));
    const lonRound = Number(coordValidation.longitude.toFixed(api.coordinatePrecisionDecimals));

    const params = new URLSearchParams({
      latitude: String(latRound),
      longitude: String(lonRound),
      current: api.currentVariables.join(','),
      hourly: api.hourlyVariables.join(','),
      daily: api.dailyVariables.join(','),
      timezone: api.timezone,
      temperature_unit: api.temperatureUnit,
      wind_speed_unit: api.windSpeedUnit,
      precipitation_unit: api.precipitationUnit,
      forecast_days: String(api.forecastDays)
    });

    return `${api.baseUrl}?${params.toString()}`;
  }

  /**
   * Consulta el clima y pronóstico para una ubicación geográfica real.
   * @param {Object} location - { name, latitude, longitude, entityType, entityId, municipality }
   * @param {Object} options - { forceRefresh: boolean }
   * @returns {Promise<{ record: Object|null, status: 'live'|'cache'|'offline_cache'|'unavailable', error: string|null }>}
   */
  async fetchWeatherForLocation(location, { forceRefresh = false } = {}) {
    const coordCheck = validateWeatherCoordinates(location?.latitude, location?.longitude);
    if (!coordCheck.valid) {
      return {
        record: null,
        status: 'unavailable',
        error: coordCheck.error
      };
    }

    const coordKey = normalizeCoordKey(coordCheck.latitude, coordCheck.longitude);
    const cachedRecord = await weatherCache.getByCoordinates(coordCheck.latitude, coordCheck.longitude);

    // 1. Si no se fuerza actualización y la caché local es reciente (< 45 min), reutilizarla sin gastar red
    if (!forceRefresh && cachedRecord && weatherCache.isFresh(cachedRecord)) {
      // Actualizar metadatos de nombre si el usuario seleccionó otra entidad en las mismas coordenadas
      if (location.name && cachedRecord.location) {
        cachedRecord.location.name = location.name;
        cachedRecord.location.entityType = location.entityType || cachedRecord.location.entityType;
        cachedRecord.location.entityId = location.entityId || cachedRecord.location.entityId;
      }
      return {
        record: cachedRecord,
        status: 'cache',
        error: null
      };
    }

    // 2. Si el navegador reporta estar sin conexión, devolver inmediatamente la caché local si existe
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (cachedRecord) {
        return {
          record: cachedRecord,
          status: 'offline_cache',
          error: 'Modo sin conexión activo. Mostrando la última consulta almacenada en este dispositivo.'
        };
      }
      return {
        record: null,
        status: 'unavailable',
        error: 'Sin conexión a Internet y no existen datos en caché local para estas coordenadas.'
      };
    }

    // 3. Evitar solicitudes simultáneas duplicadas para la misma coordenada
    if (this.inFlightRequests.has(coordKey)) {
      return await this.inFlightRequests.get(coordKey);
    }

    const requestPromise = this._executeNetworkFetch(location, coordCheck, cachedRecord);
    this.inFlightRequests.set(coordKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      this.inFlightRequests.delete(coordKey);
    }
  }

  async _executeNetworkFetch(location, coordCheck, cachedRecord) {
    this.cancelActiveRequests();
    const controller = new AbortController();
    this.activeAbortController = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, WEATHER_CONFIG.api.timeoutMs);

    try {
      const url = this.buildOpenMeteoUrl(coordCheck.latitude, coordCheck.longitude);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`El servidor meteorológico respondió con estado HTTP ${response.status}.`);
      }

      const rawJson = await response.json();
      const validation = validateOpenMeteoResponse(rawJson);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const normalizedRecord = this.normalizeOpenMeteoPayload(rawJson, {
        name: location.name || `Coordenadas (${coordCheck.latitude.toFixed(4)}, ${coordCheck.longitude.toFixed(4)})`,
        latitude: coordCheck.latitude,
        longitude: coordCheck.longitude,
        entityType: location.entityType || 'coordinates',
        entityId: location.entityId || null,
        municipality: location.municipality || ''
      });

      await weatherCache.save(normalizedRecord);

      return {
        record: normalizedRecord,
        status: 'live',
        error: null
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        logger.warn('Consulta a Open-Meteo cancelada o tiempo de espera agotado.');
      } else {
        logger.warn('Error consultando API Open-Meteo:', err.message);
      }

      // Recuperación resiliente desde caché local si existe
      if (cachedRecord) {
        return {
          record: cachedRecord,
          status: 'offline_cache',
          error: 'No fue posible conectar con Open-Meteo en este momento. Se muestran datos recuperados de la caché local.'
        };
      }

      return {
        record: null,
        status: 'unavailable',
        error: err.name === 'AbortError'
          ? 'Tiempo de espera agotado al consultar el servicio meteorológico Open-Meteo.'
          : (err.message || 'No se pudo obtener información meteorológica para la ubicación seleccionada.')
      };
    }
  }

  /**
   * Transforma la respuesta cruda de Open-Meteo al modelo estructurado de HIDROTERRA CLIMA
   */
  normalizeOpenMeteoPayload(raw, locationInfo) {
    const currentRaw = raw.current || {};
    const hourlyRaw = raw.hourly || {};
    const dailyRaw = raw.daily || {};

    // Construir arreglo horario completo y ventana de próximas 24 horas
    const hourlyTimes = Array.isArray(hourlyRaw.time) ? hourlyRaw.time : [];
    const currentIsoTime = currentRaw.time || new Date().toISOString().slice(0, 13) + ':00';

    // Encontrar índice de la hora actual en America/Bogota
    let startIdx = hourlyTimes.findIndex(t => t >= currentIsoTime.slice(0, 13));
    if (startIdx < 0) startIdx = 0;

    const allHours = hourlyTimes.map((timeStr, idx) => {
      const sm0 = safeNumber(hourlyRaw.soil_moisture_0_to_1cm?.[idx], null);
      const sm1 = safeNumber(hourlyRaw.soil_moisture_1_to_3cm?.[idx], null);
      const sm3 = safeNumber(hourlyRaw.soil_moisture_3_to_9cm?.[idx], null);
      const soilMoisture = sm0 !== null ? sm0 : sm1 !== null ? sm1 : sm3;

      return {
        time: timeStr,
        date: timeStr.split('T')[0],
        temperatureC: safeNumber(hourlyRaw.temperature_2m?.[idx], null),
        humidityPct: safeNumber(hourlyRaw.relative_humidity_2m?.[idx], null),
        precipitationProbabilityPct: safeNumber(hourlyRaw.precipitation_probability?.[idx], 0),
        precipitationMm: safeNumber(hourlyRaw.precipitation?.[idx], 0),
        weatherCode: safeNumber(hourlyRaw.weather_code?.[idx], 0),
        cloudCoverPct: safeNumber(hourlyRaw.cloud_cover?.[idx], null),
        windSpeedKmh: safeNumber(hourlyRaw.wind_speed_10m?.[idx], null),
        windDirectionDeg: safeNumber(hourlyRaw.wind_direction_10m?.[idx], null),
        et0Mm: safeNumber(hourlyRaw.et0_fao_evapotranspiration?.[idx], 0),
        soilMoistureM3: soilMoisture
      };
    });

    const next24Hours = allHours.slice(startIdx, startIdx + WEATHER_CONFIG.api.hourlyHoursWindow);

    // Extraer probabilidad de lluvia y humedad de suelo de la hora actual
    const currentHourMatch = next24Hours[0] || allHours[0] || {};

    const current = {
      time: currentRaw.time || currentHourMatch.time || new Date().toISOString(),
      temperatureC: safeNumber(currentRaw.temperature_2m, currentHourMatch.temperatureC),
      apparentTemperatureC: safeNumber(currentRaw.apparent_temperature, currentRaw.temperature_2m),
      humidityPct: safeNumber(currentRaw.relative_humidity_2m, currentHourMatch.humidityPct),
      isDay: safeNumber(currentRaw.is_day, 1),
      precipitationMm: safeNumber(currentRaw.precipitation, 0),
      rainMm: safeNumber(currentRaw.rain, 0),
      precipitationProbabilityPct: safeNumber(currentHourMatch.precipitationProbabilityPct, 0),
      weatherCode: safeNumber(currentRaw.weather_code, currentHourMatch.weatherCode ?? 0),
      cloudCoverPct: safeNumber(currentRaw.cloud_cover, currentHourMatch.cloudCoverPct),
      surfacePressureHpa: safeNumber(currentRaw.surface_pressure, null),
      windSpeedKmh: safeNumber(currentRaw.wind_speed_10m, currentHourMatch.windSpeedKmh),
      windDirectionDeg: safeNumber(currentRaw.wind_direction_10m, currentHourMatch.windDirectionDeg),
      soilMoistureM3: safeNumber(currentHourMatch.soilMoistureM3, null)
    };

    // Construir arreglo de pronóstico diario (7 días)
    const dailyTimes = Array.isArray(dailyRaw.time) ? dailyRaw.time : [];
    const days = dailyTimes.map((dateStr, idx) => ({
      date: dateStr,
      weatherCode: safeNumber(dailyRaw.weather_code?.[idx], 0),
      tempMaxC: safeNumber(dailyRaw.temperature_2m_max?.[idx], null),
      tempMinC: safeNumber(dailyRaw.temperature_2m_min?.[idx], null),
      precipitationSumMm: safeNumber(dailyRaw.precipitation_sum?.[idx], 0),
      precipitationHours: safeNumber(dailyRaw.precipitation_hours?.[idx], 0),
      precipitationProbabilityMaxPct: safeNumber(dailyRaw.precipitation_probability_max?.[idx], 0),
      windSpeedMaxKmh: safeNumber(dailyRaw.wind_speed_10m_max?.[idx], null),
      et0SumMm: safeNumber(dailyRaw.et0_fao_evapotranspiration_sum?.[idx], 0)
    }));

    return {
      location: {
        name: locationInfo.name,
        latitude: locationInfo.latitude,
        longitude: locationInfo.longitude,
        entityType: locationInfo.entityType,
        entityId: locationInfo.entityId,
        municipality: locationInfo.municipality
      },
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
      current,
      hourly: {
        next24Hours,
        allHours
      },
      daily: {
        days
      },
      metadata: {
        timezone: raw.timezone || WEATHER_CONFIG.api.timezone,
        units: 'metric',
        isForecast: true,
        elevation: safeNumber(raw.elevation, null)
      }
    };
  }
}

export const weatherApi = new WeatherApiService();

