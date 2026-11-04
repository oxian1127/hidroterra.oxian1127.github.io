/**
 * Orquestador Principal de la Aplicación (App)
 */

import { AppLayout } from './ui/layouts/app-layout.js';
import { Router } from './router.js';
import { idb } from './infrastructure/database/indexeddb.js';
import { BackupService } from './application/backup.service.js';
import { events } from './core/events.js';
import { logger } from './core/logger.js';
import { APP_CONFIG } from './config/app.config.js';
import { ThemeService } from './core/theme.js';

export class App {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.layout = null;
    this.router = null;
  }

  async start() {
    logger.info(`Iniciando ${APP_CONFIG.name} v${APP_CONFIG.version}...`);

    // 0. Inicializar Tema Visual (Claro / Oscuro)
    ThemeService.init();

    // 1. Montar Layout base en el DOM
    this.layout = new AppLayout((route) => this.router.navigate(route));
    this.root.innerHTML = this.layout.render();
    this.layout.bindEvents(this.root);

    // 2. Conectar Enrutador
    const viewOutlet = this.root.querySelector('#app-view-outlet');
    this.router = new Router(viewOutlet, this.layout);

    // 3. Inicializar Base de Datos Local IndexedDB
    try {
      await idb.init();
      logger.info('Persistencia IndexedDB lista y verificada.');
    } catch (dbErr) {
      logger.error('Fallo al inicializar base de datos IndexedDB', dbErr);
    }

    // 4. Configurar escuchadores de conectividad del navegador
    this._setupConnectivityListeners();

    // 5. Configurar escuchadores globales de eventos de datos
    this._setupDataListeners();

    // 6. Registrar Service Worker para PWA Offline
    this._registerServiceWorker();

    // 7. Actualizar indicadores de almacenamiento y respaldos
    await this._refreshStorageAndBackupStatus();

    // 8. Iniciar navegación a la ruta solicitada
    this.router.init();
  }

  _setupConnectivityListeners() {
    const updateOnline = () => {
      const isOnline = navigator.onLine;
      this.layout.header.setOnlineStatus(isOnline);
      logger.info(`Estado de red: ${isOnline ? 'CONECTADO' : 'MODO SIN CONEXIÓN (OFFLINE)'}`);
      events.emit('connectivity:changed', { online: isOnline });
    };

    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();
  }

  _setupDataListeners() {
    events.on('data:changed', async () => {
      await this._refreshStorageAndBackupStatus();
    });

    events.on('data:reloaded', async () => {
      await this._refreshStorageAndBackupStatus();
      if (this.router) {
        this.router.navigate(this.router.currentRoute, {}, false);
      }
    });

    events.on('backup:completed', async () => {
      await this._refreshStorageAndBackupStatus();
    });
  }

  async _refreshStorageAndBackupStatus() {
    try {
      const info = await BackupService.getStorageInfo();
      this.layout.sidebar.setStorageSummary(`${info.counts.totalRecords} registros`);

      // Calcular advertencia de respaldo
      let showBackupWarning = false;
      let daysSince = null;

      if (info.lastBackupDate) {
        const diffMs = Date.now() - new Date(info.lastBackupDate).getTime();
        daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (daysSince >= APP_CONFIG.storage.backupWarningDays) {
          showBackupWarning = true;
        }
      } else if (info.counts.totalRecords > 0) {
        // Hay registros en la base de datos pero nunca se ha generado un respaldo
        showBackupWarning = true;
      }

      this.layout.header.setBackupWarning(showBackupWarning, daysSince);
    } catch (e) {
      console.warn('No se pudo actualizar métrica de almacenamiento:', e);
    }
  }

  _registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            logger.info('Service Worker registrado correctamente con ámbito:', reg.scope);
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    logger.info('Nueva versión de HIDROTERRA disponible en caché.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            logger.warn('Registro de Service Worker omitido o no disponible:', err.message);
          });
      });
    }
  }
}
