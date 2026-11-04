/**
 * Vista: Cartografía Territorial (Map View)
 */

import { MapService } from '../../infrastructure/geo/map.service.js';
import { WaterSourcesService } from '../../application/water-sources.service.js';
import { PluviometersService } from '../../application/pluviometers.service.js';
import { SitesService } from '../../application/sites.service.js';
import { ParcelsService } from '../../application/parcels.service.js';
import { APP_CONFIG } from '../../config/app.config.js';
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
  }

  async render(container) {
    container.innerHTML = `
      <div class="map-view-layout">
        <!-- Barra de herramientas del mapa -->
        <div class="map-toolbar">
          <div class="map-layer-toggles">
            <strong>Capas Territoriales:</strong>
            <label>
              <input type="checkbox" id="layer-chk-sources" checked />
              <span><i class="fa-solid fa-water"></i> Fuentes de Agua</span>
            </label>
            <label>
              <input type="checkbox" id="layer-chk-pluvs" checked />
              <span><i class="fa-solid fa-cloud-showers-heavy"></i> Pluviómetros</span>
            </label>
            <label>
              <input type="checkbox" id="layer-chk-sites" checked />
              <span><i class="fa-solid fa-house-user"></i> Comunidades</span>
            </label>
            <label>
              <input type="checkbox" id="layer-chk-parcels" checked />
              <span><i class="fa-solid fa-leaf"></i> Parcelas</span>
            </label>
          </div>

          <div class="d-flex align-center gap-2">
            <button class="btn btn-outline btn-sm" id="btn-map-fit-all" title="Ajustar vista a todos los elementos">
              <span><i class="fa-solid fa-crosshairs"></i> Encuadrar Todo</span>
            </button>
            <button class="btn btn-outline btn-sm" id="btn-map-center-default" title="Centrar en Montes de María">
              <span><i class="fa-solid fa-location-dot"></i> Montes de María</span>
            </button>
          </div>
        </div>

        <!-- Contenedor del lienzo Leaflet -->
        <div class="map-canvas" id="territorial-main-map"></div>
      </div>
    `;

    this._bindEvents(container);
    await this._loadAndInitMap();
  }

  async _loadAndInitMap() {
    const [waterSources, pluviometers, sites, parcels] = await Promise.all([
      WaterSourcesService.getAll({ onlyActive: true }),
      PluviometersService.getAll(),
      SitesService.getAll(),
      ParcelsService.getAll()
    ]);

    this.data = { waterSources, pluviometers, sites, parcels };

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

    this.mapService.updateElements({
      waterSources: this.layerToggles.waterSources ? this.data.waterSources : [],
      pluviometers: this.layerToggles.pluviometers ? this.data.pluviometers : [],
      sites: this.layerToggles.sites ? this.data.sites : [],
      parcels: this.layerToggles.parcels ? this.data.parcels : [],
      onMarkerClick: (module, id) => {
        this.router.navigate(module, { highlightId: id, openDetails: true });
      }
    });
  }

  _bindEvents(container) {
    const chkSources = container.querySelector('#layer-chk-sources');
    const chkPluvs = container.querySelector('#layer-chk-pluvs');
    const chkSites = container.querySelector('#layer-chk-sites');
    const chkParcels = container.querySelector('#layer-chk-parcels');

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

    if (fitAllBtn) {
      fitAllBtn.addEventListener('click', () => {
        this._refreshMarkers();
        notification.info('Vista ajustada', 'Enfocando los puntos territoriales registrados.');
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
