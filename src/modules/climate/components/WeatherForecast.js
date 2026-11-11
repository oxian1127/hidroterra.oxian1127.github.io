/**
 * Componente: Pronóstico Meteorológico (Por Horas 24h y Por Días 7d con Detalle Diario)
 * Implementa la Sección 4.2 e incluye gráficos interactivos Chart.js de Temperatura, Humedad y ET0.
 */

import { escapeHtml } from '../../../core/validators.js';
import {
  getWeatherCondition,
  formatTemp,
  formatMm,
  formatPercent,
  formatWindSpeed,
  formatWindDirection,
  formatHourLabel,
  formatDayNameShort,
  formatDayNameFull
} from '../utils/weatherFormatters.js';

export class WeatherForecastSection {
  constructor() {
    this.viewMode = 'daily'; // 'hourly' | 'daily'
    this.selectedDate = null;
    this.tempHumidityChart = null;
    this.dailyTempEt0Chart = null;
  }

  render(weatherRecord) {
    if (!weatherRecord) {
      return `
        <div class="card mb-4">
          <div class="card-body">
            <p class="text-muted">Seleccione una ubicación válida para visualizar el pronóstico horario y diario.</p>
          </div>
        </div>
      `;
    }

    const days = weatherRecord.daily?.days || [];
    if (!this.selectedDate && days.length > 0) {
      this.selectedDate = days[0].date;
    } else if (days.length > 0 && !days.some(d => d.date === this.selectedDate)) {
      this.selectedDate = days[0].date;
    }

    return `
      <div class="card mb-4" id="climate-forecast-card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-calendar-week" style="color: var(--color-blue-700);"></i> Pronóstico Meteorológico Territorial</h3>
            <p class="card-subtitle">Proyección horaria (próximas 24 horas) y proyección diaria (próximos 7 días con evapotranspiración FAO ET₀)</p>
          </div>
          <div class="nav-tabs" style="margin: 0; border: none;">
            <button type="button" class="nav-tab-btn ${this.viewMode === 'daily' ? 'active' : ''}" id="btn-fc-mode-daily">
              Pronóstico 7 Días
            </button>
            <button type="button" class="nav-tab-btn ${this.viewMode === 'hourly' ? 'active' : ''}" id="btn-fc-mode-hourly">
              Pronóstico 24 Horas
            </button>
          </div>
        </div>

        <div class="card-body" id="climate-forecast-body">
          ${this.viewMode === 'hourly'
            ? this._renderHourlyView(weatherRecord)
            : this._renderDailyView(weatherRecord)}
        </div>
      </div>
    `;
  }

  _renderHourlyView(weatherRecord) {
    const next24 = weatherRecord.hourly?.next24Hours || [];

    return `
      <!-- Gráfico de Evolución Horaria: Temperatura y Humedad Relativa -->
      <div class="mb-4">
        <h4 style="font-size: var(--font-size-base); margin-bottom: var(--spacing-2);">
          <i class="fa-solid fa-chart-line" style="color: var(--color-green-700);"></i> Evolución de Temperatura (°C) y Humedad Relativa (%) — Próximas 24 Horas
        </h4>
        <div class="chart-wrapper">
          <canvas id="climate-hourly-temp-hum-chart"></canvas>
        </div>
      </div>

      <!-- Tabla / Tarjetas de Pronóstico Horario (Próximas 24 Horas) -->
      <div class="table-responsive">
        <table class="data-table data-table-cards table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Condición</th>
              <th>Temperatura</th>
              <th>Prob. Lluvia</th>
              <th>Precipitación Est.</th>
              <th>Humedad Relativa</th>
              <th>Viento</th>
            </tr>
          </thead>
          <tbody>
            ${next24.map(h => {
              const cond = getWeatherCondition(h.weatherCode, 1);
              return `
                <tr>
                  <td data-label="Hora"><strong>${escapeHtml(formatHourLabel(h.time))}</strong> <small class="text-muted">(${escapeHtml(formatDayNameShort(h.date))})</small></td>
                  <td data-label="Condición">
                    <i class="fa-solid ${cond.icon}" style="color: ${cond.color}; margin-right: 4px;"></i>
                    ${escapeHtml(cond.label)}
                  </td>
                  <td data-label="Temperatura"><strong>${formatTemp(h.temperatureC)}</strong></td>
                  <td data-label="Prob. Lluvia">
                    <span class="badge ${h.precipitationProbabilityPct >= 60 ? 'badge-info' : 'badge-neutral'}">
                      ${formatPercent(h.precipitationProbabilityPct)}
                    </span>
                  </td>
                  <td data-label="Precipitación Est."><strong>${formatMm(h.precipitationMm)}</strong></td>
                  <td data-label="Humedad Relativa">${formatPercent(h.humidityPct)}</td>
                  <td data-label="Viento">${formatWindSpeed(h.windSpeedKmh)} <small class="text-muted">${escapeHtml(formatWindDirection(h.windDirectionDeg))}</small></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderDailyView(weatherRecord) {
    const days = weatherRecord.daily?.days || [];
    const allHours = weatherRecord.hourly?.allHours || [];
    const selectedDayObj = days.find(d => d.date === this.selectedDate) || days[0] || null;
    const selectedDayHours = selectedDayObj
      ? allHours.filter(h => h.date === selectedDayObj.date)
      : [];

    return `
      <!-- Tarjetas Interactivas de 7 Días (Clic para ver desglose del día) -->
      <p class="text-muted" style="font-size: var(--font-size-xs); margin-bottom: var(--spacing-3);">
        <i class="fa-solid fa-hand-pointer"></i> Seleccione cualquier día para consultar su desglose horario detallado en la parte inferior:
      </p>

      <div class="climate-days-strip mb-4">
        ${days.map((d, idx) => {
          const cond = getWeatherCondition(d.weatherCode, 1);
          const isSelected = d.date === (selectedDayObj && selectedDayObj.date);
          return `
            <button type="button" class="climate-day-card ${isSelected ? 'selected' : ''}" data-date="${escapeHtml(d.date)}">
              <div class="climate-day-title">${idx === 0 ? 'Hoy' : idx === 1 ? 'Mañana' : escapeHtml(formatDayNameShort(d.date))}</div>
              <div class="climate-day-subdate">${escapeHtml(d.date)}</div>
              <div class="climate-day-icon" style="color: ${cond.color};">
                <i class="fa-solid ${cond.icon}"></i>
              </div>
              <div class="climate-day-cond">${escapeHtml(cond.label)}</div>
              <div class="climate-day-temps">
                <span class="temp-max" title="Temperatura máxima">${formatTemp(d.tempMaxC, 0)}</span>
                <span class="temp-min" title="Temperatura mínima">${formatTemp(d.tempMinC, 0)}</span>
              </div>
              <div class="climate-day-metrics">
                <span><i class="fa-solid fa-umbrella"></i> ${formatPercent(d.precipitationProbabilityMaxPct)}</span>
                <span><i class="fa-solid fa-droplet"></i> ${formatMm(d.precipitationSumMm)}</span>
              </div>
              <div class="climate-day-et0" title="Evapotranspiración de referencia FAO ET0">
                ET₀: <strong>${formatMm(d.et0SumMm)}</strong>
              </div>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Gráfico de 7 Días: Temperaturas Máx/Mín y Evapotranspiración FAO ET0 -->
      <div class="mb-4">
        <h4 style="font-size: var(--font-size-base); margin-bottom: var(--spacing-2);">
          <i class="fa-solid fa-temperature-ThreeQuarters" style="color: var(--color-earth-700);"></i> Temperaturas Máxima / Mínima (°C) y Evapotranspiración FAO ET₀ (mm) — Próximos 7 Días
        </h4>
        <div class="chart-wrapper">
          <canvas id="climate-daily-temp-et0-chart"></canvas>
        </div>
      </div>

      <!-- Tabla Resumen de 7 Días -->
      <div class="table-responsive mb-4">
        <table class="data-table data-table-cards table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Día y Fecha</th>
              <th>Estado del Tiempo</th>
              <th>Temp. Máxima</th>
              <th>Temp. Mínima</th>
              <th>Prob. Máx. Lluvia</th>
              <th>Precipitación Acum. Est.</th>
              <th>Evapotranspiración (ET₀)</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${days.map((d, idx) => {
              const cond = getWeatherCondition(d.weatherCode, 1);
              const isSelected = d.date === (selectedDayObj && selectedDayObj.date);
              return `
                <tr class="${isSelected ? 'climate-row-selected' : ''}">
                  <td data-label="Día y Fecha"><strong>${escapeHtml(formatDayNameFull(d.date, idx))}</strong></td>
                  <td data-label="Estado del Tiempo">
                    <i class="fa-solid ${cond.icon}" style="color: ${cond.color}; margin-right: 4px;"></i>
                    ${escapeHtml(cond.label)}
                  </td>
                  <td data-label="Temp. Máxima"><strong class="text-danger">${formatTemp(d.tempMaxC)}</strong></td>
                  <td data-label="Temp. Mínima"><strong style="color: var(--color-blue-700);">${formatTemp(d.tempMinC)}</strong></td>
                  <td data-label="Prob. Máx. Lluvia">
                    <span class="badge ${d.precipitationProbabilityMaxPct >= 60 ? 'badge-info' : 'badge-neutral'}">
                      ${formatPercent(d.precipitationProbabilityMaxPct)}
                    </span>
                  </td>
                  <td data-label="Precipitación Acum. Est."><strong>${formatMm(d.precipitationSumMm)}</strong></td>
                  <td data-label="Evapotranspiración (ET₀)">${formatMm(d.et0SumMm)}</td>
                  <td data-label="Detalle">
                    <button type="button" class="btn btn-outline btn-sm btn-select-forecast-day" data-date="${escapeHtml(d.date)}">
                      Ver horas
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Panel de Información Detallada del Día Seleccionado -->
      ${selectedDayObj ? `
        <div class="coords-picker-box" style="margin-bottom: 0;">
          <div class="d-flex justify-between align-center mb-3" style="flex-wrap: wrap; gap: 8px;">
            <div>
              <span class="badge badge-info mb-1">Desglose Horario del Día Seleccionado</span>
              <h4 style="margin: 0; color: var(--color-neutral-900);">
                ${escapeHtml(formatDayNameFull(selectedDayObj.date, days.indexOf(selectedDayObj)))} (${escapeHtml(selectedDayObj.date)})
              </h4>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--color-neutral-700);">
              Máx: <strong>${formatTemp(selectedDayObj.tempMaxC)}</strong> |
              Mín: <strong>${formatTemp(selectedDayObj.tempMinC)}</strong> |
              Lluvia est.: <strong>${formatMm(selectedDayObj.precipitationSumMm)}</strong> |
              ET₀: <strong>${formatMm(selectedDayObj.et0SumMm)}</strong> |
              Viento máx.: <strong>${formatWindSpeed(selectedDayObj.windSpeedMaxKmh)}</strong>
            </div>
          </div>

          <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
            <table class="data-table table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Estado</th>
                  <th>Temp.</th>
                  <th>Prob. Lluvia</th>
                  <th>Lluvia Est.</th>
                  <th>Humedad</th>
                  <th>ET₀ Horaria</th>
                  <th>Viento</th>
                </tr>
              </thead>
              <tbody>
                ${selectedDayHours.filter((_, i) => i % 2 === 0 || selectedDayHours.length <= 12).map(h => {
                  const cond = getWeatherCondition(h.weatherCode, 1);
                  return `
                    <tr>
                      <td><strong>${escapeHtml(formatHourLabel(h.time))}</strong></td>
                      <td><i class="fa-solid ${cond.icon}" style="color: ${cond.color};"></i> ${escapeHtml(cond.label)}</td>
                      <td>${formatTemp(h.temperatureC)}</td>
                      <td>${formatPercent(h.precipitationProbabilityPct)}</td>
                      <td><strong>${formatMm(h.precipitationMm)}</strong></td>
                      <td>${formatPercent(h.humidityPct)}</td>
                      <td>${formatMm(h.et0Mm, 2)}</td>
                      <td>${formatWindSpeed(h.windSpeedKmh)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;
  }

  bindEvents(container, weatherRecord) {
    const card = container.querySelector('#climate-forecast-card');
    if (!card || !weatherRecord) return;

    const btnDaily = card.querySelector('#btn-fc-mode-daily');
    const btnHourly = card.querySelector('#btn-fc-mode-hourly');
    const body = card.querySelector('#climate-forecast-body');

    const refreshView = () => {
      if (!body) return;
      body.innerHTML = this.viewMode === 'hourly'
        ? this._renderHourlyView(weatherRecord)
        : this._renderDailyView(weatherRecord);
      this._bindDaySelectionEvents(body, weatherRecord, refreshView);
      this.initCharts(weatherRecord);
    };

    if (btnDaily) {
      btnDaily.addEventListener('click', () => {
        this.viewMode = 'daily';
        btnDaily.classList.add('active');
        if (btnHourly) btnHourly.classList.remove('active');
        refreshView();
      });
    }

    if (btnHourly) {
      btnHourly.addEventListener('click', () => {
        this.viewMode = 'hourly';
        btnHourly.classList.add('active');
        if (btnDaily) btnDaily.classList.remove('active');
        refreshView();
      });
    }

    this._bindDaySelectionEvents(body, weatherRecord, refreshView);
    this.initCharts(weatherRecord);
  }

  _bindDaySelectionEvents(body, weatherRecord, refreshCallback) {
    if (!body) return;
    body.querySelectorAll('.climate-day-card, .btn-select-forecast-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const date = btn.dataset.date;
        if (date) {
          this.selectedDate = date;
          refreshCallback();
        }
      });
    });
  }

  initCharts(weatherRecord) {
    this.destroyCharts();
    if (!weatherRecord || typeof window === 'undefined' || !window.Chart) return;

    if (this.viewMode === 'hourly') {
      const canvas = document.getElementById('climate-hourly-temp-hum-chart');
      const next24 = weatherRecord.hourly?.next24Hours || [];
      if (canvas && next24.length > 0) {
        this.tempHumidityChart = new window.Chart(canvas, {
          type: 'line',
          data: {
            labels: next24.map(h => formatHourLabel(h.time)),
            datasets: [
              {
                label: 'Temperatura (°C)',
                data: next24.map(h => h.temperatureC),
                borderColor: '#d97706',
                backgroundColor: 'rgba(217, 119, 6, 0.15)',
                yAxisID: 'yTemp',
                tension: 0.35,
                fill: true
              },
              {
                label: 'Humedad Relativa (%)',
                data: next24.map(h => h.humidityPct),
                borderColor: '#0284c7',
                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                borderDash: [4, 4],
                yAxisID: 'yHum',
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
              yTemp: {
                type: 'linear',
                position: 'left',
                title: { display: true, text: 'Temperatura (°C)' }
              },
              yHum: {
                type: 'linear',
                position: 'right',
                min: 0,
                max: 100,
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Humedad (%)' }
              }
            }
          }
        });
      }
    } else {
      const canvas = document.getElementById('climate-daily-temp-et0-chart');
      const days = weatherRecord.daily?.days || [];
      if (canvas && days.length > 0) {
        this.dailyTempEt0Chart = new window.Chart(canvas, {
          type: 'bar',
          data: {
            labels: days.map(d => formatDayNameShort(d.date)),
            datasets: [
              {
                type: 'line',
                label: 'Temp. Máxima (°C)',
                data: days.map(d => d.tempMaxC),
                borderColor: '#dc2626',
                backgroundColor: '#dc2626',
                yAxisID: 'yTemp',
                tension: 0.3
              },
              {
                type: 'line',
                label: 'Temp. Mínima (°C)',
                data: days.map(d => d.tempMinC),
                borderColor: '#0284c7',
                backgroundColor: '#0284c7',
                yAxisID: 'yTemp',
                tension: 0.3
              },
              {
                type: 'bar',
                label: 'Evapotranspiración FAO ET₀ (mm)',
                data: days.map(d => d.et0SumMm),
                backgroundColor: 'rgba(45, 106, 79, 0.55)',
                borderColor: '#2d6a4f',
                borderWidth: 1,
                yAxisID: 'yEt0'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
              yTemp: {
                type: 'linear',
                position: 'left',
                title: { display: true, text: 'Temperatura (°C)' }
              },
              yEt0: {
                type: 'linear',
                position: 'right',
                beginAtZero: true,
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'FAO ET₀ (mm/día)' }
              }
            }
          }
        });
      }
    }
  }

  destroyCharts() {
    if (this.tempHumidityChart) {
      this.tempHumidityChart.destroy();
      this.tempHumidityChart = null;
    }
    if (this.dailyTempEt0Chart) {
      this.dailyTempEt0Chart.destroy();
      this.dailyTempEt0Chart = null;
    }
  }
}

