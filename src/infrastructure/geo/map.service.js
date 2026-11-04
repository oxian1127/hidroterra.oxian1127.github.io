/**
 * Servicio de Cartografía y Gestión de Mapas con Leaflet
 */

import { APP_CONFIG } from '../../config/app.config.js';
import { escapeHtml } from '../../core/validators.js';
import { logger } from '../../core/logger.js';

export class MapService {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = options;
    this.map = null;
    this.markerLayers = {
      water_sources: null,
      pluviometers: null,
      sites: null,
      parcels: null
    };
    this.tileLayer = null;
    this.isOffline = !navigator.onLine;
  }

  /**
   * Inicializa la instancia del mapa en el contenedor especificado
   */
  init() {
    if (typeof window === 'undefined' || !window.L) {
      logger.error('Leaflet no está disponible en window.L');
      this._renderFallbackContainer('La biblioteca de mapas Leaflet no se pudo cargar.');
      return null;
    }

    const container = document.getElementById(this.containerId);
    if (!container) {
      logger.warn(`Contenedor de mapa #${this.containerId} no encontrado en el DOM.`);
      return null;
    }

    // Si ya existe una instancia previa en el contenedor, destruirla limpiamente
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    const center = this.options.center || APP_CONFIG.geo.defaultCenter;
    const zoom = this.options.zoom || APP_CONFIG.geo.defaultZoom;

    try {
      this.map = window.L.map(this.containerId, {
        center,
        zoom,
        minZoom: APP_CONFIG.geo.minZoom,
        maxZoom: APP_CONFIG.geo.maxZoom,
        zoomControl: true
      });

      // Capa de teselas OpenStreetMap
      this.tileLayer = window.L.tileLayer(APP_CONFIG.geo.tileLayerUrl, {
        attribution: APP_CONFIG.geo.tileLayerAttribution,
        maxZoom: 19
      });

      this.tileLayer.on('tileerror', () => {
        this._showOfflineNotice();
      });

      this.tileLayer.addTo(this.map);

      // Grupos de capas para marcadores diferenciados
      this.markerLayers.water_sources = window.L.layerGroup().addTo(this.map);
      this.markerLayers.pluviometers = window.L.layerGroup().addTo(this.map);
      this.markerLayers.sites = window.L.layerGroup().addTo(this.map);
      this.markerLayers.parcels = window.L.layerGroup().addTo(this.map);

      // Escuchar cambios de conectividad
      window.addEventListener('offline', () => this._showOfflineNotice());
      window.addEventListener('online', () => this._hideOfflineNotice());

      return this.map;
    } catch (err) {
      logger.error('Fallo al inicializar mapa Leaflet', err);
      this._renderFallbackContainer('No se pudo inicializar el mapa territorial.');
      return null;
    }
  }

  _showOfflineNotice() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    let notice = container.querySelector('.map-offline-banner');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'map-offline-banner';
      notice.innerHTML = `
        <span class="banner-icon"><i class="fa-solid fa-satellite-dish"></i></span>
        <span class="banner-text"><strong>Modo sin conexión:</strong> El mapa satelital/callejero en línea no está disponible sin Internet. Las coordenadas y marcadores registrados continúan visualizándose con precisión en la cuadrícula local.</span>
      `;
      container.appendChild(notice);
    }
  }

  _hideOfflineNotice() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    const notice = container.querySelector('.map-offline-banner');
    if (notice) notice.remove();
  }

  _renderFallbackContainer(message) {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = `
        <div class="map-fallback-view">
          <p><i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i> ${escapeHtml(message)}</p>
          <small>Los datos georreferenciados están seguros en la base de datos local.</small>
        </div>
      `;
    }
  }

  /**
   * Crea un icono SVG personalizado de alta resolución para Leaflet diferenciando tipos de infraestructura y estado
   */
  _createIcon(type, status = '', subType = '') {
    let color = '#0077b6'; // Default azul agua
    let symbol = '<i class="fa-solid fa-droplet"></i>';
    let label = 'Fuente';

    if (type === 'pluviometer') {
      color = '#1b4332';
      symbol = '<i class="fa-solid fa-cloud-showers-heavy"></i>';
      label = 'Pluviómetro';
    } else if (type === 'site') {
      color = '#b08968';
      symbol = '<i class="fa-solid fa-house-chimney"></i>';
      label = 'Comunidad';
    } else if (type === 'parcel') {
      color = '#2d6a4f';
      symbol = '<i class="fa-solid fa-seedling"></i>';
      label = 'Parcela';
    } else if (type === 'water_source') {
      // Icono según subtipo de infraestructura hídrica
      if (subType === 'reservorio' || subType === 'jaguey') {
        symbol = '<i class="fa-solid fa-water"></i>';
        label = subType === 'jaguey' ? 'Jagüey' : 'Reservorio';
      } else if (subType === 'tanque' || subType === 'almacenamiento') {
        symbol = '<i class="fa-solid fa-database"></i>';
        label = 'Tanque / Almacenamiento';
      } else if (subType === 'captacion') {
        symbol = '<i class="fa-solid fa-cloud-showers-water"></i>';
        label = 'Punto de Captación';
      } else if (subType === 'pozo') {
        symbol = '<i class="fa-solid fa-arrow-up-from-ground-water"></i>';
        label = 'Pozo';
      }

      // Color según estado de disponibilidad hídrica o estado observado
      if (status === 'critica' || status === 'seca') color = '#d90429';
      else if (status === 'baja' || status === 'limitada') color = '#e07a5f';
      else if (status === 'moderada') color = '#e9c46a';
      else if (status === 'alta' || status === 'disponible') color = '#0077b6';
      else if (status === 'contaminada') color = '#6c757d';
      else color = '#0096c7';
    }

    return window.L.divIcon({
      className: `custom-map-pin pin-${type}`,
      html: `
        <div class="map-pin-badge" style="background-color: ${color};" title="${label}">
          <span class="map-pin-icon">${symbol}</span>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -32]
    });
  }

  /**
   * Actualiza los marcadores de todas las capas a partir de los datos recibidos
   */
  updateElements({ waterSources = [], pluviometers = [], sites = [], parcels = [], onMarkerClick = null }) {
    if (!this.map || !window.L) return;

    // Limpiar capas previas
    Object.values(this.markerLayers).forEach(layer => layer && layer.clearLayers());

    const allMarkers = [];

    // Fuentes de agua (incluyendo reservorios, tanques, captación, almacenamiento y mediciones georreferenciadas)
    waterSources.forEach(source => {
      if (source.latitude !== null && source.longitude !== null && source.active !== false) {
        const availStatus = source.availabilityStatus || source.status;
        const icon = this._createIcon('water_source', availStatus, source.type);
        const marker = window.L.marker([source.latitude, source.longitude], { icon });

        const latestMeas = source.latestMeasurement || null;
        const measCount = source.measurementsCount || 0;

        marker.bindPopup(`
          <div class="map-popup-card">
            <span class="popup-tag water">${escapeHtml(source.typeLabel || 'Fuente Hídrica')}</span>
            <h4>${escapeHtml(source.name)}</h4>
            <p><strong>Código:</strong> ${escapeHtml(source.code)}</p>
            ${source.siteName ? `<p><strong>Comunidad:</strong> ${escapeHtml(source.siteName)} ${source.municipality && source.municipality !== '—' ? `(${escapeHtml(source.municipality)})` : ''}</p>` : ''}
            <p><strong>Estado Observado:</strong> <span class="status-indicator status-${source.status}">${escapeHtml(source.status)}</span></p>
            <p><strong>Disponibilidad Hídrica:</strong> <strong>${escapeHtml(source.availabilityStatus ? source.availabilityStatus.toUpperCase() : 'SIN MEDIR')}</strong></p>
            ${latestMeas ? `
              <p><strong>Última Medición:</strong> ${latestMeas.waterLevel} ${escapeHtml(latestMeas.unit)} ${latestMeas.availableCapacityPct !== null ? `(${latestMeas.availableCapacityPct}%)` : ''}</p>
            ` : ''}
            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
              <button class="btn btn-sm btn-primary popup-action-btn" data-action="view-tech-sheet" data-id="${source.id}">
                <i class="fa-solid fa-file-lines"></i> Ficha Técnica de Disponibilidad
              </button>
              <button class="btn btn-sm btn-outline-primary popup-action-btn" data-action="view-history" data-id="${source.id}">
                <i class="fa-solid fa-chart-line"></i> Historial de Mediciones (${measCount})
              </button>
              <button class="btn btn-sm btn-outline-primary popup-action-btn" data-action="view-source" data-id="${source.id}">
                <i class="fa-solid fa-droplet"></i> Ver en Inventario de Fuentes
              </button>
            </div>
          </div>
        `);

        if (onMarkerClick) {
          marker.on('popupopen', (e) => {
            const popupEl = e.popup.getElement();
            if (!popupEl) return;
            popupEl.querySelectorAll('.popup-action-btn').forEach(btn => {
              btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'view-tech-sheet') {
                  onMarkerClick('water-availability', source.id, { openSheet: true });
                } else if (action === 'view-history') {
                  onMarkerClick('water-availability', source.id, { openSheet: false });
                } else {
                  onMarkerClick('water-sources', source.id, { openDetails: true });
                }
              });
            });
          });
        }

        marker.addTo(this.markerLayers.water_sources);
        allMarkers.push(marker);
      }
    });

    // Pluviómetros
    pluviometers.forEach(pluv => {
      if (pluv.latitude !== null && pluv.longitude !== null) {
        const icon = this._createIcon('pluviometer');
        const marker = window.L.marker([pluv.latitude, pluv.longitude], { icon });

        marker.bindPopup(`
          <div class="map-popup-card">
            <span class="popup-tag rain">Pluviómetro</span>
            <h4>${escapeHtml(pluv.name)}</h4>
            <p><strong>Código:</strong> ${escapeHtml(pluv.code)}</p>
            <p><strong>Tipo:</strong> ${escapeHtml(pluv.equipmentType)}</p>
            <p><strong>Estado:</strong> <span class="status-indicator status-${pluv.status}">${escapeHtml(pluv.status)}</span></p>
            <p><strong>Coords:</strong> ${pluv.latitude.toFixed(5)}, ${pluv.longitude.toFixed(5)}</p>
            <button class="btn btn-sm btn-outline-primary popup-action-btn" data-action="view-pluv" data-id="${pluv.id}">Ver Medición y Ficha</button>
          </div>
        `);

        if (onMarkerClick) {
          marker.on('popupopen', (e) => {
            const btn = e.popup.getElement().querySelector('.popup-action-btn');
            if (btn) btn.addEventListener('click', () => onMarkerClick('pluviometers', pluv.id));
          });
        }

        marker.addTo(this.markerLayers.pluviometers);
        allMarkers.push(marker);
      }
    });

    // Sitios y Comunidades
    sites.forEach(site => {
      if (site.latitude !== null && site.longitude !== null) {
        const icon = this._createIcon('site');
        const marker = window.L.marker([site.latitude, site.longitude], { icon });

        marker.bindPopup(`
          <div class="map-popup-card">
            <span class="popup-tag site">Comunidad</span>
            <h4>${escapeHtml(site.name)}</h4>
            <p><strong>Municipio:</strong> ${escapeHtml(site.municipality)}</p>
            <p><strong>Departamento:</strong> ${escapeHtml(site.department)}</p>
            <button class="btn btn-sm btn-outline-primary popup-action-btn" data-action="view-site" data-id="${site.id}">Ver Detalles</button>
          </div>
        `);

        if (onMarkerClick) {
          marker.on('popupopen', (e) => {
            const btn = e.popup.getElement().querySelector('.popup-action-btn');
            if (btn) btn.addEventListener('click', () => onMarkerClick('sites', site.id));
          });
        }

        marker.addTo(this.markerLayers.sites);
        allMarkers.push(marker);
      }
    });

    // Parcelas
    parcels.forEach(parcel => {
      if (parcel.latitude !== null && parcel.longitude !== null) {
        const icon = this._createIcon('parcel');
        const marker = window.L.marker([parcel.latitude, parcel.longitude], { icon });

        marker.bindPopup(`
          <div class="map-popup-card">
            <span class="popup-tag parcel">Parcela</span>
            <h4>${escapeHtml(parcel.name)}</h4>
            <p><strong>Código:</strong> ${escapeHtml(parcel.code)}</p>
            <p><strong>Responsable:</strong> ${escapeHtml(parcel.responsible || '—')}</p>
            <button class="btn btn-sm btn-outline-primary popup-action-btn" data-action="view-parcel" data-id="${parcel.id}">Ver Parcela</button>
          </div>
        `);

        if (onMarkerClick) {
          marker.on('popupopen', (e) => {
            const btn = e.popup.getElement().querySelector('.popup-action-btn');
            if (btn) btn.addEventListener('click', () => onMarkerClick('parcels', parcel.id));
          });
        }

        marker.addTo(this.markerLayers.parcels);
        allMarkers.push(marker);
      }
    });

    // Ajustar vista para contener todos los marcadores si existen al menos 1
    if (allMarkers.length > 0 && this.options.fitBounds !== false) {
      const group = window.L.featureGroup(allMarkers);
      this.map.fitBounds(group.getBounds().pad(0.12));
    }
  }

  /**
   * Centra el mapa en una coordenada específica
   */
  setView(lat, lon, zoom = 14) {
    if (this.map && lat !== null && lon !== null) {
      this.map.setView([lat, lon], zoom);
    }
  }

  /**
   * Destruye la instancia del mapa y limpia listeners
   */
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
