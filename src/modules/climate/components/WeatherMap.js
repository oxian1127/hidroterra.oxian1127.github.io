/**
 * Componente: Mapa Climático Interactivo (Leaflet + OpenStreetMap — Sección 4.4)
 * Muestra exclusivamente los puntos reales registrados en HIDROTERRA (sin inventar puntos ficticios),
 * permite filtrar por categoría y muestra en ventana emergente (Popup) las variables meteorológicas.
 */

import { APP_CONFIG } from '../../../config/app.config.js';
import { escapeHtml } from '../../../core/validators.js';
import { formatCoordinates } from '../../../domain/rules/coordinates.rules.js';
import { weatherApi } from '../services/weatherApi.js';
import { computeAgroclimaticIndicators } from '../services/weatherAnalysis.js';
import {
  getWeatherCondition,
  formatTemp,
  formatPercent,
  formatMm
} from '../utils/weatherFormatters.js';

export class WeatherMapSection {
  constructor({ onSelectLocation, onNavigateRoute }) {
    this.onSelectLocation = onSelectLocation;
    this.onNavigateRoute = onNavigateRoute;
    this.map = null;
    this.markersLayer = null;
    this.activePointMarker = null;
    this.currentFilter = 'all'; // 'all' | 'pluviometers' | 'water_sources' | 'other'
    this.points = [];
  }

  /**
   * Construye la lista unificada de puntos georreferenciados reales existentes en HIDROTERRA
   */
  buildRealPoints({ pluviometers = [], waterSources = [], sites = [], parcels = [] }) {
    const list = [];

    pluviometers.forEach(p => {
      if (p.latitude !== null && p.longitude !== null && !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude))) {
        list.push({
          id: `pluv-${p.id}`,
          entityId: p.id,
          entityType: 'pluviometer',
          categoryGroup: 'pluviometers',
          name: `${p.code} — ${p.name}`,
          subtitle: `Pluviómetro (${p.equipmentType || 'manual'})`,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          rawEntity: p
        });
      }
    });

    waterSources.forEach(s => {
      if (s.active !== false && s.latitude !== null && s.longitude !== null && !isNaN(Number(s.latitude)) && !isNaN(Number(s.longitude))) {
        list.push({
          id: `source-${s.id}`,
          entityId: s.id,
          entityType: 'water_source',
          categoryGroup: 'water_sources',
          name: `${s.code} — ${s.name}`,
          subtitle: `Fuente de Agua (${s.type || 'fuente'})`,
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
          rawEntity: s
        });
      }
    });

    sites.forEach(st => {
      if (st.latitude !== null && st.longitude !== null && !isNaN(Number(st.latitude)) && !isNaN(Number(st.longitude))) {
        list.push({
          id: `site-${st.id}`,
          entityId: st.id,
          entityType: 'site',
          categoryGroup: 'other',
          name: `${st.name} (${st.municipality || ''})`,
          subtitle: 'Comunidad / Sitio Territorial',
          latitude: Number(st.latitude),
          longitude: Number(st.longitude),
          rawEntity: st
        });
      }
    });

    parcels.forEach(pr => {
      if (pr.latitude !== null && pr.longitude !== null && !isNaN(Number(pr.latitude)) && !isNaN(Number(pr.longitude))) {
        list.push({
          id: `parcel-${pr.id}`,
          entityId: pr.id,
          entityType: 'parcel',
          categoryGroup: 'other',
          name: `${pr.code} — ${pr.name}`,
          subtitle: 'Parcela / Unidad Productiva',
          latitude: Number(pr.latitude),
          longitude: Number(pr.longitude),
          rawEntity: pr
        });
      }
    });

    this.points = list;
    return list;
  }

  render(selectedLocation) {
    const hasRegisteredPoints = this.points.length > 0;
    const pluvCount = this.points.filter(p => p.categoryGroup === 'pluviometers').length;
    const sourceCount = this.points.filter(p => p.categoryGroup === 'water_sources').length;
    const otherCount = this.points.filter(p => p.categoryGroup === 'other').length;

    return `
      <div class="card mb-4" id="climate-map-card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-map-location-dot" style="color: var(--color-green-700);"></i> Mapa Climático Territorial (OpenStreetMap)</h3>
            <p class="card-subtitle">Seleccione un punto de monitoreo registrado o haga clic sobre el mapa para consultar su pronóstico meteorológico</p>
          </div>
          <div class="d-flex align-center gap-2" style="flex-wrap: wrap;">
            <span class="badge badge-neutral" id="climate-map-selected-coords">
              <i class="fa-solid fa-crosshairs"></i>
              ${selectedLocation ? formatCoordinates(selectedLocation.latitude, selectedLocation.longitude, 4) : 'Sin punto activo'}
            </span>
          </div>
        </div>

        <!-- Barra de Filtros del Mapa Climático -->
        <div class="map-toolbar" style="border-top: none;">
          <div class="d-flex align-center gap-2" style="flex-wrap: wrap;">
            <strong style="font-size: var(--font-size-xs); margin-right: 4px;">Mostrar en mapa:</strong>
            <button type="button" class="btn btn-sm ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-outline'} btn-climate-map-filter" data-filter="all">
              Todos los puntos (${this.points.length})
            </button>
            <button type="button" class="btn btn-sm ${this.currentFilter === 'pluviometers' ? 'btn-primary' : 'btn-outline'} btn-climate-map-filter" data-filter="pluviometers">
              <i class="fa-solid fa-cloud-showers-heavy"></i> Pluviómetros (${pluvCount})
            </button>
            <button type="button" class="btn btn-sm ${this.currentFilter === 'water_sources' ? 'btn-primary' : 'btn-outline'} btn-climate-map-filter" data-filter="water_sources">
              <i class="fa-solid fa-droplet"></i> Fuentes Hídricas (${sourceCount})
            </button>
            <button type="button" class="btn btn-sm ${this.currentFilter === 'other' ? 'btn-primary' : 'btn-outline'} btn-climate-map-filter" data-filter="other">
              <i class="fa-solid fa-mountain-sun"></i> Comunidades y Parcelas (${otherCount})
            </button>
          </div>

          <button type="button" class="btn btn-outline btn-sm" id="btn-climate-map-fit">
            <i class="fa-solid fa-expand"></i> Encuadrar Puntos
          </button>
        </div>

        ${!hasRegisteredPoints ? `
          <!-- Estado vacío explicativo cuando no existen puntos georreferenciados registrados -->
          <div style="padding: var(--spacing-4); background-color: var(--color-neutral-50); border-bottom: 1px solid var(--color-neutral-200);">
            <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: var(--spacing-3);">
              <div>
                <strong style="color: var(--color-neutral-900); font-size: var(--font-size-sm);">
                  <i class="fa-solid fa-circle-info" style="color: var(--color-blue-700);"></i> Aún no existen pluviómetros ni fuentes con coordenadas registradas en el sistema
                </strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  El mapa no inventa puntos ficticios. Puede hacer clic directamente en cualquier lugar del mapa para consultar su clima o ir a registrar sus equipos territoriales.
                </p>
              </div>
              <div class="d-flex gap-2" style="flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm btn-climate-goto-module" data-route="pluviometers">
                  <i class="fa-solid fa-plus"></i> Registrar Pluviómetro
                </button>
                <button type="button" class="btn btn-outline btn-sm btn-climate-goto-module" data-route="water-sources">
                  <i class="fa-solid fa-droplet"></i> Registrar Fuente Hídrica
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="card-body" style="padding: 0;">
          <div class="climate-map-canvas" id="climate-leaflet-map"></div>
        </div>
      </div>
    `;
  }

  initMap(selectedLocation, currentWeatherRecord = null) {
    this.destroy();
    if (typeof window === 'undefined' || !window.L) return;

    const mapEl = document.getElementById('climate-leaflet-map');
    if (!mapEl) return;

    const center = selectedLocation && selectedLocation.latitude && selectedLocation.longitude
      ? [Number(selectedLocation.latitude), Number(selectedLocation.longitude)]
      : APP_CONFIG.geo.defaultCenter;

    this.map = window.L.map('climate-leaflet-map', {
      center,
      zoom: 11,
      minZoom: APP_CONFIG.geo.minZoom,
      maxZoom: APP_CONFIG.geo.maxZoom
    });

    const tileLayer = window.L.tileLayer(APP_CONFIG.geo.tileLayerUrl, {
      attribution: APP_CONFIG.geo.tileLayerAttribution,
      maxZoom: 19
    });

    tileLayer.on('tileerror', () => {
      this._showOfflineBanner(mapEl);
    });

    tileLayer.addTo(this.map);
    this.markersLayer = window.L.layerGroup().addTo(this.map);

    // Permitir elegir cualquier ubicación haciendo clic sobre el mapa
    this.map.on('click', (e) => {
      const lat = Number(e.latlng.lat.toFixed(5));
      const lon = Number(e.latlng.lng.toFixed(5));
      if (typeof this.onSelectLocation === 'function') {
        this.onSelectLocation({
          name: `Punto en Mapa (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
          latitude: lat,
          longitude: lon,
          entityType: 'map_click',
          entityId: null,
          rawEntity: null
        });
      }
    });

    this.renderMarkers(selectedLocation, currentWeatherRecord);
  }

  _showOfflineBanner(container) {
    if (!container || container.querySelector('.map-offline-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'map-offline-banner';
    banner.innerHTML = `
      <i class="fa-solid fa-satellite-dish"></i>
      <span><strong>Modo sin conexión:</strong> Teselas de OpenStreetMap no disponibles sin red; los puntos registrados y la caché meteorológica siguen operativos.</span>
    `;
    container.appendChild(banner);
  }

  _createPinIcon(entityType, isSelected = false) {
    let bg = '#0077b6';
    let iconClass = 'fa-droplet';

    if (entityType === 'pluviometer') {
      bg = '#1b4332';
      iconClass = 'fa-cloud-showers-heavy';
    } else if (entityType === 'site') {
      bg = '#936639';
      iconClass = 'fa-house-chimney';
    } else if (entityType === 'parcel') {
      bg = '#2d6a4f';
      iconClass = 'fa-seedling';
    } else if (entityType === 'map_click' || entityType === 'manual' || entityType === 'reference') {
      bg = '#6d28d9';
      iconClass = 'fa-location-crosshairs';
    }

    const borderStyle = isSelected ? 'border: 3px solid #fbbf24; transform: rotate(-45deg) scale(1.15);' : '';

    return window.L.divIcon({
      className: `custom-map-pin pin-${entityType}`,
      html: `
        <div class="map-pin-badge" style="background-color: ${bg}; ${borderStyle}">
          <span class="map-pin-icon"><i class="fa-solid ${iconClass}"></i></span>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -32]
    });
  }

  renderMarkers(selectedLocation, currentWeatherRecord = null) {
    if (!this.map || !this.markersLayer || !window.L) return;

    this.markersLayer.clearLayers();

    const filtered = this.points.filter(pt => {
      if (this.currentFilter === 'all') return true;
      return pt.categoryGroup === this.currentFilter;
    });

    const boundsPoints = [];

    filtered.forEach(pt => {
      const isSelected = Boolean(
        selectedLocation &&
        selectedLocation.entityId === pt.entityId &&
        selectedLocation.entityType === pt.entityType
      );

      const marker = window.L.marker([pt.latitude, pt.longitude], {
        icon: this._createPinIcon(pt.entityType, isSelected)
      });

      marker.bindPopup(() => this._buildLoadingPopupHtml(pt));

      marker.on('popupopen', async (e) => {
        const popupEl = e.popup.getElement();
        await this._populateMarkerWeatherPopup(pt, popupEl);
      });

      marker.addTo(this.markersLayer);
      boundsPoints.push([pt.latitude, pt.longitude]);

      if (isSelected && currentWeatherRecord) {
        setTimeout(() => {
          marker.openPopup();
        }, 150);
      }
    });

    // Si la ubicación seleccionada es manual, referencia o clic en mapa, mostrar su marcador activo
    if (
      selectedLocation &&
      ['map_click', 'manual', 'reference'].includes(selectedLocation.entityType) &&
      selectedLocation.latitude !== null &&
      selectedLocation.longitude !== null
    ) {
      const customPt = {
        name: selectedLocation.name,
        subtitle: 'Ubicación Consultada',
        latitude: Number(selectedLocation.latitude),
        longitude: Number(selectedLocation.longitude),
        entityType: selectedLocation.entityType,
        entityId: null
      };
      const activeMarker = window.L.marker([customPt.latitude, customPt.longitude], {
        icon: this._createPinIcon(customPt.entityType, true)
      });
      activeMarker.bindPopup(() => this._buildLoadingPopupHtml(customPt));
      activeMarker.on('popupopen', async (e) => {
        await this._populateMarkerWeatherPopup(customPt, e.popup.getElement());
      });
      activeMarker.addTo(this.markersLayer);
      boundsPoints.push([customPt.latitude, customPt.longitude]);
    }
  }

  _buildLoadingPopupHtml(pt) {
    return `
      <div class="map-popup-card" style="min-width: 220px;">
        <span class="popup-tag ${pt.entityType === 'pluviometer' ? 'rain' : pt.entityType === 'water_source' ? 'water' : 'site'}">
          ${escapeHtml(pt.subtitle)}
        </span>
        <h4>${escapeHtml(pt.name)}</h4>
        <p><strong>Coordenadas:</strong> ${pt.latitude.toFixed(4)}, ${pt.longitude.toFixed(4)}</p>
        <div class="popup-weather-box" style="padding: 8px; background: var(--color-neutral-50); border-radius: 6px; margin-top: 6px;">
          <span><i class="fa-solid fa-spinner fa-spin"></i> Consultando pronóstico del punto...</span>
        </div>
      </div>
    `;
  }

  async _populateMarkerWeatherPopup(pt, popupEl) {
    if (!popupEl) return;
    const weatherBox = popupEl.querySelector('.popup-weather-box');
    if (!weatherBox) return;

    const coordsBadge = document.getElementById('climate-map-selected-coords');
    if (coordsBadge) {
      coordsBadge.innerHTML = `<i class="fa-solid fa-crosshairs"></i> ${formatCoordinates(pt.latitude, pt.longitude, 4)}`;
    }

    const { record, status, error } = await weatherApi.fetchWeatherForLocation({
      name: pt.name,
      latitude: pt.latitude,
      longitude: pt.longitude,
      entityType: pt.entityType,
      entityId: pt.entityId
    });

    if (!record || !record.current) {
      weatherBox.innerHTML = `
        <div class="text-danger" style="font-size: 0.72rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(error || 'Pronóstico no disponible sin conexión.')}
        </div>
      `;
      return;
    }

    const indicators = computeAgroclimaticIndicators(record);
    const cond = getWeatherCondition(record.current.weatherCode, record.current.isDay);

    weatherBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <i class="fa-solid ${cond.icon}" style="font-size: 1.35rem; color: ${cond.color};"></i>
        <div>
          <strong style="font-size: 0.95rem;">${formatTemp(record.current.temperatureC)}</strong>
          <div style="font-size: 0.7rem; color: var(--color-neutral-600);">${escapeHtml(cond.label)}</div>
        </div>
      </div>
      <div style="font-size: 0.72rem; line-height: 1.45;">
        <div><strong>Humedad relativa:</strong> ${formatPercent(record.current.humidityPct)}</div>
        <div><strong>Prob. lluvia (24h):</strong> ${formatPercent(indicators.precipitation.maxRainProb24hPct)}</div>
        <div><strong>Precipitación est. (24h):</strong> ${formatMm(indicators.precipitation.rainNext24hMm)}</div>
        <div class="text-muted" style="margin-top: 3px; font-size: 0.65rem;">
          Origen: ${status === 'live' ? 'API Open-Meteo' : 'Caché local'}
        </div>
      </div>
      <button type="button" class="btn btn-primary btn-sm popup-action-btn btn-popup-load-full-weather" style="margin-top: 8px;">
        <i class="fa-solid fa-chart-line"></i> Cargar en Panel Principal
      </button>
    `;

    const loadBtn = weatherBox.querySelector('.btn-popup-load-full-weather');
    if (loadBtn && typeof this.onSelectLocation === 'function') {
      loadBtn.addEventListener('click', () => {
        this.onSelectLocation({
          name: pt.name,
          latitude: pt.latitude,
          longitude: pt.longitude,
          entityType: pt.entityType,
          entityId: pt.entityId,
          rawEntity: pt.rawEntity || null
        });
      });
    }
  }

  bindEvents(container, selectedLocation, currentWeatherRecord) {
    const card = container.querySelector('#climate-map-card');
    if (!card) return;

    card.querySelectorAll('.btn-climate-map-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentFilter = btn.dataset.filter || 'all';
        card.querySelectorAll('.btn-climate-map-filter').forEach(b => {
          const isActive = b.dataset.filter === this.currentFilter;
          b.className = `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'} btn-climate-map-filter`;
        });
        this.renderMarkers(selectedLocation, currentWeatherRecord);
      });
    });

    const fitBtn = card.querySelector('#btn-climate-map-fit');
    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        if (!this.map || !window.L) return;
        if (this.points.length > 0) {
          const bounds = window.L.latLngBounds(this.points.map(p => [p.latitude, p.longitude]));
          this.map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
        } else {
          this.map.setView(APP_CONFIG.geo.defaultCenter, APP_CONFIG.geo.defaultZoom);
        }
      });
    }

    card.querySelectorAll('.btn-climate-goto-module').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof this.onNavigateRoute === 'function' && btn.dataset.route) {
          this.onNavigateRoute(btn.dataset.route);
        }
      });
    });

    this.initMap(selectedLocation, currentWeatherRecord);
  }

  destroy() {
    if (this.map) {
      try {
        this.map.remove();
      } catch {
        // Ignorar
      }
      this.map = null;
      this.markersLayer = null;
    }
  }
}

