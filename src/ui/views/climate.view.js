/**
 * Vista Principal: HIDROTERRA CLIMA — Sistema de Monitoreo Meteorológico y Análisis Agroclimático
 * Ruta: #climate ("Clima y Meteorología")
 */

import { PluviometersService } from '../../application/pluviometers.service.js';
import { WaterSourcesService } from '../../application/water-sources.service.js';
import { WaterAvailabilityService } from '../../application/water-availability.service.js';
import { SitesService } from '../../application/sites.service.js';
import { ParcelsService } from '../../application/parcels.service.js';
import { RainfallService } from '../../application/rainfall.service.js';
import { ObservationsService } from '../../application/observations.service.js';
import { cropRepository } from '../../infrastructure/database/repositories/crop.repository.js';

import { WEATHER_CONFIG } from '../../modules/climate/config/weatherConfig.js';
import { validateWeatherCoordinates } from '../../modules/climate/utils/weatherValidators.js';
import { weatherApi } from '../../modules/climate/services/weatherApi.js';
import { weatherCache } from '../../modules/climate/services/weatherCache.js';
import {
  computeAgroclimaticIndicators,
  generateAgroclimaticAlerts,
  buildPrecipitationComparison
} from '../../modules/climate/services/weatherAnalysis.js';

import {
  renderCurrentWeatherPanel,
  renderEntityIntegrationCard
} from '../../modules/climate/components/CurrentWeather.js';
import { renderAgroclimaticIndicators } from '../../modules/climate/components/AgroclimaticIndicators.js';
import { renderClimateAlertsPanel } from '../../modules/climate/components/ClimateAlerts.js';
import { WeatherForecastSection } from '../../modules/climate/components/WeatherForecast.js';
import { PrecipitationAnalysisSection } from '../../modules/climate/components/PrecipitationChart.js';
import { WeatherMapSection } from '../../modules/climate/components/WeatherMap.js';

import { notification } from '../components/notification.js';
import { events } from '../../core/events.js';
import { escapeHtml } from '../../core/validators.js';

export class ClimateView {
  constructor(router) {
    this.router = router;
    this.pluviometers = [];
    this.waterSources = [];
    this.sites = [];
    this.parcels = [];
    this.rainfallRecords = [];
    this.soilObservations = [];

    this.selectedLocation = null;
    this.weatherRecord = null;
    this.connectionStatus = 'unavailable';
    this.weatherError = null;
    this.isLoading = false;

    this.forecastSection = new WeatherForecastSection();
    this.precipSection = new PrecipitationAnalysisSection();
    this.mapSection = new WeatherMapSection({
      onSelectLocation: (loc) => this.selectLocationAndFetch(loc),
      onNavigateRoute: (route) => this.router.navigate(route)
    });

    this._connectivityHandler = null;
  }

  async render(container, params = {}) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;" class="text-muted">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 8px;"></i>
        <p>Cargando módulo HIDROTERRA CLIMA e inventario georreferenciado...</p>
      </div>
    `;

    // 1. Cargar entidades territoriales reales existentes en HIDROTERRA
    const [pluvs, sources, sites, parcels, rainRecords, observations, waterMeasurements, crops] = await Promise.all([
      PluviometersService.getAll(),
      WaterSourcesService.getAll({ onlyActive: true }),
      SitesService.getAll(),
      ParcelsService.getAll(),
      RainfallService.getAll(),
      ObservationsService.getAll({ category: 'condicion_suelo' }),
      WaterAvailabilityService.getAllMeasurements(),
      cropRepository.getAll()
    ]);

    this.pluviometers = pluvs.filter(p => p.latitude !== null && p.longitude !== null);
    this.waterSources = sources.filter(s => s.latitude !== null && s.longitude !== null);
    this.sites = sites.filter(st => st.latitude !== null && st.longitude !== null);
    this.parcels = parcels.filter(pr => pr.latitude !== null && pr.longitude !== null);
    this.rainfallRecords = rainRecords;
    this.soilObservations = observations;
    this.waterMeasurements = waterMeasurements;
    this.crops = crops;

    this.mapSection.buildRealPoints({
      pluviometers: this.pluviometers,
      waterSources: this.waterSources,
      sites: this.sites,
      parcels: this.parcels
    });

    // 2. Determinar ubicación inicial priorizando puntos registrados en HIDROTERRA
    this.selectedLocation = this._resolveInitialLocation(params);

    // 3. Renderizar estructura principal del módulo
    container.innerHTML = `
      <div class="climate-view">
        <!-- Encabezado de la Vista -->
        <div class="view-header d-flex justify-between align-center mb-4">
          <div>
            <h2><i class="fa-solid fa-cloud-sun-rain" style="color: var(--color-blue-700);"></i> HIDROTERRA CLIMA — Monitoreo Meteorológico y Análisis Agroclimático</h2>
            <p class="text-muted">Condiciones meteorológicas actuales, pronóstico horario y de 7 días, evapotranspiración FAO ET₀ y balance de lluvias en Montes de María.</p>
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-primary" id="btn-climate-refresh">
              <span><i class="fa-solid fa-arrows-rotate"></i> Actualizar Pronóstico</span>
            </button>
          </div>
        </div>

        <!-- Sección 4.5: Selector de Ubicación Meteorológica (4 Alternativas Priorizadas) -->
        ${this._renderLocationSelectorBar()}

        <!-- Contenedor Dinámico de Resultados Meteorológicos y Agroclimáticos -->
        <div id="climate-dynamic-dashboard"></div>

        <!-- Sección 4.4: Mapa Climático Interactivo (Leaflet + OpenStreetMap) -->
        <div id="climate-map-outlet">
          ${this.mapSection.render(this.selectedLocation)}
        </div>
      </div>
    `;

    this._bindSelectorEvents(container);

    // Escuchar recuperación de conexión a Internet para actualizar datos automáticamente
    this._connectivityHandler = ({ online }) => {
      if (online && this.selectedLocation && this.connectionStatus !== 'live') {
        notification.info('Conexión restablecida', 'Actualizando pronóstico meteorológico desde Open-Meteo...');
        this.selectLocationAndFetch(this.selectedLocation, { forceRefresh: true });
      }
    };
    events.on('connectivity:changed', this._connectivityHandler);

    // 4. Ejecutar consulta meteorológica inicial
    await this.selectLocationAndFetch(this.selectedLocation, { forceRefresh: false, container });
  }

  _resolveInitialLocation(params = {}) {
    // Si viene por parámetro un pluviómetro o fuente específica
    if (params.pluviometerId) {
      const pluv = this.pluviometers.find(p => p.id === params.pluviometerId);
      if (pluv) {
        return {
          name: `${pluv.code} — ${pluv.name}`,
          latitude: Number(pluv.latitude),
          longitude: Number(pluv.longitude),
          entityType: 'pluviometer',
          entityId: pluv.id,
          rawEntity: pluv
        };
      }
    }

    if (params.waterSourceId) {
      const src = this.waterSources.find(s => s.id === params.waterSourceId);
      if (src) {
        return {
          name: `${src.code} — ${src.name}`,
          latitude: Number(src.latitude),
          longitude: Number(src.longitude),
          entityType: 'water_source',
          entityId: src.id,
          rawEntity: src
        };
      }
    }

    // Prioridad 1: Primer pluviómetro activo georreferenciado
    if (this.pluviometers.length > 0) {
      const p = this.pluviometers[0];
      return {
        name: `${p.code} — ${p.name}`,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        entityType: 'pluviometer',
        entityId: p.id,
        rawEntity: p
      };
    }

    // Prioridad 2: Primera fuente hídrica georreferenciada
    if (this.waterSources.length > 0) {
      const s = this.waterSources[0];
      return {
        name: `${s.code} — ${s.name}`,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        entityType: 'water_source',
        entityId: s.id,
        rawEntity: s
      };
    }

    // Prioridad 3: Primera comunidad o parcela registrada
    if (this.sites.length > 0) {
      const st = this.sites[0];
      return {
        name: `${st.name} (${st.municipality || ''})`,
        latitude: Number(st.latitude),
        longitude: Number(st.longitude),
        entityType: 'site',
        entityId: st.id,
        municipality: st.municipality || '',
        rawEntity: st
      };
    }

    // Prioridad 4: Última ubicación consultada guardada o referencia regional de Montes de María
    const saved = weatherCache.getLastLocation();
    if (saved && validateWeatherCoordinates(saved.latitude, saved.longitude).valid) {
      return saved;
    }

    return { ...WEATHER_CONFIG.defaultReferenceLocation };
  }

  _renderLocationSelectorBar() {
    const selType = this.selectedLocation?.entityType || '';
    const selId = this.selectedLocation?.entityId || '';

    return `
      <div class="climate-selector-bar">
        <div class="d-flex justify-between align-center mb-3" style="flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: var(--font-size-sm); color: var(--color-neutral-900);">
              <i class="fa-solid fa-compass" style="color: var(--color-green-700);"></i> Consulta Meteorológica por Ubicación Territorial
            </strong>
            <span class="text-muted" style="font-size: var(--font-size-xs); margin-left: 6px;">
              Seleccione un punto registrado en HIDROTERRA, elija en el mapa inferior o ingrese coordenadas manuales
            </span>
          </div>
        </div>

        <div class="climate-selector-grid">
          <!-- Alternativa 1A: Seleccionar Pluviómetro Registrado -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" for="climate-select-pluv">
              <i class="fa-solid fa-cloud-showers-heavy" style="color: var(--color-green-700);"></i> 1. Pluviómetro Registrado:
            </label>
            <select class="form-control form-select" id="climate-select-pluv">
              <option value="">— Seleccionar pluviómetro (${this.pluviometers.length}) —</option>
              ${this.pluviometers.map(p => `
                <option value="${escapeHtml(p.id)}" ${selType === 'pluviometer' && selId === p.id ? 'selected' : ''}>
                  ${escapeHtml(p.code)} — ${escapeHtml(p.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Alternativa 1B: Seleccionar Fuente Hídrica Registrada -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" for="climate-select-source">
              <i class="fa-solid fa-faucet-drip" style="color: var(--color-blue-700);"></i> 2. Fuente Hídrica Registrada:
            </label>
            <select class="form-control form-select" id="climate-select-source">
              <option value="">— Seleccionar fuente de agua (${this.waterSources.length}) —</option>
              ${this.waterSources.map(s => `
                <option value="${escapeHtml(s.id)}" ${selType === 'water_source' && selId === s.id ? 'selected' : ''}>
                  ${escapeHtml(s.code)} — ${escapeHtml(s.name)} (${escapeHtml(s.type)})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Alternativa 2: Seleccionar Comunidad o Unidad Productiva (Parcela) -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" for="climate-select-community">
              <i class="fa-solid fa-mountain-sun" style="color: var(--color-earth-700);"></i> 3. Comunidad o Parcela Productiva:
            </label>
            <select class="form-control form-select" id="climate-select-community">
              <option value="">— Seleccionar comunidad o parcela (${this.sites.length + this.parcels.length}) —</option>
              ${this.sites.length > 0 ? `
                <optgroup label="Comunidades y Sitios (${this.sites.length})">
                  ${this.sites.map(st => `
                    <option value="site:${escapeHtml(st.id)}" ${selType === 'site' && selId === st.id ? 'selected' : ''}>
                      Comunidad: ${escapeHtml(st.name)} (${escapeHtml(st.municipality)})
                    </option>
                  `).join('')}
                </optgroup>
              ` : ''}
              ${this.parcels.length > 0 ? `
                <optgroup label="Parcelas Productivas (${this.parcels.length})">
                  ${this.parcels.map(pr => `
                    <option value="parcel:${escapeHtml(pr.id)}" ${selType === 'parcel' && selId === pr.id ? 'selected' : ''}>
                      Parcela: ${escapeHtml(pr.code)} — ${escapeHtml(pr.name)}
                    </option>
                  `).join('')}
                </optgroup>
              ` : ''}
            </select>
          </div>
        </div>

        <!-- Alternativa 4: Introducir Manualmente Coordenadas Geográficas (Sin requerir permisos GPS) -->
        <form class="climate-manual-coords-row" id="form-climate-manual-coords">
          <div style="flex: 1; min-width: 150px;">
            <label class="form-label" for="climate-input-lat" style="font-size: var(--font-size-xs);">4. Latitud decimal (-90 a 90°):</label>
            <input type="number" step="0.0001" min="-90" max="90" class="form-control" id="climate-input-lat"
                   placeholder="Ej: 9.7175" value="${this.selectedLocation?.latitude ?? ''}" required />
          </div>
          <div style="flex: 1; min-width: 150px;">
            <label class="form-label" for="climate-input-lon" style="font-size: var(--font-size-xs);">Longitud decimal (-180 a 180°):</label>
            <input type="number" step="0.0001" min="-180" max="180" class="form-control" id="climate-input-lon"
                   placeholder="Ej: -75.1213" value="${this.selectedLocation?.longitude ?? ''}" required />
          </div>
          <div style="flex: 1.4; min-width: 180px;">
            <label class="form-label" for="climate-input-label" style="font-size: var(--font-size-xs);">Etiqueta del punto (opcional):</label>
            <input type="text" class="form-control" id="climate-input-label"
                   placeholder="Ej: Vereda San Isidro / Punto de consulta" value="${escapeHtml(this.selectedLocation?.name || '')}" />
          </div>
          <button type="submit" class="btn btn-blue">
            <i class="fa-solid fa-magnifying-glass-location"></i> Consultar Coordenadas
          </button>
        </form>
      </div>
    `;
  }

  _bindSelectorEvents(container) {
    const pluvSelect = container.querySelector('#climate-select-pluv');
    const sourceSelect = container.querySelector('#climate-select-source');
    const commSelect = container.querySelector('#climate-select-community');
    const manualForm = container.querySelector('#form-climate-manual-coords');
    const refreshBtn = container.querySelector('#btn-climate-refresh');

    if (pluvSelect) {
      pluvSelect.addEventListener('change', () => {
        const id = pluvSelect.value;
        if (!id) return;
        if (sourceSelect) sourceSelect.value = '';
        if (commSelect) commSelect.value = '';
        const pluv = this.pluviometers.find(p => p.id === id);
        if (pluv) {
          this.selectLocationAndFetch({
            name: `${pluv.code} — ${pluv.name}`,
            latitude: Number(pluv.latitude),
            longitude: Number(pluv.longitude),
            entityType: 'pluviometer',
            entityId: pluv.id,
            rawEntity: pluv
          });
        }
      });
    }

    if (sourceSelect) {
      sourceSelect.addEventListener('change', () => {
        const id = sourceSelect.value;
        if (!id) return;
        if (pluvSelect) pluvSelect.value = '';
        if (commSelect) commSelect.value = '';
        const src = this.waterSources.find(s => s.id === id);
        if (src) {
          this.selectLocationAndFetch({
            name: `${src.code} — ${src.name}`,
            latitude: Number(src.latitude),
            longitude: Number(src.longitude),
            entityType: 'water_source',
            entityId: src.id,
            rawEntity: src
          });
        }
      });
    }

    if (commSelect) {
      commSelect.addEventListener('change', () => {
        const val = commSelect.value;
        if (!val) return;
        if (pluvSelect) pluvSelect.value = '';
        if (sourceSelect) sourceSelect.value = '';

        const [kind, id] = val.split(':');
        if (kind === 'site') {
          const st = this.sites.find(s => s.id === id);
          if (st) {
            this.selectLocationAndFetch({
              name: `${st.name} (${st.municipality || ''})`,
              latitude: Number(st.latitude),
              longitude: Number(st.longitude),
              entityType: 'site',
              entityId: st.id,
              municipality: st.municipality || '',
              rawEntity: st
            });
          }
        } else if (kind === 'parcel') {
          const pr = this.parcels.find(p => p.id === id);
          if (pr) {
            this.selectLocationAndFetch({
              name: `Parcela ${pr.code} — ${pr.name}`,
              latitude: Number(pr.latitude),
              longitude: Number(pr.longitude),
              entityType: 'parcel',
              entityId: pr.id,
              rawEntity: pr
            });
          }
        }
      });
    }

    if (manualForm) {
      manualForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const latInput = container.querySelector('#climate-input-lat');
        const lonInput = container.querySelector('#climate-input-lon');
        const labelInput = container.querySelector('#climate-input-label');

        const check = validateWeatherCoordinates(latInput?.value, lonInput?.value);
        if (!check.valid) {
          notification.error('Coordenadas inválidas', check.error);
          return;
        }

        if (pluvSelect) pluvSelect.value = '';
        if (sourceSelect) sourceSelect.value = '';
        if (commSelect) commSelect.value = '';

        const customLabel = (labelInput?.value || '').trim() || `Coordenadas (${check.latitude.toFixed(4)}, ${check.longitude.toFixed(4)})`;

        this.selectLocationAndFetch({
          name: customLabel,
          latitude: check.latitude,
          longitude: check.longitude,
          entityType: 'manual',
          entityId: null,
          rawEntity: null
        });
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (this.selectedLocation) {
          this.selectLocationAndFetch(this.selectedLocation, { forceRefresh: true });
        }
      });
    }
  }

  /**
   * Actualiza la ubicación activa, consulta Open-Meteo (o caché local) y renderiza todos los paneles
   */
  async selectLocationAndFetch(locationObj, { forceRefresh = false } = {}) {
    if (!locationObj) return;

    this.selectedLocation = locationObj;
    weatherCache.saveLastLocation({
      name: locationObj.name,
      latitude: locationObj.latitude,
      longitude: locationObj.longitude,
      entityType: locationObj.entityType,
      entityId: locationObj.entityId,
      municipality: locationObj.municipality || ''
    });

    // Sincronizar campos de coordenadas en la barra superior
    const latInput = document.getElementById('climate-input-lat');
    const lonInput = document.getElementById('climate-input-lon');
    const labelInput = document.getElementById('climate-input-label');
    if (latInput) latInput.value = locationObj.latitude;
    if (lonInput) lonInput.value = locationObj.longitude;
    if (labelInput) labelInput.value = locationObj.name || '';

    const dashboardOutlet = document.getElementById('climate-dynamic-dashboard');
    const refreshBtn = document.getElementById('btn-climate-refresh');

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Consultando...</span>';
    }

    if (dashboardOutlet && !this.weatherRecord) {
      dashboardOutlet.innerHTML = `
        <div class="card mb-4">
          <div class="card-body" style="text-align: center; padding: 36px;">
            <i class="fa-solid fa-satellite-dish fa-spin" style="font-size: 1.8rem; color: var(--color-blue-700); margin-bottom: 10px;"></i>
            <p style="margin: 0;">Consultando datos meteorológicos para <strong>${escapeHtml(locationObj.name)}</strong>...</p>
          </div>
        </div>
      `;
    }

    const { record, status, error } = await weatherApi.fetchWeatherForLocation(locationObj, { forceRefresh });
    this.weatherRecord = record;
    this.connectionStatus = status;
    this.weatherError = error;

    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<span><i class="fa-solid fa-arrows-rotate"></i> Actualizar Pronóstico</span>';
    }

    if (forceRefresh && status === 'live') {
      notification.success('Pronóstico actualizado', `Datos sincronizados desde Open-Meteo para ${locationObj.name}.`);
    }

    this._renderDashboardSections();
  }

  _renderDashboardSections() {
    const dashboardOutlet = document.getElementById('climate-dynamic-dashboard');
    if (!dashboardOutlet) return;

    // Destruir gráficos previos antes de re-renderizar el DOM
    this.forecastSection.destroyCharts();
    this.precipSection.destroyCharts();

    if (!this.weatherRecord) {
      dashboardOutlet.innerHTML = renderCurrentWeatherPanel(null, 'unavailable', this.weatherError);
      return;
    }

    // Calcular indicadores agroclimáticos, alertas y comparativa de precipitaciones
    const indicators = computeAgroclimaticIndicators(this.weatherRecord);
    const alerts = generateAgroclimaticAlerts(this.weatherRecord, indicators);

    // Identificar pluviómetro seleccionado (o pluviómetro de la misma comunidad) para comparación
    let targetPluviometer = null;
    if (this.selectedLocation?.entityType === 'pluviometer' && this.selectedLocation?.rawEntity) {
      targetPluviometer = this.selectedLocation.rawEntity;
    } else if (this.selectedLocation?.rawEntity?.siteId) {
      targetPluviometer = this.pluviometers.find(p => p.siteId === this.selectedLocation.rawEntity.siteId) || null;
    }

    const precipComparison = buildPrecipitationComparison(
      this.weatherRecord,
      this.rainfallRecords,
      targetPluviometer
    );

    // Resolver nombre de comunidad si la entidad tiene siteId
    let siteName = '';
    if (this.selectedLocation?.rawEntity?.siteId) {
      const siteMatch = this.sites.find(s => s.id === this.selectedLocation.rawEntity.siteId);
      if (siteMatch) siteName = `${siteMatch.name} (${siteMatch.municipality})`;
    }

    // Última medición de disponibilidad si la entidad es una fuente hídrica
    let latestSourceMeasurement = null;
    if (this.selectedLocation?.entityType === 'water_source' && this.selectedLocation?.entityId) {
      latestSourceMeasurement = (this.waterMeasurements || []).find(m => m.sourceId === this.selectedLocation.entityId) || null;
    }

    // Cultivos vinculados si la entidad es una parcela o comunidad
    let relatedCrops = [];
    if (this.selectedLocation?.entityType === 'parcel' && this.selectedLocation?.entityId) {
      relatedCrops = (this.crops || []).filter(c => c.parcelId === this.selectedLocation.entityId);
    } else if (this.selectedLocation?.entityType === 'site' && this.selectedLocation?.entityId) {
      const parcelIdsInSite = new Set((this.parcels || []).filter(p => p.siteId === this.selectedLocation.entityId).map(p => p.id));
      relatedCrops = (this.crops || []).filter(c => parcelIdsInSite.has(c.parcelId));
    }

    dashboardOutlet.innerHTML = `
      <!-- 4.1 Panel Meteorológico Principal -->
      ${renderCurrentWeatherPanel(this.weatherRecord, this.connectionStatus, this.weatherError)}

      <!-- 5. Ficha de Integración con Pluviómetros, Fuentes Hídricas, Disponibilidad y Cultivos -->
      ${renderEntityIntegrationCard({
        selectedEntity: this.selectedLocation,
        siteName,
        precipComparison,
        indicators,
        latestSourceMeasurement,
        relatedCrops
      })}

      <!-- 6. Motor de Análisis Agroclimático y 5.3 Monitoreo de Humedad del Suelo -->
      ${renderAgroclimaticIndicators(indicators, this.soilObservations)}

      <!-- 6. Sistema de Alertas Agroclimáticas Informativas -->
      ${renderClimateAlertsPanel(alerts)}

      <!-- 4.2 Pronóstico Meteorológico (Por Horas 24h y Por Días 7d) -->
      ${this.forecastSection.render(this.weatherRecord)}

      <!-- 4.3 Análisis de Precipitaciones (Observada vs Estimada vs Pronosticada) -->
      ${this.precipSection.render(this.weatherRecord, precipComparison)}
    `;

    // Enlazar eventos e inicializar gráficos interactivos Chart.js
    this.forecastSection.bindEvents(dashboardOutlet, this.weatherRecord);
    this.precipSection.initCharts(this.weatherRecord, precipComparison);

    // Actualizar o inicializar el Mapa Climático Leaflet
    const mapOutlet = document.getElementById('climate-map-outlet');
    if (mapOutlet) {
      if (!this.mapSection.map) {
        this.mapSection.bindEvents(mapOutlet, this.selectedLocation, this.weatherRecord);
      } else {
        this.mapSection.renderMarkers(this.selectedLocation, this.weatherRecord);
        this.mapSection.map.panTo([Number(this.selectedLocation.latitude), Number(this.selectedLocation.longitude)]);
      }
    }
  }

  destroy() {
    weatherApi.cancelActiveRequests();
    this.forecastSection.destroyCharts();
    this.precipSection.destroyCharts();
    this.mapSection.destroy();

    if (this._connectivityHandler) {
      events.off('connectivity:changed', this._connectivityHandler);
      this._connectivityHandler = null;
    }
  }
}

