/**
 * Componente: Menú Lateral de Navegación (Sidebar)
 */

import { MODULES_CONFIG } from '../../config/modules.config.js';
import { APP_CONFIG } from '../../config/app.config.js';

export class Sidebar {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    this.activeRoute = 'dashboard';
    this.storageSummaryText = 'IndexedDB Local';
  }

  setActiveRoute(route) {
    this.activeRoute = route;
    const items = document.querySelectorAll('.nav-item');
    items.forEach(el => {
      if (el.dataset.route === route) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  setStorageSummary(text) {
    this.storageSummaryText = text;
    const el = document.querySelector('#sidebar-storage-stat');
    if (el) el.textContent = text;
  }

  render() {
    const iconSymbols = {
      dashboard: '<i class="fa-solid fa-gauge"></i>',
      water_drop: '<i class="fa-solid fa-faucet-drip"></i>',
      water_level: '<i class="fa-solid fa-water"></i>',
      calculator: '<i class="fa-solid fa-calculator"></i>',
      alerts: '<i class="fa-solid fa-bell"></i>',
      ruler: '<i class="fa-solid fa-cloud-showers-heavy"></i>',
      rain: '<i class="fa-solid fa-cloud-rain"></i>',
      climate: '<i class="fa-solid fa-cloud-sun-rain"></i>',
      map: '<i class="fa-solid fa-map-location-dot"></i>',
      location: '<i class="fa-solid fa-mountain-sun"></i>',
      agriculture: '<i class="fa-solid fa-seedling"></i>',
      notes: '<i class="fa-solid fa-clipboard-list"></i>',
      bar_chart: '<i class="fa-solid fa-chart-column"></i>',
      settings: '<i class="fa-solid fa-gear"></i>',
      info: '<i class="fa-solid fa-circle-info"></i>'
    };

    return `
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <img src="./assets/icons/icon-192.svg" alt="HIDROTERRA" class="sidebar-logo" />
          <div class="sidebar-title-group">
            <h1>${APP_CONFIG.name}</h1>
            <p>Montes de María</p>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-title">Monitoreo Territorial</div>
          ${MODULES_CONFIG.map(mod => `
            <a class="nav-item ${this.activeRoute === mod.id ? 'active' : ''}" 
               data-route="${mod.id}" 
               title="${mod.description}">
              <span class="nav-icon">${iconSymbols[mod.icon] || '<i class="fa-solid fa-folder"></i>'}</span>
              <span>${mod.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-storage-indicator">
            <span>Almacenamiento:</span>
            <strong id="sidebar-storage-stat">${this.storageSummaryText}</strong>
          </div>
          <div>Versión PWA ${APP_CONFIG.version} (Offline-First)</div>
        </div>
      </aside>
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    `;
  }

  bindEvents(container) {
    const navItems = container.querySelectorAll('.nav-item');
    const sidebar = container.querySelector('#app-sidebar');
    const backdrop = container.querySelector('#sidebar-backdrop');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const route = item.dataset.route;
        if (route && typeof this.onNavigate === 'function') {
          this.onNavigate(route);
        }
        // Cerrar sidebar en móvil al seleccionar
        if (sidebar && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
          if (backdrop) backdrop.classList.remove('active');
        }
      });
    });

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('open');
        backdrop.classList.remove('active');
      });
    }
  }
}
