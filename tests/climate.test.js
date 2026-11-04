/**
 * Pruebas unitarias y de integración: Módulo HIDROTERRA CLIMA
 * Verifica validadores climáticos, normalización de Open-Meteo, motor agroclimático,
 * sistema de alertas, comparación de precipitaciones y persistencia en caché local.
 */

import {
  validateWeatherCoordinates,
  normalizeCoordKey,
  validateOpenMeteoResponse
} from '../src/modules/climate/utils/weatherValidators.js';
import {
  getWeatherCondition,
  formatWindDirection
} from '../src/modules/climate/utils/weatherFormatters.js';
import { weatherApi } from '../src/modules/climate/services/weatherApi.js';
import { weatherCache } from '../src/modules/climate/services/weatherCache.js';
import {
  computeAgroclimaticIndicators,
  generateAgroclimaticAlerts,
  buildPrecipitationComparison
} from '../src/modules/climate/services/weatherAnalysis.js';

export function runClimateTests(suite) {
  suite.test('Clima — Validación y normalización de coordenadas geográficas', (assert) => {
    const valid = validateWeatherCoordinates(9.717489, -75.121345);
    assert.strictEqual(valid.valid, true, 'Coordenadas de Montes de María válidas');
    assert.strictEqual(valid.isRegional, true, 'Reconoce polígono de Montes de María');

    const key1 = normalizeCoordKey(9.717489, -75.121345);
    const key2 = normalizeCoordKey(9.717499, -75.121341);
    assert.strictEqual(key1, '9.7175,-75.1213', 'Clave redondeada a 4 decimales');
    assert.strictEqual(key1, key2, 'Variaciones insignificantes de GPS producen la misma clave de caché');

    const invalid = validateWeatherCoordinates(95, -75.12);
    assert.strictEqual(invalid.valid, false, 'Rechaza latitud fuera de rango');
  });

  suite.test('Clima — Construcción de URL Open-Meteo y validación de esquema JSON', (assert) => {
    const url = weatherApi.buildOpenMeteoUrl(9.7175, -75.1213);
    assert.ok(url.includes('https://api.open-meteo.com/v1/forecast'), 'Endpoint oficial Open-Meteo');
    assert.ok(url.includes('timezone=America%2FBogota'), 'Zona horaria America/Bogota configurada');
    assert.ok(url.includes('forecast_days=7'), 'Pronóstico de 7 días configurado');
    assert.ok(url.includes('et0_fao_evapotranspiration'), 'Variable FAO ET0 incluida');

    assert.strictEqual(validateOpenMeteoResponse(null).valid, false, 'Rechaza payload nulo');
    assert.strictEqual(validateOpenMeteoResponse({ error: true, reason: 'Invalid' }).valid, false, 'Detecta error de API');

    const mockValidPayload = {
      latitude: 9.7175,
      longitude: -75.1213,
      current: { temperature_2m: 29.4, relative_humidity_2m: 76 },
      hourly: { time: ['2026-11-03T12:00'] },
      daily: { time: ['2026-11-03'] }
    };
    assert.strictEqual(validateOpenMeteoResponse(mockValidPayload).valid, true, 'Acepta respuesta válida de Open-Meteo');
  });

  suite.test('Clima — Motor Agroclimático, Alertas y Separación Observación vs Pronóstico', (assert) => {
    const sampleRaw = {
      latitude: 9.7175,
      longitude: -75.1213,
      elevation: 165,
      timezone: 'America/Bogota',
      current: {
        time: '2026-11-03T10:00',
        temperature_2m: 31.5,
        apparent_temperature: 34.2,
        relative_humidity_2m: 72,
        is_day: 1,
        precipitation: 0,
        weather_code: 1,
        cloud_cover: 35,
        surface_pressure: 1011,
        wind_speed_10m: 12.4,
        wind_direction_10m: 45
      },
      hourly: {
        time: Array.from({ length: 24 }, (_, i) => `2026-11-03T${String(i).padStart(2, '0')}:00`),
        temperature_2m: Array(24).fill(30),
        relative_humidity_2m: Array(24).fill(75),
        precipitation_probability: Array(24).fill(80),
        precipitation: Array(24).fill(1.0), // 24 mm en 24h
        weather_code: Array(24).fill(61),
        et0_fao_evapotranspiration: Array(24).fill(0.2),
        soil_moisture_0_to_1cm: Array(24).fill(0.28)
      },
      daily: {
        time: [
          '2026-11-03',
          '2026-11-04',
          '2026-11-05',
          '2026-11-06',
          '2026-11-07',
          '2026-11-08',
          '2026-11-09'
        ],
        weather_code: [61, 0, 0, 0, 0, 0, 1],
        temperature_2m_max: [35.2, 34.5, 33.0, 33.5, 34.0, 33.8, 33.2],
        temperature_2m_min: [23.2, 23.0, 22.5, 22.8, 23.0, 23.1, 22.9],
        precipitation_sum: [24.0, 0.0, 0.2, 0.0, 0.0, 0.1, 0.0], // 5 días consecutivos secos (< 1 mm)
        precipitation_probability_max: [80, 15, 20, 10, 10, 15, 20],
        wind_speed_10m_max: [18, 15, 14, 16, 15, 17, 16],
        et0_fao_evapotranspiration_sum: [4.5, 5.0, 5.1, 4.9, 5.0, 4.8, 4.7] // 34.0 mm en 7d
      }
    };

    const normalized = weatherApi.normalizeOpenMeteoPayload(sampleRaw, {
      name: 'Pluviómetro Vereda La Cansona',
      latitude: 9.7175,
      longitude: -75.1213,
      entityType: 'pluviometer',
      entityId: 'pluv-test-1'
    });

    const indicators = computeAgroclimaticIndicators(normalized);
    assert.strictEqual(indicators.precipitation.rainNext24hMm, 24, 'Acumulado estimado 24h correcto (24 mm)');
    assert.strictEqual(indicators.precipitation.consecutiveDryDays, 6, 'Detecta racha de 6 días secos consecutivos');
    assert.strictEqual(indicators.temperature.todayThermalAmplitudeC, 12, 'Variación térmica hoy 35.2 - 23.2 = 12 °C');
    assert.strictEqual(indicators.evapotranspiration.cumulativeEt07dMm, 34, 'ET0 acumulada 7 días = 34 mm');
    assert.strictEqual(indicators.humidity.estimatedSoilMoisturePct, 28, 'Humedad volumétrica estimada 28%');

    const alerts = generateAgroclimaticAlerts(normalized, indicators);
    assert.ok(alerts.some(a => a.id === 'alert-dry-spell'), 'Genera alerta de posible periodo seco');
    assert.ok(alerts.some(a => a.id === 'alert-upcoming-rain'), 'Genera alerta de precipitación próxima');
    assert.ok(alerts.some(a => a.id === 'alert-high-temp'), 'Genera alerta de temperatura elevada');
    assert.ok(alerts.some(a => a.id === 'alert-water-followup'), 'Genera alerta de seguimiento hídrico por días secos + ET0 alta');

    // Verificar separación entre lluvia observada y pronosticada
    const mockObserved = [
      { id: 'r1', pluviometerId: 'pluv-test-1', precipitationMm: 18.5, measuredAt: '2026-11-03T07:00:00.000Z' }
    ];
    const comp = buildPrecipitationComparison(normalized, mockObserved, { id: 'pluv-test-1', code: 'PLUV-01', name: 'La Cansona' });
    const todayRow = comp.timeline.find(t => t.date === '2026-11-03');
    assert.strictEqual(todayRow.observedMm, 18.5, 'Conserva medición real de pluviómetro (18.5 mm)');
    assert.strictEqual(todayRow.estimatedModelTodayMm, 24.0, 'Separa estimación del modelo para hoy (24.0 mm)');
    const futureRow = comp.timeline.find(t => t.date === '2026-11-04');
    assert.strictEqual(futureRow.observedMm, null, 'No inventa lluvia observada en fechas futuras');
    assert.strictEqual(futureRow.forecastFutureMm, 0.0, 'Registra pronóstico futuro por separado');
  });

  suite.test('Clima — Persistencia en Caché Local (IndexedDB + Fallback) y Formateadores', async (assert) => {
    const cond = getWeatherCondition(95, 1);
    assert.strictEqual(cond.label, 'Tormenta eléctrica', 'Código WMO 95 mapeado a Tormenta eléctrica');
    assert.strictEqual(formatWindDirection(45), 'NE (45°)', 'Conversión de grados a rosa de los vientos');

    const saved = await weatherCache.save({
      location: { name: 'Punto Prueba Caché', latitude: 9.6543, longitude: -75.2345, entityType: 'manual' },
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
      current: { temperatureC: 28.5 }
    });

    assert.ok(saved && saved.coordKey === '9.6543,-75.2345', 'Guarda registro normalizado en caché');
    const recovered = await weatherCache.getByCoordinates(9.65431, -75.23452);
    assert.ok(recovered !== null, 'Recupera registro desde caché por coordenadas equivalentes');
    assert.strictEqual(recovered.current.temperatureC, 28.5, 'Conserva temperatura en caché');
    assert.strictEqual(weatherCache.isFresh(recovered, 45), true, 'Reconoce registro recién guardado como vigente');
  });
}

