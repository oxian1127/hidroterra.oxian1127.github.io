/**
 * Vista: Respaldo, Datos Locales y Configuración (Settings View)
 */

import { BackupService } from '../../application/backup.service.js';
import { FutureSyncService } from '../../application/future-sync.service.js';
import { APP_CONFIG } from '../../config/app.config.js';
import { DB_CONFIG } from '../../config/database.config.js';
import { formatDateTime } from '../../core/date-utils.js';
import { modal } from '../components/modal.js';
import { notification } from '../components/notification.js';
import { SAMPLE_MONTES_DE_MARIA } from '../../../data/examples/sample-data.js';
import { ThemeService } from '../../core/theme.js';
import { events } from '../../core/events.js';

export class SettingsView {
  constructor(router) {
    this.router = router;
  }

  async render(container) {
    container.innerHTML = `
      <div class="settings-loading" style="padding: 40px; text-align: center;">
        <p><i class="fa-solid fa-spinner fa-spin"></i> Consultando configuración y estado del almacenamiento local...</p>
      </div>
    `;

    const storageInfo = await BackupService.getStorageInfo();
    const syncStatus = FutureSyncService.getStatus();
    const isDark = ThemeService.isDark();
    const isOverflowTooltipOn = ThemeService.isOverflowTooltipEnabled();

    container.innerHTML = `
      <div class="settings-view">
        <div class="view-header mb-4">
          <h2>Configuración del Sistema y Gestión de Datos</h2>
          <p class="text-muted">Personalización visual, administración de la persistencia local IndexedDB, respaldos JSON y arquitectura territorial.</p>
        </div>

        <!-- Módulo de Configuración de Apariencia y Visualización -->
        <div class="card mb-4" id="card-theme-settings">
          <div class="card-header">
            <div>
              <h3 class="card-title">Apariencia y Opciones de Visualización</h3>
              <p class="card-subtitle">Personalice el tema de la interfaz y el comportamiento de lectura de textos recortados</p>
            </div>
            <span class="badge ${isDark ? 'badge-info' : 'badge-success'}" id="settings-theme-badge">
              ${isDark ? 'Modo Oscuro' : 'Modo Claro'}
            </span>
          </div>
          <div class="card-body">
            <!-- Opción 1: Modo Oscuro -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-4);">
              <div style="max-width: 600px;">
                <h4 style="margin-bottom: 6px; font-size: var(--font-size-base);">Modo Oscuro (Dark Mode)</h4>
                <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: 0; line-height: 1.5;">
                  Reduce la emisión de luz y el cansancio visual durante jornadas prolongadas en campo, ahorra batería en pantallas OLED de teléfonos móviles y tabletas, y optimiza el contraste de mapas y gráficas.
                </p>
              </div>

              <div class="theme-switch-wrapper">
                <label class="theme-switch" for="settings-theme-toggle" title="Activar o desactivar modo oscuro">
                  <input type="checkbox" id="settings-theme-toggle" ${isDark ? 'checked' : ''} />
                  <span class="theme-slider">
                    <span class="theme-slider-thumb"></span>
                  </span>
                </label>
                <span id="settings-theme-status-text" style="font-weight: 600; font-size: var(--font-size-sm); color: var(--color-neutral-800);">
                  ${isDark ? 'Modo Oscuro Activado' : 'Modo Claro Activado'}
                </span>
              </div>
            </div>

            <!-- Opción 2: Mostrar texto completo de botones y textos recortados -->
            <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--color-neutral-200); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-4);">
              <div style="max-width: 600px;">
                <h4 style="margin-bottom: 6px; font-size: var(--font-size-base);">Mostrar Texto Completo de Botones y Textos Recortados (...)</h4>
                <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: 0; line-height: 1.5;">
                  Actívelo si desea ver un globo emergente con el texto completo al pasar el cursor (PC) o al presionar (móvil) sobre botones, listas desplegables o cajas cuyos textos no caben en pantalla. Por defecto permanece desactivado para no resultar molesto durante la navegación.
                </p>
              </div>

              <div class="theme-switch-wrapper">
                <label class="theme-switch" for="settings-overflow-tooltip-toggle">
                  <input type="checkbox" id="settings-overflow-tooltip-toggle" ${isOverflowTooltipOn ? 'checked' : ''} />
                  <span class="theme-slider">
                    <span class="theme-slider-thumb"></span>
                  </span>
                </label>
                <span id="settings-overflow-tooltip-status" style="font-weight: 600; font-size: var(--font-size-sm); color: var(--color-neutral-800);">
                  ${isOverflowTooltipOn ? 'Activado' : 'Desactivado'}
                </span>
              </div>
            </div>

            <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--color-neutral-200); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-3); font-size: var(--font-size-xs); color: var(--color-neutral-500);">
              <div>
                <strong>Tipografía Activa:</strong> Open Sans (Cargada localmente para funcionamiento 100% offline).
              </div>
              <div>
                También puede alternar el tema rápidamente desde el botón en el encabezado superior.
              </div>
            </div>
          </div>
        </div>

        <!-- Tarjetas de Estado del Almacenamiento Local -->
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <h3 class="card-title">Estado de la Base de Datos Local (IndexedDB)</h3>
              <p class="card-subtitle">Almacén: <code>${DB_CONFIG.name}</code> (v${DB_CONFIG.version}) — Sin dependencia de servidores externos</p>
            </div>
            <span class="badge badge-success"><i class="fa-solid fa-check"></i> Persistencia Activa</span>
          </div>
          <div class="card-body">
            <div class="dashboard-metrics-grid mb-4" style="margin-bottom: var(--spacing-4);">
              <div class="metric-card">
                <div class="metric-icon-box water"><i class="fa-solid fa-faucet-drip"></i></div>
                <div class="metric-info">
                  <span class="metric-value">${storageInfo.counts.sourcesCount}</span>
                  <span class="metric-label">Fuentes de Agua</span>
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-icon-box water"><i class="fa-solid fa-water"></i></div>
                <div class="metric-info">
                  <span class="metric-value">${storageInfo.counts.waterMeasurementsCount || 0}</span>
                  <span class="metric-label">Mediciones Hídricas</span>
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-icon-box pluv"><i class="fa-solid fa-cloud-showers-heavy"></i></div>
                <div class="metric-info">
                  <span class="metric-value">${storageInfo.counts.pluviometersCount}</span>
                  <span class="metric-label">Pluviómetros</span>
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-icon-box rain"><i class="fa-solid fa-chart-simple"></i></div>
                <div class="metric-info">
                  <span class="metric-value">${storageInfo.counts.rainfallCount}</span>
                  <span class="metric-label">Mediciones de Lluvia</span>
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-icon-box site"><i class="fa-solid fa-mountain-sun"></i></div>
                <div class="metric-info">
                  <span class="metric-value">${storageInfo.counts.sitesCount}</span>
                  <span class="metric-label">Comunidades</span>
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-icon-box agro"><i class="fa-solid fa-seedling"></i></div>
                <div class="metric-info">
                  <span class="metric-value">${storageInfo.counts.parcelsCount} / ${storageInfo.counts.cropsCount}</span>
                  <span class="metric-label">Parcelas / Cultivos</span>
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-icon-box water"><i class="fa-solid fa-clipboard-list"></i></div>
                <div class="metric-info">
                  <span class="metric-value">${storageInfo.counts.observationsCount}</span>
                  <span class="metric-label">Observaciones</span>
                </div>
              </div>

              <div class="metric-card">
                <div class="metric-icon-box pluv"><i class="fa-solid fa-bell"></i></div>
                <div class="metric-info">
                  <span class="metric-value">${storageInfo.counts.waterAlertsCount || 0}</span>
                  <span class="metric-label">Alertas Hídricas</span>
                </div>
              </div>
            </div>

            <div style="background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); padding: var(--spacing-4); border-radius: var(--radius-md); font-size: var(--font-size-sm);">
              <p><strong>Total de Registros Locales:</strong> ${storageInfo.counts.totalRecords} elementos</p>
              ${storageInfo.quotaEstimate ? `
                <p><strong>Uso estimado en disco:</strong> ${storageInfo.quotaEstimate.usageMb} MB de ${storageInfo.quotaEstimate.quotaMb} MB disponibles por el navegador.</p>
              ` : `
                <p><strong>Uso de almacenamiento:</strong> Almacenamiento local ilimitado disponible en el perfil del navegador.</p>
              `}
              <p><strong>Último respaldo exportado:</strong> ${storageInfo.lastBackupDate ? formatDateTime(storageInfo.lastBackupDate) : '<span class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Nunca se ha exportado un respaldo desde este navegador.</span>'}</p>
            </div>
          </div>
        </div>

        <!-- Opciones de Respaldo y Restauración JSON -->
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <h3 class="card-title">Copias de Seguridad (Archivos JSON)</h3>
              <p class="card-subtitle">Exporte periódicamente sus datos para salvaguardarlos frente a borrados de caché o cambio de dispositivo</p>
            </div>
          </div>
          <div class="card-body">
            <div class="form-grid-2">
              <!-- Exportar -->
              <div style="background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-5);">
                <h4><i class="fa-solid fa-floppy-disk" style="color: var(--color-green-600);"></i> Exportar Respaldo Completo</h4>
                <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: var(--spacing-2) 0 var(--spacing-4);">
                  Genera un archivo <code>hidroterra-respaldo-AAAA-MM-DD.json</code> con la totalidad de fuentes, mediciones hídricas, pluviómetros, lluvias, alertas y notas del territorio.
                </p>
                <button class="btn btn-primary" id="btn-settings-export-json">
                  <span>Descargar Respaldo JSON</span>
                </button>
              </div>

              <!-- Importar -->
              <div style="background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-5);">
                <h4><i class="fa-solid fa-folder-open" style="color: var(--color-blue-600);"></i> Importar / Restaurar Respaldo</h4>
                <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin: var(--spacing-2) 0 var(--spacing-4);">
                  Seleccione un archivo JSON previamente exportado. Podrá revisar una vista previa antes de fusionar o restaurar la información.
                </p>
                <input type="file" id="input-import-json-file" accept=".json,application/json" style="display: none;" />
                <button class="btn btn-outline" id="btn-settings-trigger-import">
                  <span>Seleccionar Archivo JSON...</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Muestra de Datos de Prueba para Montes de María -->
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <h3 class="card-title">Datos de Prueba de Montes de María (Opcional)</h3>
              <p class="card-subtitle">Conjunto de muestra realista para verificar el funcionamiento del sistema en capacitaciones y pruebas técnicas</p>
            </div>
          </div>
          <div class="card-body">
            <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin-bottom: var(--spacing-4);">
              Permite cargar un conjunto de comunidades reales de Montes de María (El Carmen de Bolívar, San Jacinto, San Juan Nepomuceno, Ovejas, Chalán), fuentes hídricas de muestra, pluviómetros y mediciones de lluvia.
            </p>
            <button class="btn btn-outline" id="btn-load-sample-dataset">
              <span>Cargar Datos de Prueba de Montes de María</span>
            </button>
          </div>
        </div>

        <!-- Arquitectura y Futura Nube (Fase 2) -->
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <h3 class="card-title">Arquitectura Futura: Integración Nube (Fase 2)</h3>
              <p class="card-subtitle">Estructura preparada para sincronización remota sin rehacer los módulos</p>
            </div>
            <span class="badge badge-info"><i class="fa-solid fa-cloud"></i> Fase 1: Local-First</span>
          </div>
          <div class="card-body">
            <div style="background-color: var(--color-blue-100); border-left: 4px solid var(--color-blue-600); padding: var(--spacing-4); border-radius: var(--radius-sm); margin-bottom: var(--spacing-4); font-size: var(--font-size-sm); color: var(--color-neutral-800);">
              <strong>Estado de sincronización en la nube:</strong>
              <p style="margin: 4px 0 0;">${syncStatus.message}</p>
            </div>

            <div style="font-size: var(--font-size-sm); color: var(--color-neutral-700);">
              <p><strong>Puntos de extensión implementados en el software:</strong></p>
              <ul style="list-style: disc; margin-left: 20px; margin-top: 6px; line-height: 1.6;">
                <li><strong>Capa de Repositorios desacoplada:</strong> Las vistas y servicios consumen una interfaz abstracta que en Fase 2 apuntará a una API REST remota sin tocar los componentes de interfaz.</li>
                <li><strong>Identificadores universales estables (UUID v4):</strong> Todos los registros utilizan IDs UUID y fechas ISO 8601 que garantizan trazabilidad y resolución determinista de conflictos en sincronización multipunto.</li>
                <li><strong>Adaptador de sincronización:</strong> Definido en <code>src/infrastructure/sync/sync-adapter.js</code> con contratos para <code>pushBatch</code>, <code>pullBatch</code> y resolución por marca temporal.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Zona de Peligro: Reinicio de Base de Datos -->
        <div class="card card-danger">
          <div class="card-header">
            <div>
              <h3 class="card-title text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Zona de Mantenimiento Local</h3>
              <p class="card-subtitle">Acciones destructivas que modifican el almacenamiento permanente de este navegador</p>
            </div>
          </div>
          <div class="card-body">
            <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); margin-bottom: var(--spacing-4);">
              Si necesita reiniciar el sistema para una nueva temporada o prueba desde cero, puede vaciar todos los registros locales de IndexedDB. Asegúrese de haber exportado un respaldo antes.
            </p>
            <button class="btn btn-danger" id="btn-clear-database-all">
              <span>Vaciar Todos los Registros Locales</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(container);
  }

  _bindEvents(container) {
    const themeToggle = container.querySelector('#settings-theme-toggle');
    const themeStatusText = container.querySelector('#settings-theme-status-text');
    const themeBadge = container.querySelector('#settings-theme-badge');
    const overflowTooltipToggle = container.querySelector('#settings-overflow-tooltip-toggle');
    const overflowTooltipStatus = container.querySelector('#settings-overflow-tooltip-status');

    if (themeToggle) {
      themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        ThemeService.setTheme(newTheme);
      });
    }

    if (overflowTooltipToggle) {
      overflowTooltipToggle.addEventListener('change', () => {
        const enabled = ThemeService.setOverflowTooltipEnabled(overflowTooltipToggle.checked);
        if (overflowTooltipStatus) {
          overflowTooltipStatus.textContent = enabled ? 'Activado' : 'Desactivado';
        }
        notification.info(
          enabled ? 'Lectura de textos completos activada' : 'Lectura de textos completos desactivada',
          enabled
            ? 'Ahora se mostrará el texto completo al pasar el cursor o presionar elementos con puntos suspensivos (...).'
            : 'No se mostrarán mensajes emergentes al pasar sobre botones o textos recortados.'
        );
      });
    }

    // Escuchar cambios de tema (incluso si se activa desde el header)
    this._themeListener = ({ isDark }) => {
      if (themeToggle) themeToggle.checked = isDark;
      if (themeStatusText) {
        themeStatusText.textContent = isDark ? 'Modo Oscuro Activado' : 'Modo Claro Activado';
      }
      if (themeBadge) {
        themeBadge.className = `badge ${isDark ? 'badge-info' : 'badge-success'}`;
        themeBadge.textContent = isDark ? 'Modo Oscuro' : 'Modo Claro';
      }
    };
    events.on('theme:changed', this._themeListener);

    const exportBtn = container.querySelector('#btn-settings-export-json');
    const importBtn = container.querySelector('#btn-settings-trigger-import');
    const fileInput = container.querySelector('#input-import-json-file');
    const loadSampleBtn = container.querySelector('#btn-load-sample-dataset');
    const clearDbBtn = container.querySelector('#btn-clear-database-all');

    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          const currentInfo = await BackupService.getStorageInfo();
          const totalRecords = currentInfo?.counts?.totalRecords ?? 0;

          const confirmed = await modal.confirm({
            title: 'Confirmar Exportación de Copia de Seguridad',
            message: `¿Desea generar y descargar el archivo de respaldo JSON completo con los ${totalRecords} registros locales del sistema?`,
            confirmText: 'Sí, Descargar Respaldo JSON',
            cancelText: 'Cancelar'
          });

          if (!confirmed) return;

          const res = await BackupService.exportBackup();
          notification.success('Respaldo generado', `Descargado "${res.filename}" con éxito.`);
          this.render(container);
        } catch (err) {
          notification.error('Fallo al exportar', err.message);
        }
      });
    }

    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const analysis = await BackupService.analyzeFile(file);
          this._openImportModal(analysis, container);
        } catch (err) {
          notification.error('Archivo no válido', err.message);
        } finally {
          fileInput.value = '';
        }
      });
    }

    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', async () => {
        const confirmed = await modal.confirm({
          title: 'Cargar Datos de Prueba de Montes de María',
          message: '¿Desea incorporar los datos de ejemplo del territorio (comunidades de Carmen de Bolívar, San Jacinto, pluviómetros y lluvias de muestra)? Los registros existentes se conservarán mediante combinación.',
          confirmText: 'Cargar Datos de Muestra'
        });

        if (confirmed) {
          loadSampleBtn.disabled = true;
          loadSampleBtn.innerHTML = '<span>Cargando datos de muestra...</span>';

          try {
            let sampleData = null;
            if (typeof SAMPLE_MONTES_DE_MARIA !== 'undefined' && SAMPLE_MONTES_DE_MARIA.data) {
              sampleData = SAMPLE_MONTES_DE_MARIA.data;
            } else {
              const resp = await fetch('./data/examples/muestra-montes-de-maria.json');
              if (!resp.ok) throw new Error('No se pudo leer el archivo de muestra local.');
              const samplePayload = await resp.json();
              sampleData = samplePayload.data;
            }

            await BackupService.executeImport(sampleData, 'merge');
            notification.success('Datos de muestra cargados', 'Se han incorporado con éxito los registros territoriales de Montes de María.');
            await this.render(container);
          } catch (err) {
            notification.error('Error al cargar muestra', err.message);
            loadSampleBtn.disabled = false;
            loadSampleBtn.innerHTML = '<span>Cargar Datos de Prueba de Montes de María</span>';
          }
        }
      });
    }

    if (clearDbBtn) {
      clearDbBtn.addEventListener('click', async () => {
        const confirmed = await modal.confirm({
          title: '¡ADVERTENCIA: Vaciar Base de Datos Local!',
          message: 'Esta operación borrará PERMANENTEMENTE todas las fuentes de agua, pluviómetros, mediciones de lluvia y notas del dispositivo. ¿Está absolutamente seguro de proceder?',
          confirmText: 'Sí, Vaciar Base de Datos',
          isDanger: true
        });

        if (confirmed) {
          await BackupService.clearAll();
          notification.warning('Base de datos vaciada', 'Todos los registros locales fueron eliminados.');
          this.render(container);
        }
      });
    }
  }

  destroy() {
    if (this._themeListener) {
      events.off('theme:changed', this._themeListener);
      this._themeListener = null;
    }
  }

  _openImportModal(analysis, mainContainer) {
    const { metadata, diff, data } = analysis;

    const contentHtml = `
      <div class="import-preview-box">
        <p><strong>Archivo de Respaldo:</strong> ${metadata.appName || 'HIDROTERRA'} (v${metadata.version || '2.0.0'})</p>
        <p><strong>Fecha del Respaldo:</strong> ${formatDateTime(metadata.exportedAt)}</p>

        <h4 style="margin: var(--spacing-4) 0 var(--spacing-2);">Resumen Previo de Contenido (Dry-Run):</h4>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Entidad</th>
                <th>En Archivo</th>
                <th>Nuevos</th>
                <th>A Actualizar</th>
                <th>Actuales en Disco</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Fuentes de Agua</td><td>${diff.water_sources.incomingTotal}</td><td><strong>+${diff.water_sources.newCount}</strong></td><td>${diff.water_sources.updateCount}</td><td>${diff.water_sources.currentTotal}</td></tr>
              <tr><td>Mediciones Hídricas</td><td>${diff.water_measurements?.incomingTotal || 0}</td><td><strong>+${diff.water_measurements?.newCount || 0}</strong></td><td>${diff.water_measurements?.updateCount || 0}</td><td>${diff.water_measurements?.currentTotal || 0}</td></tr>
              <tr><td>Alertas Hídricas</td><td>${diff.water_alerts?.incomingTotal || 0}</td><td><strong>+${diff.water_alerts?.newCount || 0}</strong></td><td>${diff.water_alerts?.updateCount || 0}</td><td>${diff.water_alerts?.currentTotal || 0}</td></tr>
              <tr><td>Pluviómetros</td><td>${diff.pluviometers.incomingTotal}</td><td><strong>+${diff.pluviometers.newCount}</strong></td><td>${diff.pluviometers.updateCount}</td><td>${diff.pluviometers.currentTotal}</td></tr>
              <tr><td>Mediciones de Lluvia</td><td>${diff.rainfall_records.incomingTotal}</td><td><strong>+${diff.rainfall_records.newCount}</strong></td><td>${diff.rainfall_records.updateCount}</td><td>${diff.rainfall_records.currentTotal}</td></tr>
              <tr><td>Sitios y Comunidades</td><td>${diff.sites.incomingTotal}</td><td><strong>+${diff.sites.newCount}</strong></td><td>${diff.sites.updateCount}</td><td>${diff.sites.currentTotal}</td></tr>
              <tr><td>Parcelas y Cultivos</td><td>${diff.parcels.incomingTotal + diff.crops.incomingTotal}</td><td><strong>+${diff.parcels.newCount + diff.crops.newCount}</strong></td><td>${diff.parcels.updateCount + diff.crops.updateCount}</td><td>${diff.parcels.currentTotal + diff.crops.currentTotal}</td></tr>
              <tr><td>Observaciones Hídricas</td><td>${diff.observations.incomingTotal}</td><td><strong>+${diff.observations.newCount}</strong></td><td>${diff.observations.updateCount}</td><td>${diff.observations.currentTotal}</td></tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: var(--spacing-4);">
          <label class="form-label"><strong>Seleccione la Estrategia de Incorporación:</strong></label>
          <div style="display: flex; flex-direction: column; gap: var(--spacing-2); font-size: var(--font-size-sm);">
            <label style="display: flex; align-items: flex-start; gap: var(--spacing-2); cursor: pointer;">
              <input type="radio" name="import-strat" value="merge" checked style="margin-top: 3px;" />
              <div>
                <strong>Combinar y Actualizar (Recomendado):</strong> Agrega los registros nuevos y actualiza los existentes con el mismo ID, sin borrar datos ya guardados.
              </div>
            </label>
            <label style="display: flex; align-items: flex-start; gap: var(--spacing-2); cursor: pointer;">
              <input type="radio" name="import-strat" value="restore" style="margin-top: 3px;" />
              <div>
                <strong>Restaurar copia exacta:</strong> Reemplaza completamente los datos locales por el contenido de este archivo (genera antes una copia de seguridad en descarga).
              </div>
            </label>
          </div>
        </div>
      </div>
    `;

    modal.open({
      title: 'Confirmar Importación de Datos JSON',
      size: 'lg',
      contentHtml,
      footerHtml: `
        <button class="btn btn-outline" id="btn-modal-import-cancel">Cancelar</button>
        <button class="btn btn-primary" id="btn-modal-import-confirm">Ejecutar Importación</button>
      `,
      onMount: (dialog) => {
        dialog.querySelector('#btn-modal-import-cancel').addEventListener('click', () => modal.close());

        dialog.querySelector('#btn-modal-import-confirm').addEventListener('click', async () => {
          const strategyRadio = dialog.querySelector('input[name="import-strat"]:checked');
          const strategy = strategyRadio ? strategyRadio.value : 'merge';

          try {
            if (strategy === 'restore') {
              await BackupService.exportBackup();
            }

            await BackupService.executeImport(data, strategy);
            notification.success('Importación Exitosa', `Se procesó el archivo con estrategia "${strategy === 'restore' ? 'Restauración completa' : 'Combinación'}".`);
            modal.close();
            this.render(mainContainer);
          } catch (err) {
            notification.error('Error durante importación', err.message);
          }
        });
      }
    });
  }
}
