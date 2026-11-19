/**
 * Layout Principal: Estructura general de la aplicación (AppLayout)
 */

import { Sidebar } from '../components/sidebar.js';
import { Header } from '../components/header.js';
import { JsonExportService } from '../../infrastructure/files/json-export.js';
import { BackupService } from '../../application/backup.service.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';

export class AppLayout {
  constructor(onNavigate) {
    this.onNavigate = onNavigate;
    this.isDesktopSidebarCollapsed = false;

    this.sidebar = new Sidebar(onNavigate);
    this.header = new Header({
      onToggleMenu: () => this.toggleSidebar(),
      onQuickBackup: () => this.handleQuickBackup()
    });
  }

  toggleSidebar() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const appContainer = document.querySelector('.app-container');
    const sidebarEl = document.querySelector('#app-sidebar');
    const backdropEl = document.querySelector('#sidebar-backdrop');
    const desktopLabel = document.querySelector('#btn-toggle-sidebar .menu-btn-desktop-label');

    if (isMobile) {
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
      return;
    }

    // En versión de escritorio: ocultar o mostrar el menú lateral
    this.isDesktopSidebarCollapsed = !this.isDesktopSidebarCollapsed;
    if (appContainer) {
      appContainer.classList.toggle('sidebar-collapsed', this.isDesktopSidebarCollapsed);
    }
    const toggleBtn = document.querySelector('#btn-toggle-sidebar');
    if (toggleBtn) {
      toggleBtn.classList.toggle('is-collapsed', this.isDesktopSidebarCollapsed);
      toggleBtn.title = this.isDesktopSidebarCollapsed ? 'Mostrar menú lateral' : 'Ocultar menú lateral';
      toggleBtn.setAttribute('aria-label', toggleBtn.title);
    }

    // Notificar redimensionamiento para que los mapas Leaflet y gráficos Chart.js se ajusten al nuevo espacio
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 260);
  }

  toggleMobileSidebar() {
    this.toggleSidebar();
  }

  async handleQuickBackup() {
    try {
      const storageInfo = await BackupService.getStorageInfo();
      const totalRecords = storageInfo?.counts?.totalRecords ?? 0;

      const confirmed = await modal.confirm({
        title: 'Confirmar Exportación de Copia de Seguridad',
        message: `¿Desea exportar ahora una copia de seguridad completa en formato JSON con los ${totalRecords} registros almacenados en este dispositivo?`,
        confirmText: 'Sí, Exportar Respaldo JSON',
        cancelText: 'Cancelar'
      });

      if (!confirmed) return;

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
