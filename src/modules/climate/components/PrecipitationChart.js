/**
 * Componente: Apartado Dedicado de Análisis de Precipitaciones (Sección 4.3)
 * Diferencia visual y conceptualmente:
 *   1. Lluvia observada y registrada por un pluviómetro (Medición instrumental real).
 *   2. Precipitación estimada por el modelo meteorológico (Hoy / 24h).
 *   3. Precipitación pronosticada para fechas futuras (Próximos 7 días).
 */

import { escapeHtml } from '../../../core/validators.js';
import { formatDateTime } from '../../../core/date-utils.js';
import {
  formatMm,
  formatPercent,
  formatHourLabel,
  formatDayNameShort
} from '../utils/weatherFormatters.js';

export class PrecipitationAnalysisSection {
  constructor() {
    this.hourlyPrecipChart = null;
    this.comparisonPrecipChart = null;
  }

  render(weatherRecord, precipComparison) {
    if (!weatherRecord || !precipComparison) {
      return '';
    }

    const lastObs = precipComparison.lastObservedRecord;

    return `
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-cloud-showers-water" style="color: var(--color-blue-700);"></i> Análisis de Precipitaciones: Observación Real vs. Pronóstico</h3>
            <p class="card-subtitle">Alcance comparativo: <strong>${escapeHtml(precipComparison.scopeLabel)}</strong></p>
          </div>
          <span class="badge badge-info">Separación Estricta Observación / Modelo</span>
        </div>

        <div class="card-body">
          <!-- Leyenda Conceptual Obligatoria (3 Conceptos Diferenciados) -->
          <div class="climate-precip-legend-grid mb-4">
            <div class="climate-legend-box observed">
              <div class="d-flex justify-between align-center mb-1">
                <span class="badge badge-success"><i class="fa-solid fa-ruler-vertical"></i> 1. Lluvia Observada (Pluviómetro)</span>
                <strong>${precipComparison.observedLast7dMm} mm (últ. 7d)</strong>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Medición física real capturada en campo por monitores comunitarios (${precipComparison.totalObservedRecordsCount} lecturas registradas; acum. 30d: <strong>${precipComparison.observedLast30dMm} mm</strong>).
                ${lastObs ? `<br/>Última lectura: <strong>${lastObs.precipitationMm} mm</strong> (${formatDateTime(lastObs.measuredAt)}).` : ''}
              </p>
            </div>

            <div class="climate-legend-box estimated">
              <div class="d-flex justify-between align-center mb-1">
                <span class="badge badge-info"><i class="fa-solid fa-satellite-dish"></i> 2. Precipitación Estimada (24h)</span>
                <strong>${formatMm(precipComparison.estimatedNext24hMm)}</strong>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Estimación numérica del modelo meteorológico Open-Meteo para la ventana inmediata de 24 horas en estas coordenadas. No equivale a lectura de pluviómetro.
              </p>
            </div>

            <div class="climate-legend-box forecasted">
              <div class="d-flex justify-between align-center mb-1">
                <span class="badge badge-neutral" style="background-color: #e0e7ff; color: #3730a3;"><i class="fa-solid fa-calendar-plus"></i> 3. Precipitación Pronosticada (7d)</span>
                <strong>${formatMm(precipComparison.forecasted7dMm)}</strong>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Acumulación proyectada para los próximos 7 días. Incluye <strong>${precipComparison.dryDaysCount7d} de 7 días</strong> sin precipitaciones significativas pronosticadas (&lt; 1.0 mm).
              </p>
            </div>
          </div>

          <!-- Gráficos de Precipitaciones: Horario (24h) y Diario Comparativo (Observado vs Estimado vs Pronosticado) -->
          <div class="dashboard-visual-grid mb-4">
            <div class="coords-picker-box" style="margin-bottom: 0; background-color: var(--color-white);">
              <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--spacing-2); color: var(--color-neutral-900);">
                <i class="fa-solid fa-clock" style="color: var(--color-blue-700);"></i> Precipitación Horaria Estimada y Probabilidad (Próximas 24 Horas)
              </h4>
              <div class="chart-wrapper">
                <canvas id="climate-precip-hourly-chart"></canvas>
              </div>
            </div>

            <div class="coords-picker-box" style="margin-bottom: 0; background-color: var(--color-white);">
              <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--spacing-2); color: var(--color-neutral-900);">
                <i class="fa-solid fa-chart-column" style="color: var(--color-green-700);"></i> Precipitación Diaria: Observada en Pluviómetro vs. Estimada y Pronosticada
              </h4>
              <div class="chart-wrapper">
                <canvas id="climate-precip-comparison-chart"></canvas>
              </div>
            </div>
          </div>

          <!-- Tabla Comparativa Cronológica -->
          <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--spacing-2); color: var(--color-neutral-900);">
            <i class="fa-solid fa-table"></i> Desglose Comparativo por Fecha (Observación Real vs. Modelo Meteorológico)
          </h4>
          <div class="table-responsive">
            <table class="data-table data-table-cards table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Clasificación</th>
                  <th>1. Lluvia Observada (Pluviómetro Real)</th>
                  <th>2. Estimada Hoy (Modelo)</th>
                  <th>3. Pronosticada (Futuro)</th>
                  <th>Prob. Lluvia Modelo</th>
                </tr>
              </thead>
              <tbody>
                ${precipComparison.timeline.map(row => {
                  const hasObs = row.observedMm !== null;
                  const isToday = row.estimatedModelTodayMm !== null;
                  const isFuture = row.forecastFutureMm !== null;

                  let badgeHtml = '<span class="badge badge-neutral">Histórico</span>';
                  if (isToday) badgeHtml = '<span class="badge badge-info">Hoy (Estimación + Campo)</span>';
                  else if (isFuture) badgeHtml = '<span class="badge badge-neutral" style="background-color: #e0e7ff; color: #3730a3;">Pronóstico Futuro</span>';
                  else if (hasObs) badgeHtml = '<span class="badge badge-success">Medición Real Registrada</span>';

                  return `
                    <tr>
                      <td data-label="Fecha"><strong>${escapeHtml(formatDayNameShort(row.date))}</strong> <small class="text-muted">(${escapeHtml(row.date)})</small></td>
                      <td data-label="Clasificación">${badgeHtml}</td>
                      <td data-label="1. Lluvia Observada">
                        ${hasObs
                          ? `<strong class="text-success"><i class="fa-solid fa-check"></i> ${formatMm(row.observedMm)}</strong>`
                          : '<span class="text-muted">Sin lectura registrada</span>'}
                      </td>
                      <td data-label="2. Estimada Hoy">
                        ${isToday ? `<strong>${formatMm(row.estimatedModelTodayMm)}</strong>` : '—'}
                      </td>
                      <td data-label="3. Pronosticada">
                        ${isFuture ? `<strong>${formatMm(row.forecastFutureMm)}</strong>` : '—'}
                      </td>
                      <td data-label="Prob. Lluvia Modelo">
                        ${row.probabilityPct !== null ? formatPercent(row.probabilityPct) : '—'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  initCharts(weatherRecord, precipComparison) {
    this.destroyCharts();
    if (!weatherRecord || !precipComparison || typeof window === 'undefined' || !window.Chart) return;

    // 1. Gráfico de Precipitación Horaria (Próximas 24h)
    const hourlyCanvas = document.getElementById('climate-precip-hourly-chart');
    const next24 = weatherRecord.hourly?.next24Hours || [];

    if (hourlyCanvas && next24.length > 0) {
      this.hourlyPrecipChart = new window.Chart(hourlyCanvas, {
        type: 'bar',
        data: {
          labels: next24.map(h => formatHourLabel(h.time)),
          datasets: [
            {
              type: 'bar',
              label: 'Precipitación Estimada (mm)',
              data: next24.map(h => h.precipitationMm),
              backgroundColor: 'rgba(2, 132, 199, 0.7)',
              borderColor: '#0284c7',
              borderWidth: 1,
              yAxisID: 'yMm'
            },
            {
              type: 'line',
              label: 'Probabilidad de Lluvia (%)',
              data: next24.map(h => h.precipitationProbabilityPct),
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              borderDash: [3, 3],
              yAxisID: 'yProb',
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            yMm: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              title: { display: true, text: 'Milímetros (mm)' }
            },
            yProb: {
              type: 'linear',
              position: 'right',
              min: 0,
              max: 100,
              grid: { drawOnChartArea: false },
              title: { display: true, text: 'Probabilidad (%)' }
            }
          }
        }
      });
    }

    // 2. Gráfico Diario Comparativo (Observada Real vs Estimada Hoy vs Pronosticada 7d)
    const compCanvas = document.getElementById('climate-precip-comparison-chart');
    const timeline = precipComparison.timeline || [];

    if (compCanvas && timeline.length > 0) {
      this.comparisonPrecipChart = new window.Chart(compCanvas, {
        type: 'bar',
        data: {
          labels: timeline.map(t => formatDayNameShort(t.date)),
          datasets: [
            {
              label: '1. Lluvia Observada (Pluviómetro Real)',
              data: timeline.map(t => t.observedMm),
              backgroundColor: 'rgba(21, 128, 61, 0.85)',
              borderColor: '#15803d',
              borderWidth: 1.5
            },
            {
              label: '2. Precipitación Estimada Hoy (Modelo)',
              data: timeline.map(t => t.estimatedModelTodayMm),
              backgroundColor: 'rgba(2, 132, 199, 0.75)',
              borderColor: '#0284c7',
              borderWidth: 1.5
            },
            {
              label: '3. Precipitación Pronosticada (Futuro)',
              data: timeline.map(t => t.forecastFutureMm),
              backgroundColor: 'rgba(99, 102, 241, 0.55)',
              borderColor: '#4f46e5',
              borderWidth: 1.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Precipitación (mm)' }
            }
          }
        }
      });
    }
  }

  destroyCharts() {
    if (this.hourlyPrecipChart) {
      this.hourlyPrecipChart.destroy();
      this.hourlyPrecipChart = null;
    }
    if (this.comparisonPrecipChart) {
      this.comparisonPrecipChart.destroy();
      this.comparisonPrecipChart = null;
    }
  }
}

