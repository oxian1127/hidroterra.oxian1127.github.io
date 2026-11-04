/**
 * Layout Principal: Estructura general de la aplicación (AppLayout)
 */

import { Sidebar } from '../components/sidebar.js';
import { Header } from '../components/header.js';
import { JsonExportService } from '../../infrastructure/files/json-export.js';
import { notification } from '../components/notification.js';

export class AppLayout {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;

    this.sidebar = new Sidebar(onNavigate);
    this.header = new Header({
      onToggleMenu: () => this.toggleMobileSidebar(),
      onQuickBackup: () => this.handleQuickBackup()
    });
  }

  toggleMobileSidebar() {
    const sidebarEl = document.querySelector('#app-sidebar');
    const backdropEl = document.querySelector('#sidebar-backdrop');
    if (sidebarEl && backdropEl) {
      const isOpen = sidebarEl.classList.contains('open');
      if (isOpen) {
        sidebarEl.classList.remove('open');
        backdropEl.classList.remove('active');
      } else {
        sidebarEl.classList.add('open');
        backdropEl.classList.add('active');
      }
    }
  }

  async handleQuickBackup() {
    try {
      const result = await JsonExportService.exportFullBackup();
      notification.success(
        'Respaldo Exportado',
        `Se ha descargado "${result.filename}" con éxito.`
      );
      this.header.setBackupWarning(false);
    } catch (err) {
      notification.error('Error al exportar', err.message);
    }
  }

  render() {
    return `
      <div class="app-container">
        ${this.sidebar.render()}
        <main class="app-main">
          ${this.header.render()}
          <section class="app-content" id="app-view-outlet" role="main">
            <!-- Las vistas se inyectan dinámicamente aquí -->
          </section>
        </main>
      </div>
      <div class="toast-container"></div>
      <div class="modal-overlay" role="dialog" aria-modal="true"></div>
    `;
  }

  bindEvents(rootElement) {
    this.sidebar.bindEvents(rootElement);
    this.header.bindEvents(rootElement);
  }
}
