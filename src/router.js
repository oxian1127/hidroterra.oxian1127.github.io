/**
 * Enrutador de Navegación de Vistas (Client-Side Router) para HIDROTERRA
 */

import { DashboardView } from './ui/views/dashboard.view.js';
import { WaterSourcesView } from './ui/views/water-sources.view.js';
import { WaterAvailabilityView } from './ui/views/water-availability.view.js';
import { WaterToolsView } from './ui/views/water-tools.view.js';
import { WaterAlertsView } from './ui/views/water-alerts.view.js';
import { PluviometersView } from './ui/views/pluviometers.view.js';
import { RainfallView } from './ui/views/rainfall.view.js';
import { ClimateView } from './ui/views/climate.view.js';
import { MapView } from './ui/views/map.view.js';
import { SitesView } from './ui/views/sites.view.js';
import { ParcelsView } from './ui/views/parcels.view.js';
import { ObservationsView } from './ui/views/observations.view.js';
import { ReportsView } from './ui/views/reports.view.js';
import { SettingsView } from './ui/views/settings.view.js';
import { AboutView } from './ui/views/about.view.js';
import { MODULES_CONFIG } from './config/modules.config.js';
import { events } from './core/events.js';

export class Router {
  constructor(outletElement, layout) {
    this.outlet = outletElement;
    this.layout = layout;
    this.currentViewInstance = null;
    this.currentRoute = 'dashboard';

    this.routes = {
      'dashboard': DashboardView,
      'water-sources': WaterSourcesView,
      'water-availability': WaterAvailabilityView,
      'water-tools': WaterToolsView,
      'water-alerts': WaterAlertsView,
      'pluviometers': PluviometersView,
      'rainfall': RainfallView,
      'climate': ClimateView,
      'map': MapView,
      'sites': SitesView,
      'parcels': ParcelsView,
      'observations': ObservationsView,
      'reports': ReportsView,
      'settings': SettingsView,
      'about': AboutView
    };

    // Escuchar cambios de hash en la URL
    window.addEventListener('hashchange', () => this._handleHashChange());
  }

  init() {
    this._handleHashChange();
  }

  _handleHashChange() {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    const [route, queryString] = rawHash.split('?');
    const targetRoute = route || 'dashboard';

    const params = {};
    if (queryString) {
      const urlParams = new URLSearchParams(queryString);
      for (const [key, value] of urlParams.entries()) {
        params[key] = value === 'true' ? true : value === 'false' ? false : value;
      }
    }

    this.navigate(targetRoute, params, false);
  }

  /**
   * Navega a una ruta específica con parámetros
   */
  async navigate(routeId, params = {}, updateHash = true) {
    const TargetViewClass = this.routes[routeId] || this.routes['dashboard'];
    const resolvedRoute = this.routes[routeId] ? routeId : 'dashboard';

    if (updateHash) {
      let hash = `#${resolvedRoute}`;
      const keys = Object.keys(params);
      if (keys.length > 0) {
        const q = new URLSearchParams();
        keys.forEach(k => q.append(k, params[k]));
        hash += `?${q.toString()}`;
      }
      window.location.hash = hash;
      return;
    }

    // Destruir vista anterior si implementa destroy
    if (this.currentViewInstance && typeof this.currentViewInstance.destroy === 'function') {
      try {
        this.currentViewInstance.destroy();
      } catch (err) {
        console.warn('Error al destruir vista previa:', err);
      }
    }

    this.currentRoute = resolvedRoute;

    // Desplazar vista al inicio suavemente
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Actualizar sidebar y header
    if (this.layout) {
      this.layout.sidebar.setActiveRoute(resolvedRoute);
      const mod = MODULES_CONFIG.find(m => m.id === resolvedRoute);
      const title = mod ? mod.label : 'Monitoreo Hídrico';
      const breadcrumb = `HIDROTERRA > ${title}`;
      this.layout.header.setTitle(title, breadcrumb);
    }

    // Instanciar y renderizar nueva vista
    this.currentViewInstance = new TargetViewClass(this);
    try {
      await this.currentViewInstance.render(this.outlet, params);
      events.emit('route:changed', { route: resolvedRoute, params });
    } catch (err) {
      console.error(`Error renderizando la ruta "${resolvedRoute}":`, err);
      this.outlet.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i></div>
          <h3 class="empty-state-title">Error al cargar el módulo</h3>
          <p class="empty-state-text">${err.message}</p>
          <button class="btn btn-primary" onclick="window.location.hash='#dashboard'">Volver al Inicio</button>
        </div>
      `;
    }
  }
}
