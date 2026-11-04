/**
 * Vista: Cartografía Territorial Ampliada (Map View — Sección 6)
 * Visualiza fuentes hídricas, reservorios, tanques, puntos de captación/almacenamiento,
 * pluviómetros, comunidades, parcelas y mediciones georreferenciadas con filtros avanzados y leyenda cartográfica.
 */

import { MapService } from '../../infrastructure/geo/map.service.js';
import { WaterAvailabilityService } from '../../application/water-availability.service.js';
import { PluviometersService } from '../../application/pluviometers.service.js';
import { SitesService } from '../../application/sites.service.js';
import { ParcelsService } from '../../application/parcels.service.js';
import { WATER_SOURCE_TYPES } from '../../domain/models/WaterSource.js';
import { WATER_AVAILABILITY_STATUSES } from '../../domain/models/WaterMeasurement.js';
import { APP_CONFIG } from '../../config/app.config.js';
import { escapeHtml } from '../../core/validators.js';
import { notification } from '../components/notification.js';

export class MapView {
  constructor(router) {
    this.router = router;
    this.mapService = null;
    this.data = {
      waterSources: [],
      pluviometers: [],
      sites: [],
      parcels: []
    };
    this.layerToggles = {
      waterSources: true,
      pluviometers: true,
      sites: true,
      parcels: true
    };
    this.filters = {
      infrastructureType: 'all',
      siteId: 'all',
      municipality: 'all',
      availabilityStatus: 'all'
    };
  }

  async render(container) {
    const [waterSources, pluviometers, sites, parcels] = await Promise.all([
      WaterAvailabilityService.getSourcesAvailabilityOverview({ onlyActive: true }),
      PluviometersService.getAll(),
      SitesService.getAll(),
      ParcelsService.getAll()
    ]);

    this.data = { waterSources, pluviometers, sites, parcels };
    const municipalities = Array.from(new Set(sites.map(s => s.municipality).filter(Boolean))).sort();

    container.innerHTML = `
      <div class="map-view-layout">
        <!-- Barra de herramientas y control de capas -->
        <div class="map-toolbar" style="flex-direction: column; align-items: stretch; gap: var(--spacing-3);">
          <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: var(--spacing-2);">
            <div class="map-layer-toggles">
              <strong>Control de Capas:</strong>
              <label>
                <input type="checkbox" id="layer-chk-sources" checked />
                <span><i class="fa-solid fa-water" style="color: #0077b6;"></i> Fuentes, Reservorios y Tanques (${waterSources.length})</span>
              </label>
              <label>
                <input type="checkbox" id="layer-chk-pluvs" checked />
                <span><i class="fa-solid fa-cloud-showers-heavy" style="color: #1b4332;"></i> Pluviómetros (${pluviometers.length})</span>
              </label>
              <label>
                <input type="checkbox" id="layer-chk-sites" checked />
                <span><i class="fa-solid fa-house-chimney" style="color: #b08968;"></i> Comunidades (${sites.length})</span>
              </label>
              <label>
                <input type="checkbox" id="layer-chk-parcels" checked />
                <span><i class="fa-solid fa-seedling" style="color: #2d6a4f;"></i> Parcelas (${parcels.length})</span>
              </label>
            </div>

            <div class="d-flex align-center gap-2">
              <button class="btn btn-outline btn-sm" id="btn-map-fit-all" title="Ajustar vista a todos los elementos filtrados">
                <span><i class="fa-solid fa-crosshairs"></i> Encuadrar Todo</span>
              </button>
              <button class="btn btn-outline btn-sm" id="btn-map-center-default" title="Centrar en Montes de María">
                <span><i class="fa-solid fa-location-dot"></i> Montes de María</span>
              </button>
            </div>
          </div>

          <!-- Filtros Territoriales y de Disponibilidad (Sección 6) -->
          <div class="d-flex align-center gap-2" style="flex-wrap: wrap; padding-top: 8px; border-top: 1px solid var(--color-neutral-200);">
            <strong style="font-size: 0.8rem;"><i class="fa-solid fa-filter"></i> Filtros:</strong>

            <select class="form-control form-select" id="map-filter-infra" style="width: auto; min-width: 185px; font-size: 0.82rem; padding: 4px 8px;">
              <option value="all">Todos los tipos de infraestructura</option>
              ${Object.entries(WATER_SOURCE_TYPES).map(([k, v]) => `
                <option value="${k}">${escapeHtml(v)}</option>
              `).join('')}
            </select>

            <select class="form-control form-select" id="map-filter-availability" style="width: auto; min-width: 180px; font-size: 0.82rem; padding: 4px 8px;">
              <option value="all">Cualquier estado de disponibilidad</option>
              ${Object.entries(WATER_AVAILABILITY_STATUSES).map(([k, v]) => `
                <option value="${k}">${escapeHtml(v)}</option>
              `).join('')}
            </select>

            <select class="form-control form-select" id="map-filter-municipality" style="width: auto; min-width: 165px; font-size: 0.82rem; padding: 4px 8px;">
              <option value="all">Todos los municipios</option>
              ${municipalities.map(m => `
                <option value="${escapeHtml(m)}">${escapeHtml(m)}</option>
              `).join('')}
            </select>

            <select class="form-control form-select" id="map-filter-site" style="width: auto; min-width: 175px; font-size: 0.82rem; padding: 4px 8px;">
              <option value="all">Todas las comunidades</option>
              ${sites.map(st => `
                <option value="${escapeHtml(st.id)}">${escapeHtml(st.name)}</option>
              `).join('')}
            </select>

            <button class="btn btn-outline btn-sm" id="btn-map-clear-filters" style="font-size: 0.78rem;">Limpiar Filtros</button>
          </div>
        </div>

        <!-- Contenedor del lienzo Leaflet -->
        <div class="map-canvas" id="territorial-main-map"></div>

        <!-- Leyenda Cartográfica (Sección 6.8) -->
        <div class="card" style="margin-top: var(--spacing-3);">
          <div class="card-body" style="padding: var(--spacing-3) var(--spacing-4); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spacing-3); font-size: 0.8rem;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px;">
              <strong><i class="fa-solid fa-map"></i> Leyenda Cartográfica:</strong>
              <span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#0077b6;margin-right:4px;"></span>Fuente Disponible / Alta</span>
              <span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#e9c46a;margin-right:4px;"></span>Disponibilidad Moderada</span>
              <span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#e07a5f;margin-right:4px;"></span>Disponibilidad Baja / Limitada</span>
              <span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#d90429;margin-right:4px;"></span>Crítica / Seca</span>
              <span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#1b4332;margin-right:4px;"></span>Pluviómetro</span>
              <span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#b08968;margin-right:4px;"></span>Comunidad</span>
              <span><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#2d6a4f;margin-right:4px;"></span>Parcela</span>
            </div>
            <div class="text-muted" id="map-filtered-count-label"></div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(container);
    this._initMap();
  }

  _initMap() {
    if (this.mapService) {
      this.mapService.destroy();
    }

    this.mapService = new MapService('territorial-main-map', {
      center: APP_CONFIG.geo.defaultCenter,
      zoom: APP_CONFIG.geo.defaultZoom,
      fitBounds: true
    });

    this.mapService.init();
    this._refreshMarkers();
  }

  _refreshMarkers() {
    if (!this.mapService) return;

    const siteMap = new Map(this.data.sites.map(s => [s.id, s]));

    // Filtrar fuentes hídricas por tipo de infraestructura, disponibilidad, comunidad y municipio
    const filteredSources = this.layerToggles.waterSources
      ? this.data.waterSources.filter(s => {
          if (this.filters.infrastructureType !== 'all' && s.type !== this.filters.infrastructureType) return false;
          if (this.filters.availabilityStatus !== 'all' && s.availabilityStatus !== this.filters.availabilityStatus) return false;
          if (this.filters.siteId !== 'all' && s.siteId !== this.filters.siteId) return false;
          if (this.filters.municipality !== 'all' && s.municipality !== this.filters.municipality) return false;
          return true;
        })
      : [];

    // Filtrar pluviómetros por comunidad y municipio
    const filteredPluvs = this.layerToggles.pluviometers
      ? this.data.pluviometers.filter(p => {
          const st = p.siteId ? siteMap.get(p.siteId) : null;
          if (this.filters.siteId !== 'all' && p.siteId !== this.filters.siteId) return false;
          if (this.filters.municipality !== 'all' && (!st || st.municipality !== this.filters.municipality)) return false;
          return true;
        })
      : [];

    // Filtrar comunidades por comunidad y municipio
    const filteredSites = this.layerToggles.sites
      ? this.data.sites.filter(st => {
          if (this.filters.siteId !== 'all' && st.id !== this.filters.siteId) return false;
          if (this.filters.municipality !== 'all' && st.municipality !== this.filters.municipality) return false;
          return true;
        })
      : [];

    // Filtrar parcelas por comunidad y municipio
    const filteredParcels = this.layerToggles.parcels
      ? this.data.parcels.filter(pr => {
          const st = pr.siteId ? siteMap.get(pr.siteId) : null;
          if (this.filters.siteId !== 'all' && pr.siteId !== this.filters.siteId) return false;
          if (this.filters.municipality !== 'all' && (!st || st.municipality !== this.filters.municipality)) return false;
          return true;
        })
      : [];

    this.mapService.updateElements({
      waterSources: filteredSources,
      pluviometers: filteredPluvs,
      sites: filteredSites,
      parcels: filteredParcels,
      onMarkerClick: (module, id, extraParams = {}) => {
        if (module === 'water-availability') {
          this.router.navigate('water-availability', { sourceId: id, ...extraParams });
        } else {
          this.router.navigate(module, { highlightId: id, openDetails: true, ...extraParams });
        }
      }
    });

    const countLabel = document.getElementById('map-filtered-count-label');
    if (countLabel) {
      const total = filteredSources.length + filteredPluvs.length + filteredSites.length + filteredParcels.length;
      countLabel.textContent = `Mostrando ${total} puntos georreferenciados en el mapa`;
    }
  }

  _bindEvents(container) {
    const chkSources = container.querySelector('#layer-chk-sources');
    const chkPluvs = container.querySelector('#layer-chk-pluvs');
    const chkSites = container.querySelector('#layer-chk-sites');
    const chkParcels = container.querySelector('#layer-chk-parcels');

    const infraSelect = container.querySelector('#map-filter-infra');
    const availSelect = container.querySelector('#map-filter-availability');
    const munSelect = container.querySelector('#map-filter-municipality');
    const siteSelect = container.querySelector('#map-filter-site');
    const clearBtn = container.querySelector('#btn-map-clear-filters');

    const fitAllBtn = container.querySelector('#btn-map-fit-all');
    const centerDefaultBtn = container.querySelector('#btn-map-center-default');

    if (chkSources) chkSources.addEventListener('change', (e) => {
      this.layerToggles.waterSources = e.target.checked;
      this._refreshMarkers();
    });

    if (chkPluvs) chkPluvs.addEventListener('change', (e) => {
      this.layerToggles.pluviometers = e.target.checked;
      this._refreshMarkers();
    });

    if (chkSites) chkSites.addEventListener('change', (e) => {
      this.layerToggles.sites = e.target.checked;
      this._refreshMarkers();
    });

    if (chkParcels) chkParcels.addEventListener('change', (e) => {
      this.layerToggles.parcels = e.target.checked;
      this._refreshMarkers();
    });

    const onFilterChange = () => {
      this.filters.infrastructureType = infraSelect ? infraSelect.value : 'all';
      this.filters.availabilityStatus = availSelect ? availSelect.value : 'all';
      this.filters.municipality = munSelect ? munSelect.value : 'all';
      this.filters.siteId = siteSelect ? siteSelect.value : 'all';
      this._refreshMarkers();
    };

    if (infraSelect) infraSelect.addEventListener('change', onFilterChange);
    if (availSelect) availSelect.addEventListener('change', onFilterChange);
    if (munSelect) munSelect.addEventListener('change', onFilterChange);
    if (siteSelect) siteSelect.addEventListener('change', onFilterChange);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.filters = { infrastructureType: 'all', siteId: 'all', municipality: 'all', availabilityStatus: 'all' };
        if (infraSelect) infraSelect.value = 'all';
        if (availSelect) availSelect.value = 'all';
        if (munSelect) munSelect.value = 'all';
        if (siteSelect) siteSelect.value = 'all';
        this._refreshMarkers();
      });
    }

    if (fitAllBtn) {
      fitAllBtn.addEventListener('click', () => {
        this._refreshMarkers();
        notification.info('Vista ajustada', 'Enfocando los puntos territoriales filtrados.');
      });
    }

    if (centerDefaultBtn) {
      centerDefaultBtn.addEventListener('click', () => {
        if (this.mapService) {
          this.mapService.setView(APP_CONFIG.geo.defaultCenter[0], APP_CONFIG.geo.defaultCenter[1], APP_CONFIG.geo.defaultZoom);
        }
      });
    }
  }

  destroy() {
    if (this.mapService) {
      this.mapService.destroy();
      this.mapService = null;
    }
  }
}
