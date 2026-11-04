/**
 * Vista: Herramientas y Calculadoras Hídricas (WaterToolsView — Sección 5)
 * Incluye las 4 calculadoras técnicas integradas con los registros reales de HIDROTERRA:
 * 5.1 Captación de agua lluvia (V = P × A × C)
 * 5.2 Almacenamiento por geometría (Cilíndrico, Rectangular, Reservorio, Personalizado)
 * 5.3 Balance hídrico simplificado (Af = Ai + Entradas - Salidas - Pérdidas)
 * 5.4 Autonomía hídrica (Días de reserva según demanda diaria)
 */

import { WaterCalculatorsService } from '../../application/water-calculators.service.js';
import { escapeHtml } from '../../core/validators.js';
import { notification } from '../components/notification.js';
import { renderStatusBadge } from '../components/status-badge.js';

export class WaterToolsView {
  constructor(router) {
    this.router = router;
    this.activeTab = 'rainwater'; // 'rainwater' | 'storage' | 'balance' | 'autonomy'
    this.presets = {
      observedRainfallOptions: [],
      forecastRainfallOptions: [],
      sourceStoragePresets: []
    };
  }

  async render(container, params = {}) {
    if (params.tool && ['rainwater', 'storage', 'balance', 'autonomy'].includes(params.tool)) {
      this.activeTab = params.tool;
    }

    this.presets = await WaterCalculatorsService.getContextualPresets();

    container.innerHTML = `
      <div class="water-tools-view">
        <div class="view-header mb-4" style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-3);">
          <div>
            <h2><i class="fa-solid fa-calculator" style="color: var(--color-green-700);"></i> Herramientas y Calculadoras Hídricas</h2>
            <p class="text-muted" style="margin-bottom: 0;">Cálculos técnicos de cosecha de agua lluvia, dimensionamiento de almacenamiento, balance hídrico simplificado y autonomía comunitaria.</p>
          </div>
          <button class="btn btn-outline" id="btn-tools-goto-availability">
            <span>Ir a Disponibilidad Hídrica</span>
          </button>
        </div>

        <!-- Navegación por Pestañas de Calculadoras -->
        <div class="card mb-4">
          <div class="card-body" style="padding: var(--spacing-3);">
            <div class="d-flex gap-2" style="flex-wrap: wrap;">
              <button class="btn ${this.activeTab === 'rainwater' ? 'btn-primary' : 'btn-outline'} tool-tab-btn" data-tab="rainwater">
                <i class="fa-solid fa-cloud-showers-water"></i> 1. Captación de Agua Lluvia
              </button>
              <button class="btn ${this.activeTab === 'storage' ? 'btn-primary' : 'btn-outline'} tool-tab-btn" data-tab="storage">
                <i class="fa-solid fa-database"></i> 2. Calculadora de Almacenamiento
              </button>
              <button class="btn ${this.activeTab === 'balance' ? 'btn-primary' : 'btn-outline'} tool-tab-btn" data-tab="balance">
                <i class="fa-solid fa-scale-balanced"></i> 3. Balance Hídrico Simplificado
              </button>
              <button class="btn ${this.activeTab === 'autonomy' ? 'btn-primary' : 'btn-outline'} tool-tab-btn" data-tab="autonomy">
                <i class="fa-solid fa-hourglass-half"></i> 4. Autonomía Hídrica
              </button>
            </div>
          </div>
        </div>

        <!-- Contenedor Dinámico de la Calculadora Activa -->
        <div id="water-tool-outlet"></div>
      </div>
    `;

    this._bindTabEvents(container);
    this._renderActiveCalculator();
  }

  _bindTabEvents(container) {
    const availBtn = container.querySelector('#btn-tools-goto-availability');
    if (availBtn) availBtn.addEventListener('click', () => this.router.navigate('water-availability'));

    container.querySelectorAll('.tool-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        container.querySelectorAll('.tool-tab-btn').forEach(b => {
          b.className = `btn ${b.dataset.tab === this.activeTab ? 'btn-primary' : 'btn-outline'} tool-tab-btn`;
        });
        this._renderActiveCalculator();
      });
    });
  }

  _renderActiveCalculator() {
    const outlet = document.getElementById('water-tool-outlet');
    if (!outlet) return;

    if (this.activeTab === 'rainwater') {
      this._renderRainwaterCalculator(outlet);
    } else if (this.activeTab === 'storage') {
      this._renderStorageCalculator(outlet);
    } else if (this.activeTab === 'balance') {
      this._renderBalanceCalculator(outlet);
    } else if (this.activeTab === 'autonomy') {
      this._renderAutonomyCalculator(outlet);
    }
  }

  /**
   * 5.1 Calculadora de Captación de Agua Lluvia (V = P × A × C)
   */
  _renderRainwaterCalculator(outlet) {
    const surfaces = WaterCalculatorsService.getSurfaceTypes();
    const { observedRainfallOptions, forecastRainfallOptions } = this.presets;

    outlet.innerHTML = `
      <div class="dashboard-visual-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Calculadora de Captación de Agua Lluvia</h3>
              <p class="card-subtitle">Fórmula: <code>V = P × A × C</code> (1 mm sobre 1 m² equivale exactamente a 1 litro)</p>
            </div>
          </div>
          <div class="card-body">
            <form id="form-calc-rainwater">
              <div class="form-group">
                <label class="form-label" for="rw-preset-select">Cargar precipitación real o pronosticada en HIDROTERRA (opcional):</label>
                <select id="rw-preset-select" class="form-control form-select">
                  <option value="">— Ingresar precipitación manualmente —</option>
                  ${observedRainfallOptions.length > 0 ? `
                    <optgroup label="Precipitación Observada en Pluviómetros (Medición Real)">
                      ${observedRainfallOptions.map((o, idx) => `
                        <option value="obs:${idx}">${escapeHtml(o.label)}</option>
                      `).join('')}
                    </optgroup>
                  ` : ''}
                  ${forecastRainfallOptions.length > 0 ? `
                    <optgroup label="Precipitación Pronosticada (Modelo Open-Meteo)">
                      ${forecastRainfallOptions.map((f, idx) => `
                        <option value="fcst:${idx}">${escapeHtml(f.label)}</option>
                      `).join('')}
                    </optgroup>
                  ` : ''}
                </select>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label required" for="rw-precip">Precipitación (P en mm)</label>
                  <input type="number" step="0.1" min="0" id="rw-precip" class="form-control" value="35" required />
                </div>
                <div class="form-group">
                  <label class="form-label required" for="rw-area">Área de Captación (A en m²)</label>
                  <input type="number" step="0.1" min="0.1" id="rw-area" class="form-control" value="80" required />
                  <div class="form-help">Área en planta del techo o superficie colectora</div>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="rw-surface">Tipo de Superficie Colectora</label>
                  <select id="rw-surface" class="form-control form-select">
                    ${Object.entries(surfaces).map(([k, v]) => `
                      <option value="${k}">${escapeHtml(v.label)} (C ≈ ${v.defaultCoeff})</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label required" for="rw-coeff">Coeficiente de Escorrentía (C: 0.01 – 1.00)</label>
                  <input type="number" step="0.01" min="0.01" max="1" id="rw-coeff" class="form-control" value="0.85" required />
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="rw-flush">Descarte de Primeras Aguas (mm, opcional)</label>
                  <input type="number" step="0.1" min="0" id="rw-flush" class="form-control" value="1.0" />
                  <div class="form-help">Lámina inicial desviada para limpieza de polvo en techo (típico: 0.5 a 1.5 mm)</div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="rw-period">Periodo de Cálculo</label>
                  <input type="text" id="rw-period" class="form-control" value="Aguacero / Evento diario" placeholder="Ej: Mes de Octubre / Evento 24h" />
                </div>
              </div>

              <button type="submit" class="btn btn-primary">
                <i class="fa-solid fa-calculator"></i> Calcular Volumen de Captación
              </button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Resultados de Captación Pluvial</h3>
              <p class="card-subtitle">Diferenciación entre captación teórica bruta y captación real aprovechable</p>
            </div>
          </div>
          <div class="card-body" id="rw-results-box"></div>
        </div>
      </div>
    `;

    const form = outlet.querySelector('#form-calc-rainwater');
    const presetSel = outlet.querySelector('#rw-preset-select');
    const precipInput = outlet.querySelector('#rw-precip');
    const surfaceSel = outlet.querySelector('#rw-surface');
    const coeffInput = outlet.querySelector('#rw-coeff');
    const periodInput = outlet.querySelector('#rw-period');
    const resultsBox = outlet.querySelector('#rw-results-box');

    let isForecastedFlag = false;

    if (presetSel) {
      presetSel.addEventListener('change', () => {
        const val = presetSel.value;
        if (!val) {
          isForecastedFlag = false;
          return;
        }
        const [kind, idx] = val.split(':');
        if (kind === 'obs') {
          const item = observedRainfallOptions[Number(idx)];
          if (item) {
            precipInput.value = item.precipitationMm;
            periodInput.value = item.periodLabel;
            isForecastedFlag = false;
          }
        } else if (kind === 'fcst') {
          const item = forecastRainfallOptions[Number(idx)];
          if (item) {
            precipInput.value = item.precipitationMm;
            periodInput.value = item.periodLabel;
            isForecastedFlag = true;
          }
        }
      });
    }

    if (surfaceSel) {
      surfaceSel.addEventListener('change', () => {
        const cfg = surfaces[surfaceSel.value];
        if (cfg && coeffInput) coeffInput.value = cfg.defaultCoeff;
      });
    }

    const executeCalc = () => {
      try {
        const res = WaterCalculatorsService.runRainwaterHarvesting({
          precipitationMm: precipInput.value,
          catchmentAreaM2: outlet.querySelector('#rw-area').value,
          surfaceType: surfaceSel.value,
          runoffCoefficient: coeffInput.value,
          firstFlushMm: outlet.querySelector('#rw-flush').value,
          periodLabel: periodInput.value,
          isForecastedPrecipitation: isForecastedFlag
        });

        resultsBox.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span class="text-muted" style="font-size: 0.85rem;"><strong>Periodo:</strong> ${escapeHtml(res.periodLabel)}</span>
              <span class="badge ${res.precipitationSourceType === 'pronosticada' ? 'badge-warning' : 'badge-success'}">
                Lluvia ${res.precipitationSourceType === 'pronosticada' ? 'Pronosticada (Estimación)' : 'Observada / Ingresada'}
              </span>
            </div>

            <!-- 1. Captación por fórmula directa V = P * A * C -->
            <div style="background: var(--color-blue-100); border-left: 4px solid var(--color-blue-700); padding: var(--spacing-4); border-radius: var(--radius-md);">
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--color-blue-700); text-transform: uppercase;">
                Volumen Captado (V = P × A × C)
              </div>
              <div style="font-size: 1.7rem; font-weight: 800; color: var(--color-neutral-900); margin: 4px 0;">
                ${res.formulaVolumeLiters.toLocaleString('es-CO')} Litros
                <span style="font-size: 1.05rem; font-weight: 600; color: var(--color-blue-700);">(${res.formulaVolumeM3} m³)</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--color-neutral-700);">
                Cálculo: ${res.precipitationMm} mm × ${res.catchmentAreaM2} m² × ${res.runoffCoefficient} (${escapeHtml(res.surfaceLabel)})
              </div>
            </div>

            <!-- 2. Comparativa: Captación Teórica (100%) vs Captación Real Neta (tras lavado de techo) -->
            <div class="form-grid-2">
              <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3);">
                <div style="font-size: 0.78rem; color: var(--color-neutral-500); font-weight: 600;">Captación Teórica Bruta (C = 1.0)</div>
                <div style="font-size: 1.2rem; font-weight: 700;">${res.theoreticalVolumeLiters.toLocaleString('es-CO')} L</div>
                <div class="text-muted" style="font-size: 0.78rem;">${res.theoreticalVolumeM3} m³ (100% del agua caída sobre el techo sin pérdidas)</div>
              </div>

              <div style="border: 1px solid var(--color-green-600); border-radius: var(--radius-md); padding: var(--spacing-3);">
                <div style="font-size: 0.78rem; color: var(--color-green-700); font-weight: 600;">Captación Real Aprovechable (Neta)</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-green-700);">${res.realEffectiveVolumeLiters.toLocaleString('es-CO')} L</div>
                <div class="text-muted" style="font-size: 0.78rem;">${res.realEffectiveVolumeM3} m³ (descontando ${res.firstFlushMm} mm de primeras aguas y pérdidas)</div>
              </div>
            </div>

            <div style="font-size: 0.8rem; color: var(--color-neutral-600); background: var(--color-neutral-50); padding: 10px; border-radius: var(--radius-sm);">
              <strong>Pérdidas por retención/evaporación y desvío sanitario:</strong> ${res.lossesLiters.toLocaleString('es-CO')} L.
            </div>
          </div>
        `;
      } catch (err) {
        notification.error('Datos inválidos', err.message);
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      executeCalc();
    });
    executeCalc();
  }

  /**
   * 5.2 Calculadora de Almacenamiento por Geometría
   */
  _renderStorageCalculator(outlet) {
    const { sourceStoragePresets } = this.presets;

    outlet.innerHTML = `
      <div class="dashboard-visual-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Calculadora de Almacenamiento e Infraestructura</h3>
              <p class="card-subtitle">Cálculo geométrico exacto para tanques cilíndricos, rectangulares, reservorios y depósitos personalizados</p>
            </div>
          </div>
          <div class="card-body">
            <form id="form-calc-storage">
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label required" for="st-geometry">Geometría de la Infraestructura</label>
                  <select id="st-geometry" class="form-control form-select">
                    <option value="cilindrico">Tanque Cilíndrico (V = π × r² × h)</option>
                    <option value="rectangular">Tanque Rectangular (V = L × A × H)</option>
                    <option value="reservorio_rectangular">Reservorio / Jagüey Rectangular con Talud</option>
                    <option value="personalizado">Depósito de Capacidad Personalizada (Litros)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="st-source-preset">Prellenar desde Fuente Registrada (opcional)</label>
                  <select id="st-source-preset" class="form-control form-select">
                    <option value="">— Dimensiones manuales —</option>
                    ${sourceStoragePresets.map(s => `
                      <option value="${escapeHtml(s.id)}">${escapeHtml(s.code)} — ${escapeHtml(s.name)}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <!-- Campos dinámicos según geometría -->
              <div id="st-dynamic-dimensions"></div>

              <div class="form-grid-2" style="padding-top: 8px; border-top: 1px solid var(--color-neutral-200);">
                <div class="form-group">
                  <label class="form-label" for="st-demand">Demanda Diaria Estimada (L/día, opcional)</label>
                  <input type="number" step="1" min="0" id="st-demand" class="form-control" value="500" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="st-target-days">Días de Reserva Objetivo (opcional)</label>
                  <input type="number" step="1" min="1" id="st-target-days" class="form-control" value="30" />
                </div>
              </div>

              <button type="submit" class="btn btn-primary">
                <i class="fa-solid fa-calculator"></i> Calcular Capacidad y Llenado
              </button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Capacidad Total, Volumen Disponible y Faltante</h3>
              <p class="card-subtitle">Resultados en litros (L), metros cúbicos (m³) y porcentaje de llenado</p>
            </div>
          </div>
          <div class="card-body" id="st-results-box"></div>
        </div>
      </div>
    `;

    const geomSel = outlet.querySelector('#st-geometry');
    const sourcePresetSel = outlet.querySelector('#st-source-preset');
    const dimContainer = outlet.querySelector('#st-dynamic-dimensions');
    const form = outlet.querySelector('#form-calc-storage');
    const resultsBox = outlet.querySelector('#st-results-box');

    const renderDimensionFields = () => {
      const g = geomSel.value;
      if (g === 'cilindrico') {
        dimContainer.innerHTML = `
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label required" for="st-diam">Diámetro Interno (m)</label>
              <input type="number" step="0.01" min="0.1" id="st-diam" class="form-control" value="2.20" required />
            </div>
            <div class="form-group">
              <label class="form-label required" for="st-height">Altura Útil Total (m)</label>
              <input type="number" step="0.01" min="0.1" id="st-height" class="form-control" value="2.50" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label required" for="st-level">Nivel Actual de Agua (m)</label>
            <input type="number" step="0.01" min="0" id="st-level" class="form-control" value="1.65" required />
          </div>
        `;
      } else if (g === 'rectangular' || g === 'reservorio_rectangular') {
        dimContainer.innerHTML = `
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label required" for="st-len">Largo (m)</label>
              <input type="number" step="0.1" min="0.1" id="st-len" class="form-control" value="${g === 'reservorio_rectangular' ? '15.0' : '3.0'}" required />
            </div>
            <div class="form-group">
              <label class="form-label required" for="st-wid">Ancho (m)</label>
              <input type="number" step="0.1" min="0.1" id="st-wid" class="form-control" value="${g === 'reservorio_rectangular' ? '10.0' : '2.5'}" required />
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label required" for="st-height">Profundidad / Altura Total (m)</label>
              <input type="number" step="0.05" min="0.1" id="st-height" class="form-control" value="${g === 'reservorio_rectangular' ? '2.5' : '2.0'}" required />
            </div>
            <div class="form-group">
              <label class="form-label required" for="st-level">Nivel Actual de Agua (m)</label>
              <input type="number" step="0.05" min="0" id="st-level" class="form-control" value="${g === 'reservorio_rectangular' ? '1.4' : '1.2'}" required />
            </div>
          </div>
          ${g === 'reservorio_rectangular' ? `
            <div class="form-group">
              <label class="form-label" for="st-slope">Factor Geométrico de Talud (0.50 a 1.00)</label>
              <input type="number" step="0.05" min="0.5" max="1" id="st-slope" class="form-control" value="0.80" />
              <div class="form-help">Compensa la inclinación de las paredes excavadas del reservorio o jagüey</div>
            </div>
          ` : ''}
        `;
      } else {
        dimContainer.innerHTML = `
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label required" for="st-custom-cap">Capacidad Nominal Total (Litros)</label>
              <input type="number" step="10" min="1" id="st-custom-cap" class="form-control" value="10000" required />
            </div>
            <div class="form-group">
              <label class="form-label required" for="st-custom-vol">Volumen Disponible Actual (Litros)</label>
              <input type="number" step="10" min="0" id="st-custom-vol" class="form-control" value="6500" required />
            </div>
          </div>
        `;
      }
    };

    renderDimensionFields();
    geomSel.addEventListener('change', () => {
      renderDimensionFields();
      executeStorageCalc();
    });

    if (sourcePresetSel) {
      sourcePresetSel.addEventListener('change', () => {
        const s = sourceStoragePresets.find(x => x.id === sourcePresetSel.value);
        if (!s) return;
        if (s.knownCapacityLiters) {
          geomSel.value = 'personalizado';
          renderDimensionFields();
          outlet.querySelector('#st-custom-cap').value = s.knownCapacityLiters;
          outlet.querySelector('#st-custom-vol').value = s.availableVolumeLiters ?? Math.round(s.knownCapacityLiters * 0.5);
          executeStorageCalc();
        }
      });
    }

    const executeStorageCalc = () => {
      try {
        const g = geomSel.value;
        const res = WaterCalculatorsService.runStorageCalculator({
          geometry: g,
          diameterMeters: outlet.querySelector('#st-diam')?.value,
          lengthMeters: outlet.querySelector('#st-len')?.value,
          widthMeters: outlet.querySelector('#st-wid')?.value,
          totalHeightMeters: outlet.querySelector('#st-height')?.value,
          currentWaterLevelMeters: outlet.querySelector('#st-level')?.value,
          slopeFactor: outlet.querySelector('#st-slope')?.value,
          customTotalCapacityLiters: outlet.querySelector('#st-custom-cap')?.value,
          customCurrentVolumeLiters: outlet.querySelector('#st-custom-vol')?.value,
          dailyDemandLiters: outlet.querySelector('#st-demand')?.value,
          reserveDaysTarget: outlet.querySelector('#st-target-days')?.value
        });

        const barColor = res.fillPercentage >= 70 ? '#2d6a4f' : res.fillPercentage >= 40 ? '#e9c46a' : '#d90429';

        resultsBox.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
            <div style="font-size: 0.82rem; color: var(--color-neutral-600);">
              <strong>Fórmula aplicada:</strong> <code>${escapeHtml(res.formulaUsed)}</code>
            </div>

            <!-- Barra de porcentaje de llenado -->
            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); padding: var(--spacing-3); border-radius: var(--radius-md);">
              <div class="d-flex justify-between align-center mb-2">
                <strong>Porcentaje de Llenado Actual:</strong>
                <span style="font-size: 1.25rem; font-weight: 800; color: var(--color-blue-700);">${res.fillPercentage}%</span>
              </div>
              <div style="height: 14px; width: 100%; background: var(--color-neutral-200); border-radius: 999px; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(100, res.fillPercentage)}%; background: ${barColor}; transition: width 0.3s;"></div>
              </div>
            </div>

            <div class="form-grid-2">
              <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3);">
                <div style="font-size: 0.78rem; color: var(--color-neutral-500);">Capacidad Total</div>
                <div style="font-size: 1.15rem; font-weight: 700;">${res.totalCapacityLiters.toLocaleString('es-CO')} L</div>
                <div class="text-muted" style="font-size: 0.8rem;">${res.totalCapacityM3} m³</div>
              </div>

              <div style="border: 1px solid var(--color-blue-600); border-radius: var(--radius-md); padding: var(--spacing-3);">
                <div style="font-size: 0.78rem; color: var(--color-blue-700); font-weight: 600;">Volumen Disponible</div>
                <div style="font-size: 1.15rem; font-weight: 700; color: var(--color-blue-700);">${res.availableVolumeLiters.toLocaleString('es-CO')} L</div>
                <div class="text-muted" style="font-size: 0.8rem;">${res.availableVolumeM3} m³</div>
              </div>
            </div>

            <div class="form-grid-2">
              <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3);">
                <div style="font-size: 0.78rem; color: var(--color-neutral-500);">Volumen Faltante (Cupo Libre)</div>
                <div style="font-size: 1.1rem; font-weight: 700;">${res.missingVolumeLiters.toLocaleString('es-CO')} L</div>
                <div class="text-muted" style="font-size: 0.8rem;">${res.missingVolumeM3} m³ para llenado al 100%</div>
              </div>

              ${res.requiredCapacityLiters !== null ? `
                <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3);">
                  <div style="font-size: 0.78rem; color: var(--color-neutral-500);">Capacidad Requerida Según Demanda</div>
                  <div style="font-size: 1.1rem; font-weight: 700;">${res.requiredCapacityLiters.toLocaleString('es-CO')} L (${res.requiredCapacityM3} m³)</div>
                  <div style="font-size: 0.78rem;" class="${res.capacityDeficitLiters > 0 ? 'text-danger' : 'text-muted'}">
                    ${res.capacityDeficitLiters > 0
                      ? `Déficit de infraestructura: faltan ${res.capacityDeficitLiters.toLocaleString('es-CO')} L de capacidad`
                      : `Infraestructura suficiente para la demanda proyectada`}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      } catch (err) {
        notification.error('Error en cálculo', err.message);
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      executeStorageCalc();
    });
    executeStorageCalc();
  }

  /**
   * 5.3 Calculadora de Balance Hídrico Simplificado
   */
  _renderBalanceCalculator(outlet) {
    outlet.innerHTML = `
      <div class="dashboard-visual-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Calculadora de Balance Hídrico Simplificado</h3>
              <p class="card-subtitle"><code>Almacenamiento final = Almacenamiento inicial + Entradas - Salidas - Pérdidas</code></p>
            </div>
          </div>
          <div class="card-body">
            <form id="form-calc-balance">
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label required" for="wb-initial">Almacenamiento Inicial (Litros)</label>
                  <input type="number" step="10" min="0" id="wb-initial" class="form-control" value="5000" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="wb-max-cap">Capacidad Máxima del Sistema (Litros, opcional)</label>
                  <input type="number" step="10" min="0" id="wb-max-cap" class="form-control" value="10000" />
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="wb-precip">Precipitación del Periodo (mm)</label>
                  <input type="number" step="0.1" min="0" id="wb-precip" class="form-control" value="40" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="wb-area">Área de Captación Pluvial (m²)</label>
                  <input type="number" step="1" min="0" id="wb-area" class="form-control" value="60" />
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="wb-coeff">Coeficiente de Escorrentía (0.1 – 1.0)</label>
                  <input type="number" step="0.05" min="0.1" max="1" id="wb-coeff" class="form-control" value="0.80" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="wb-other-in">Otras Entradas de Agua (Bombeo / Acarreo en L)</label>
                  <input type="number" step="10" min="0" id="wb-other-in" class="form-control" value="500" />
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label required" for="wb-consumption">Consumo Estimado / Salidas (Litros)</label>
                  <input type="number" step="10" min="0" id="wb-consumption" class="form-control" value="2800" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="wb-losses">Pérdidas Estimadas (Evaporación / Filtración en L)</label>
                  <input type="number" step="10" min="0" id="wb-losses" class="form-control" value="350" />
                </div>
              </div>

              <button type="submit" class="btn btn-primary">
                <i class="fa-solid fa-scale-balanced"></i> Calcular Balance Hídrico
              </button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Resultado del Balance Hídrico Operativo</h3>
              <p class="card-subtitle">Relación entre entradas pluviales/externas, consumo y almacenamiento resultante</p>
            </div>
          </div>
          <div class="card-body" id="wb-results-box"></div>
        </div>
      </div>
    `;

    const form = outlet.querySelector('#form-calc-balance');
    const resultsBox = outlet.querySelector('#wb-results-box');

    const executeBalance = () => {
      try {
        const res = WaterCalculatorsService.runWaterBalance({
          initialStorageLiters: outlet.querySelector('#wb-initial').value,
          maxStorageCapacityLiters: outlet.querySelector('#wb-max-cap').value,
          precipitationMm: outlet.querySelector('#wb-precip').value,
          catchmentAreaM2: outlet.querySelector('#wb-area').value,
          runoffCoefficient: outlet.querySelector('#wb-coeff').value,
          otherInflowsLiters: outlet.querySelector('#wb-other-in').value,
          estimatedConsumptionLiters: outlet.querySelector('#wb-consumption').value,
          estimatedLossesLiters: outlet.querySelector('#wb-losses').value
        });

        resultsBox.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
            <div style="background: ${res.isDeficit ? 'rgba(217, 4, 41, 0.08)' : 'var(--color-blue-100)'}; border-left: 4px solid ${res.isDeficit ? 'var(--color-danger)' : 'var(--color-blue-700)'}; padding: var(--spacing-4); border-radius: var(--radius-md);">
              <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">
                Almacenamiento Final Estimado
              </div>
              <div style="font-size: 1.65rem; font-weight: 800; margin: 4px 0;">
                ${res.effectiveFinalStorageLiters.toLocaleString('es-CO')} Litros (${res.effectiveFinalStorageM3} m³)
              </div>
              <div style="font-size: 0.82rem;">
                Variación neta del periodo: <strong>${res.netVariationLiters >= 0 ? `+${res.netVariationLiters.toLocaleString('es-CO')}` : res.netVariationLiters.toLocaleString('es-CO')} L</strong>
                ${res.isDeficit ? ` | <span class="text-danger"><strong>Déficit no cubierto: ${res.unfulfilledDemandLiters.toLocaleString('es-CO')} L</strong></span>` : ''}
              </div>
            </div>

            <div class="form-grid-2">
              <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3); font-size: 0.85rem;">
                <strong> (+) Entradas Totales: ${res.totalInflowsLiters.toLocaleString('es-CO')} L</strong>
                <div class="text-muted">• Captación pluvial: ${res.harvestedInflowLiters.toLocaleString('es-CO')} L</div>
                <div class="text-muted">• Otras entradas: ${res.otherInflowsLiters.toLocaleString('es-CO')} L</div>
              </div>

              <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3); font-size: 0.85rem;">
                <strong> (–) Salidas y Pérdidas: ${res.totalOutflowsAndLossesLiters.toLocaleString('es-CO')} L</strong>
                <div class="text-muted">• Consumo estimado: ${res.estimatedConsumptionLiters.toLocaleString('es-CO')} L</div>
                <div class="text-muted">• Pérdidas estimadas: ${res.estimatedLossesLiters.toLocaleString('es-CO')} L</div>
              </div>
            </div>

            ${res.warnings.length > 0 ? `
              <div style="background: rgba(233, 196, 106, 0.2); border: 1px solid var(--color-warning); padding: 10px 12px; border-radius: var(--radius-sm); font-size: 0.8rem;">
                <strong><i class="fa-solid fa-triangle-exclamation"></i> Advertencias del cálculo:</strong>
                <ul style="margin: 4px 0 0 18px;">
                  ${res.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); padding: 10px 12px; border-radius: var(--radius-sm); font-size: 0.78rem; color: var(--color-neutral-600);">
              <i class="fa-solid fa-circle-info"></i> ${escapeHtml(res.methodologyDisclaimer)}
            </div>
          </div>
        `;
      } catch (err) {
        notification.error('Error en balance hídrico', err.message);
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      executeBalance();
    });
    executeBalance();
  }

  /**
   * 5.4 Calculadora de Autonomía Hídrica
   */
  _renderAutonomyCalculator(outlet) {
    const { sourceStoragePresets } = this.presets;

    outlet.innerHTML = `
      <div class="dashboard-visual-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Calculadora de Autonomía Hídrica</h3>
              <p class="card-subtitle">Estima cuántos días puede sostenerse una reserva de agua sin nuevas entradas</p>
            </div>
          </div>
          <div class="card-body">
            <form id="form-calc-autonomy">
              <div class="form-group">
                <label class="form-label" for="au-source-preset">Cargar volumen disponible desde Fuente Hídrica (opcional):</label>
                <select id="au-source-preset" class="form-control form-select">
                  <option value="">— Ingresar volumen manualmente —</option>
                  ${sourceStoragePresets.filter(s => s.availableVolumeLiters !== null || s.knownCapacityLiters !== null).map(s => `
                    <option value="${escapeHtml(s.id)}">
                      ${escapeHtml(s.code)} — ${escapeHtml(s.name)} (${(s.availableVolumeLiters ?? s.knownCapacityLiters).toLocaleString('es-CO')} L)
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label required" for="au-vol">Volumen Disponible Actual (Litros)</label>
                  <input type="number" step="10" min="0" id="au-vol" class="form-control" value="12000" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="au-margin">Margen de Reserva / Volumen Muerto (%)</label>
                  <input type="number" step="1" min="0" max="50" id="au-margin" class="form-control" value="10" />
                  <div class="form-help">Porcentaje en fondo no bombeable o con sedimento (0% a 50%)</div>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label required" for="au-users">Número de Personas o Unidades Productivas</label>
                  <input type="number" step="1" min="1" id="au-users" class="form-control" value="25" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="au-unit-type">Tipo de Unidad</label>
                  <select id="au-unit-type" class="form-control form-select">
                    <option value="personas">Personas (Abastecimiento doméstico)</option>
                    <option value="familias">Familias rurales</option>
                    <option value="cabezas de ganado">Cabezas de ganado bovino</option>
                    <option value="parcelas de cultivo">Parcelas / Camas de riego</option>
                  </select>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label required" for="au-per-unit">Consumo Estimado por Unidad (L/día)</label>
                  <input type="number" step="1" min="0.5" id="au-per-unit" class="form-control" value="20" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="au-direct-demand">O Demanda Diaria Total Directa (L/día, opcional)</label>
                  <input type="number" step="1" min="0" id="au-direct-demand" class="form-control" placeholder="Calculado: Usuarios × Consumo" />
                </div>
              </div>

              <button type="submit" class="btn btn-primary">
                <i class="fa-solid fa-hourglass-half"></i> Calcular Días de Autonomía
              </button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Días Estimados de Autonomía y Condiciones</h3>
              <p class="card-subtitle">Proyección bajo consumo constante sin recarga adicional</p>
            </div>
          </div>
          <div class="card-body" id="au-results-box"></div>
        </div>
      </div>
    `;

    const form = outlet.querySelector('#form-calc-autonomy');
    const presetSel = outlet.querySelector('#au-source-preset');
    const volInput = outlet.querySelector('#au-vol');
    const resultsBox = outlet.querySelector('#au-results-box');

    if (presetSel) {
      presetSel.addEventListener('change', () => {
        const s = sourceStoragePresets.find(x => x.id === presetSel.value);
        if (s && (s.availableVolumeLiters !== null || s.knownCapacityLiters !== null)) {
          volInput.value = s.availableVolumeLiters ?? s.knownCapacityLiters;
          executeAutonomy();
        }
      });
    }

    const executeAutonomy = () => {
      try {
        const res = WaterCalculatorsService.runWaterAutonomy({
          availableVolumeLiters: volInput.value,
          safetyMarginPct: outlet.querySelector('#au-margin').value,
          usersOrUnitsCount: outlet.querySelector('#au-users').value,
          unitTypeLabel: outlet.querySelector('#au-unit-type').value,
          dailyConsumptionPerUnitLiters: outlet.querySelector('#au-per-unit').value,
          directTotalDailyDemandLiters: outlet.querySelector('#au-direct-demand').value
        });

        resultsBox.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
            <div style="background: var(--color-blue-100); border-left: 4px solid var(--color-blue-700); padding: var(--spacing-4); border-radius: var(--radius-md);">
              <div class="d-flex justify-between align-center">
                <span style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--color-blue-700);">
                  Autonomía Operativa Segura
                </span>
                ${renderStatusBadge(res.autonomyClassification)}
              </div>
              <div style="font-size: 1.85rem; font-weight: 800; margin: 6px 0;">
                ${res.safeAutonomyDays} Días
              </div>
              <div style="font-size: 0.82rem; color: var(--color-neutral-700);">
                Autonomía teórica bruta (al 100% del volumen): <strong>${res.theoreticalAutonomyDays} días</strong>
              </div>
            </div>

            <div class="form-grid-2">
              <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3);">
                <div style="font-size: 0.78rem; color: var(--color-neutral-500);">Volumen Útil Aprovechable</div>
                <div style="font-size: 1.15rem; font-weight: 700;">${res.usableVolumeLiters.toLocaleString('es-CO')} L</div>
                <div class="text-muted" style="font-size: 0.78rem;">De ${res.availableVolumeLiters.toLocaleString('es-CO')} L totales (margen ${res.safetyMarginPct}%)</div>
              </div>

              <div style="border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3);">
                <div style="font-size: 0.78rem; color: var(--color-neutral-500);">Demanda Diaria Total</div>
                <div style="font-size: 1.15rem; font-weight: 700;">${res.totalDailyDemandLiters.toLocaleString('es-CO')} L/día</div>
                <div class="text-muted" style="font-size: 0.78rem;">${res.usersOrUnitsCount} ${escapeHtml(res.unitTypeLabel)}</div>
              </div>
            </div>

            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); padding: 10px 12px; border-radius: var(--radius-sm); font-size: 0.8rem;">
              <strong>Condiciones empleadas en el cálculo:</strong><br/>
              ${escapeHtml(res.conditionsSummary)}
            </div>
          </div>
        `;
      } catch (err) {
        notification.error('Error en cálculo de autonomía', err.message);
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      executeAutonomy();
    });
    executeAutonomy();
  }
}

