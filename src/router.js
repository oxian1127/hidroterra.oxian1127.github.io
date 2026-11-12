/**
 * Enrutador de Navegación de Vistas (Client-Side Router) para HIDROTERRA
 * Incluye control de sesión demostrativo, acceso público al Directorio de Organizaciones
 * y adaptación visual de acciones según el rol del usuario.
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
import { LoginView } from './ui/views/login.view.js';
import { DirectoryView } from './ui/views/directory.view.js';
import { SuperAdminView } from './ui/views/superadmin.view.js';
import { AuditView } from './ui/views/audit.view.js';
import { MODULES_CONFIG } from './config/modules.config.js';
import { events } from './core/events.js';
import { sessionService, ROLES, ROLE_LABELS } from './core/session.service.js';
import { notification } from './ui/components/notification.js';
import { escapeHtml } from './core/validators.js';

export class Router {
  constructor(outletElement, layout) {
    this.outlet = outletElement;
    this.layout = layout;
    this.currentViewInstance = null;
    this.currentRoute = 'dashboard';

    this.routes = {
      'login': LoginView,
      'directory': DirectoryView,
      'superadmin': SuperAdminView,
      'audit': AuditView,
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
    const targetRoute = route || (sessionService.isAuthenticated() ? 'dashboard' : 'login');

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
    let resolvedRoute = this.routes[routeId] ? routeId : 'dashboard';
    const isPublicRoute = resolvedRoute === 'login' || resolvedRoute === 'directory';

    // Control de acceso demostrativo por sesión
    if (!sessionService.isAuthenticated() && !isPublicRoute) {
      resolvedRoute = 'login';
      updateHash = true;
    } else if (sessionService.isAuthenticated() && resolvedRoute === 'login') {
      resolvedRoute = 'dashboard';
      updateHash = true;
    } else if (resolvedRoute === 'superadmin' && !sessionService.isSuperAdmin()) {
      notification.warning('Acceso restringido', 'El Panel Superadministrador requiere el rol SUPERADMINISTRADOR.');
      resolvedRoute = 'dashboard';
      updateHash = true;
    }

    const TargetViewClass = this.routes[resolvedRoute] || this.routes['dashboard'];

    if (updateHash) {
      let hash = `#${resolvedRoute}`;
      const keys = Object.keys(params);
      if (keys.length > 0) {
        const q = new URLSearchParams();
        keys.forEach(k => q.append(k, params[k]));
        hash += `?${q.toString()}`;
      }
      if (window.location.hash !== hash) {
        window.location.hash = hash;
        return;
      }
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
      const org = sessionService.getCurrentOrganization();
      const breadcrumb = org
        ? `HIDROTERRA · ${org.shortName || org.name || org.nombre} > ${title}`
        : `HIDROTERRA > ${title}`;
      this.layout.header.setTitle(title, breadcrumb);
    }

    // Instanciar y renderizar nueva vista
    this.currentViewInstance = new TargetViewClass(this);
    try {
      await this.currentViewInstance.render(this.outlet, params);
      this._applyRolePermissionsToView(this.outlet, resolvedRoute);
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

  /**
   * Adapta visualmente los botones de creación, edición y eliminación según el rol activo
   */
  _applyRolePermissionsToView(container, routeId) {
    if (!container || !sessionService.isAuthenticated()) return;
    if (['login', 'directory', 'settings', 'about', 'superadmin'].includes(routeId)) return;

    const role = sessionService.getUserRole();
    const org = sessionService.getCurrentOrganization();
    const isSuper = sessionService.isSuperAdmin();

    // Mostrar indicador de contexto organizacional en módulos operativos
    if (!container.querySelector('.org-context-banner') && routeId !== 'audit') {
      const banner = document.createElement('div');
      banner.className = 'org-context-banner';
      banner.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding:0.55rem 0.9rem; margin-bottom:1rem; border-radius:var(--radius-md); background:var(--color-surface); border:1px solid var(--color-border); font-size:0.83rem;';
      banner.innerHTML = `
        <div>
          <strong>Organización activa:</strong> ${escapeHtml(org?.name || org?.nombre || 'Global')}
          ${isSuper ? '<span class="badge badge-info" style="margin-left:0.4rem;">Vista Global Superadministrador</span>' : ''}
        </div>
        <div>
          <span class="badge badge-neutral">Rol: ${escapeHtml(ROLE_LABELS[role] || role)}</span>
          ${role === ROLES.CONSULTA ? '<span class="badge badge-warning" style="margin-left:0.35rem;">Solo lectura</span>' : ''}
        </div>
      `;
      container.prepend(banner);
    }

    if (role === ROLES.CONSULTA) {
      // Ocultar botones de creación, edición y eliminación para rol CONSULTA
      const writeButtons = container.querySelectorAll(
        '[id^="btn-new-"], [id^="btn-add-"], #btn-quick-rain, #btn-quick-meas, #btn-quick-obs, #btn-load-sample-dashboard, ' +
        '[data-edit], [data-delete], [data-edit-source], [data-delete-source], [data-edit-meas], [data-delete-meas], ' +
        '[data-edit-pluv], [data-delete-pluv], [data-edit-rain], [data-delete-rain], [data-edit-site], [data-delete-site], ' +
        '[data-edit-parcel], [data-delete-parcel], [data-edit-crop], [data-delete-crop], [data-edit-obs], [data-delete-obs], ' +
        '[data-resolve-alert], [data-delete-alert], #btn-eval-alerts'
      );
      writeButtons.forEach(btn => {
        btn.style.display = 'none';
      });
    } else if (role === ROLES.EDITOR) {
      // Ocultar botones de eliminación para rol EDITOR
      const deleteButtons = container.querySelectorAll(
        '[data-delete], [data-delete-source], [data-delete-meas], [data-delete-pluv], ' +
        '[data-delete-rain], [data-delete-site], [data-delete-parcel], [data-delete-crop], [data-delete-obs], [data-delete-alert]'
      );
      deleteButtons.forEach(btn => {
        btn.style.display = 'none';
      });
    }
  }
}
