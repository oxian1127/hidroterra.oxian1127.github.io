/**
 * Orquestador Principal de la Aplicación (App)
 */

import { AppLayout } from './ui/layouts/app-layout.js';
import { Router } from './router.js';
import { idb } from './infrastructure/database/indexeddb.js';
import { BackupService } from './application/backup.service.js';
import { SAMPLE_MONTES_DE_MARIA } from '../data/examples/sample-data.js';
import { firebaseService } from '../js/firebase-service.js';
import { sessionService } from './core/session.service.js';
import { FirebaseSyncService } from './application/firebase-sync.service.js';
import { events } from './core/events.js';
import { logger } from './core/logger.js';
import { APP_CONFIG } from './config/app.config.js';
import { ThemeService } from './core/theme.js';
import { notification } from './ui/components/notification.js';

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

    // 3. Inicializar Base de Datos Local IndexedDB y verificar registros territoriales base
    try {
      await idb.init();
      logger.info('Persistencia IndexedDB lista y verificada.');
      await this._ensureBaseLocalDataset();
    } catch (dbErr) {
      logger.error('Fallo al inicializar base de datos IndexedDB', dbErr);
    }

    // 3.1 Inicializar conexión con Firebase Firestore y perfiles organizacionales base
    try {
      const conn = await firebaseService.checkConnection();
      this.layout.header.setFirebaseStatus(conn.connected);
      await sessionService.ensureBaseOrganizationsInFirestore();
    } catch (fbErr) {
      logger.warn('Firebase Firestore en modo local/pendiente:', fbErr.message);
    }

    // 4. Configurar escuchadores de conectividad del navegador
    this._setupConnectivityListeners();

    // 5. Configurar escuchadores globales de eventos de datos
    this._setupDataListeners();

    // 6. Optimizar desbordamiento de texto y puntos suspensivos (...) en comboboxes y textboxes
    this._setupControlEllipsisOptimization();

    // 6.1 Configurar protección de contenido (bloqueo de clic derecho, selección y copia salvo áreas controladas)
    this._setupContentProtection();

    // 7. Registrar Service Worker para PWA Offline
    this._registerServiceWorker();

    // 8. Actualizar indicadores de almacenamiento y respaldos
    await this._refreshStorageAndBackupStatus();

    // 9. Iniciar navegación a la ruta solicitada
    this.router.init();
  }

  /**
   * Garantiza que los registros territoriales existentes de Montes de María estén disponibles en IndexedDB
   * con su organizationId inferido si el navegador aún no tenía datos locales cargados.
   */
  async _ensureBaseLocalDataset() {
    try {
      if (localStorage.getItem('hidroterra_test_period_cleared') === 'true') {
        return;
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }

    const existingSites = await idb.getAll('sites').catch(() => []);
    const existingSources = await idb.getAll('water_sources').catch(() => []);
    if (existingSites.length > 0 || existingSources.length > 0) {
      return;
    }

    const data = SAMPLE_MONTES_DE_MARIA?.data;
    if (!data) return;

    const siteToOrgMap = new Map();
    for (const s of (data.sites || [])) {
      const inf = FirebaseSyncService.inferOrganizationForRecord('sites', s, siteToOrgMap);
      if (inf.organizationId) siteToOrgMap.set(s.id, inf.organizationId);
      await idb.put('sites', { ...s, organizationId: s.organizationId || inf.organizationId });
    }

    const sourceToSiteMap = new Map();
    for (const ws of (data.water_sources || [])) {
      if (ws.id && ws.siteId) sourceToSiteMap.set(ws.id, ws.siteId);
    }
    const pluvToSiteMap = new Map();
    for (const pl of (data.pluviometers || [])) {
      if (pl.id && pl.siteId) pluvToSiteMap.set(pl.id, pl.siteId);
    }
    const parcelToSiteMap = new Map();
    for (const pa of (data.parcels || [])) {
      if (pa.id && pa.siteId) parcelToSiteMap.set(pa.id, pa.siteId);
    }

    const stores = [
      'water_sources', 'water_measurements', 'water_alerts',
      'pluviometers', 'rainfall_records', 'parcels', 'crops', 'observations'
    ];
    for (const storeName of stores) {
      const records = data[storeName] || [];
      for (const rec of records) {
        const inf = FirebaseSyncService.inferOrganizationForRecord(
          storeName, rec, siteToOrgMap, sourceToSiteMap, pluvToSiteMap, parcelToSiteMap
        );
        await idb.put(storeName, {
          ...rec,
          organizationId: rec.organizationId || inf.organizationId || null
        });
      }
    }
    logger.info('Datos territoriales iniciales de Montes de María cargados en IndexedDB con asignación organizacional.');
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

    events.on('session:changed', async () => {
      await this._refreshStorageAndBackupStatus();
    });
  }

  /**
   * Ajusta automáticamente comboboxes (<select>) y textboxes (<input>) en todas las vistas
   * para reemplazar por puntos suspensivos (...) el texto final que no quepa en la caja
   * y mostrar el texto íntegro en el atributo title al pasar el cursor.
   */
  _setupControlEllipsisOptimization() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;

    const truncateToFit = (text, maxWidthPx, font) => {
      if (!text) return '';
      if (!ctx || maxWidthPx <= 35) return text;
      ctx.font = font || '14px "Open Sans", system-ui, sans-serif';
      if (ctx.measureText(text).width <= maxWidthPx) {
        return text;
      }
      const ellipsis = '...';
      let low = 1;
      let high = text.length;
      let best = text.slice(0, 1) + ellipsis;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = text.slice(0, mid).trimEnd() + ellipsis;
        if (ctx.measureText(candidate).width <= maxWidthPx) {
          best = candidate;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return best;
    };

    const formatSelectElement = (selectEl) => {
      if (!selectEl || selectEl.tagName !== 'SELECT') return;
      const clientW = selectEl.clientWidth;
      if (!clientW || clientW <= 0) return;

      const style = window.getComputedStyle(selectEl);
      const font = `${style.fontWeight || '400'} ${style.fontSize || '14px'} ${style.fontFamily || 'sans-serif'}`;
      const padLeft = parseFloat(style.paddingLeft) || 12;
      const padRight = Math.max(parseFloat(style.paddingRight) || 28, 30);
      const availableWidth = clientW - padLeft - padRight - 6;
      const tooltipEnabled = ThemeService.isOverflowTooltipEnabled();

      Array.from(selectEl.options).forEach((opt) => {
        if (!opt.hasAttribute('value')) {
          opt.setAttribute('value', opt.textContent);
        }
        if (!opt.dataset.fullText) {
          opt.dataset.fullText = opt.textContent.replace(/\s+/g, ' ').trim();
        }
        const fullText = opt.dataset.fullText;
        const fitted = truncateToFit(fullText, availableWidth, font);
        if (opt.textContent !== fitted) {
          opt.textContent = fitted;
        }
        if (tooltipEnabled) {
          opt.title = fullText;
        } else {
          opt.removeAttribute('title');
        }
      });

      const selectedOpt = selectEl.options[selectEl.selectedIndex];
      if (selectedOpt) {
        const full = selectedOpt.dataset.fullText || selectedOpt.textContent || '';
        selectEl.dataset.fullText = full;
        if (tooltipEnabled) {
          selectEl.title = full;
        } else {
          selectEl.removeAttribute('title');
        }
      }
    };

    const syncInputElement = (inputEl) => {
      if (!inputEl || inputEl.tagName !== 'INPUT') return;
      const ignoredTypes = ['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'color', 'range', 'hidden'];
      if (ignoredTypes.includes((inputEl.type || 'text').toLowerCase())) return;
      const val = (inputEl.value || inputEl.placeholder || '').trim();
      const tooltipEnabled = ThemeService.isOverflowTooltipEnabled();
      if (val) {
        inputEl.dataset.fullText = val;
        if (tooltipEnabled) {
          inputEl.title = val;
        } else {
          inputEl.removeAttribute('title');
        }
      } else {
        delete inputEl.dataset.fullText;
        inputEl.removeAttribute('title');
      }
    };

    const syncTruncatedContainers = () => {
      const tooltipEnabled = ThemeService.isOverflowTooltipEnabled();
      const candidates = document.querySelectorAll(
        '.btn, .badge, .metric-value, .metric-label, .metric-sub, .card-title, .card-subtitle, .climate-stat-label, .climate-stat-val, .nav-item, .nav-tab-btn, h2, h3, h4, td'
      );
      candidates.forEach((el) => {
        if (!el || el.children.length > 4) return;
        if (el.hasAttribute('title') && !el.hasAttribute('data-ht-title')) {
          el.setAttribute('data-ht-title', el.getAttribute('title'));
        }
        if (!tooltipEnabled && el.hasAttribute('title')) {
          el.removeAttribute('title');
        }
        const innerSpan = el.querySelector('span:not(.nav-icon)');
        const isOverflowing =
          el.scrollWidth > el.clientWidth + 1 ||
          (innerSpan && innerSpan.scrollWidth > innerSpan.clientWidth + 1);
        if (isOverflowing) {
          const cleanText = (el.getAttribute('data-ht-title') || el.getAttribute('title') || el.dataset.fullText || el.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleanText) {
            el.dataset.fullText = cleanText;
          }
        }
      });
    };

    const applyAllControls = () => {
      document.querySelectorAll('select').forEach(formatSelectElement);
      document.querySelectorAll('input').forEach(syncInputElement);
      syncTruncatedContainers();
    };

    // Tooltip flotante universal (PC mouse hover y Móvil al presionar)
    let tooltipEl = document.getElementById('hidroterra-smart-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'hidroterra-smart-tooltip';
      tooltipEl.className = 'smart-overflow-tooltip';
      tooltipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tooltipEl);
    }

    let hideTimeoutId = null;
    let activeTarget = null;
    let longPressTimer = null;
    let suppressNextClick = false;

    const resolveOverflowInfo = (startNode) => {
      if (!startNode || !(startNode instanceof Element)) return null;

      let node = startNode;
      for (let depth = 0; depth < 5 && node && node !== document.body; depth += 1) {
        if (node.tagName === 'SELECT') {
          const selectedOpt = node.options[node.selectedIndex];
          const full = (selectedOpt && (selectedOpt.dataset.fullText || selectedOpt.textContent)) || node.dataset.fullText || '';
          const shown = (selectedOpt && selectedOpt.textContent) || '';
          if (full && (full !== shown || shown.endsWith('...') || node.scrollWidth > node.clientWidth + 1)) {
            return { element: node, text: full.trim() };
          }
          if (full && full.length > 22) {
            return { element: node, text: full.trim() };
          }
        }

        if (node.tagName === 'INPUT') {
          const ignoredTypes = ['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'color', 'range', 'hidden'];
          if (!ignoredTypes.includes((node.type || 'text').toLowerCase())) {
            const val = (node.value || node.placeholder || '').trim();
            if (val) {
              const style = window.getComputedStyle(node);
              const font = `${style.fontWeight || '400'} ${style.fontSize || '14px'} ${style.fontFamily || 'sans-serif'}`;
              const textW = ctx ? ((ctx.font = font), ctx.measureText(val).width) : val.length * 8;
              if (node.scrollWidth > node.clientWidth + 1 || textW > node.clientWidth - 24) {
                return { element: node, text: val };
              }
            }
          }
        }

        const innerSpan = node.querySelector && node.querySelector(':scope > span:not(.nav-icon)');
        const isElementTruncated =
          node.scrollWidth > node.clientWidth + 1 ||
          (innerSpan && innerSpan.scrollWidth > innerSpan.clientWidth + 1) ||
          (node.textContent && node.textContent.trim().endsWith('...'));

        const explicitTitle = node.getAttribute('data-ht-title') || node.getAttribute('title') || node.dataset.fullText;

        if (isElementTruncated || (explicitTitle && node.matches('.btn, .badge, .metric-value, .metric-label, .metric-sub, h4, p'))) {
          const text = (explicitTitle || node.textContent || '').replace(/\s+/g, ' ').trim();
          if (text && text.length > 1) {
            return { element: node, text };
          }
        }

        node = node.parentElement;
      }
      return null;
    };

    const showSmartTooltip = (targetEl, text, autoHideMs = 0) => {
      if (!tooltipEl || !targetEl || !text) return;
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
        hideTimeoutId = null;
      }

      // Evitar doble tooltip nativo en escritorio guardando title en data-ht-title
      if (targetEl.hasAttribute('title')) {
        targetEl.setAttribute('data-ht-title', targetEl.getAttribute('title'));
        targetEl.removeAttribute('title');
      }

      activeTarget = targetEl;
      tooltipEl.textContent = text;
      tooltipEl.classList.add('visible');

      const rect = targetEl.getBoundingClientRect();
      const tipRect = tooltipEl.getBoundingClientRect();
      const margin = 10;

      let top = rect.top - tipRect.height - 8;
      if (top < margin) {
        top = rect.bottom + 8;
      }
      if (top + tipRect.height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - tipRect.height - margin);
      }

      let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
      if (left < margin) left = margin;
      if (left + tipRect.width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - tipRect.width - margin);
      }

      tooltipEl.style.top = `${Math.round(top)}px`;
      tooltipEl.style.left = `${Math.round(left)}px`;

      if (autoHideMs > 0) {
        hideTimeoutId = setTimeout(() => {
          hideSmartTooltip();
        }, autoHideMs);
      }
    };

    const hideSmartTooltip = () => {
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
        hideTimeoutId = null;
      }
      if (activeTarget && activeTarget.hasAttribute('data-ht-title')) {
        activeTarget.setAttribute('title', activeTarget.getAttribute('data-ht-title'));
      }
      activeTarget = null;
      if (tooltipEl) {
        tooltipEl.classList.remove('visible');
      }
    };

    // Eventos en PC (al pasar el mouse) — solo si la opción está activada en Configuración
    document.addEventListener('mouseover', (e) => {
      if (!ThemeService.isOverflowTooltipEnabled()) {
        if (activeTarget) hideSmartTooltip();
        return;
      }
      const info = resolveOverflowInfo(e.target);
      if (info) {
        showSmartTooltip(info.element, info.text, 0);
      } else if (activeTarget) {
        hideSmartTooltip();
      }
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      if (activeTarget && e.relatedTarget && !activeTarget.contains(e.relatedTarget)) {
        hideSmartTooltip();
      }
    }, { passive: true });

    // Eventos en Teléfono / Pantallas Táctiles (al presionar un botón o contenedor) — solo si la opción está activada en Configuración
    document.addEventListener('touchstart', (e) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      suppressNextClick = false;

      if (!ThemeService.isOverflowTooltipEnabled()) {
        hideSmartTooltip();
        return;
      }

      const info = resolveOverflowInfo(e.target);
      if (!info) {
        hideSmartTooltip();
        return;
      }

      // Mostrar inmediatamente el texto completo al presionar
      showSmartTooltip(info.element, info.text, 3200);

      // Si es un botón con texto truncado y el usuario mantiene presionado (>= 380ms), permitir leer sin disparar click accidental
      const isInteractiveBtn = info.element.matches('button, .btn, .nav-tab-btn, .nav-item');
      if (isInteractiveBtn) {
        longPressTimer = setTimeout(() => {
          suppressNextClick = true;
        }, 380);
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });

    document.addEventListener('touchmove', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });

    document.addEventListener('click', (e) => {
      if (suppressNextClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressNextClick = false;
      }
    }, true);

    window.addEventListener('scroll', hideSmartTooltip, { passive: true, capture: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideSmartTooltip();
    });

    let rafId = null;
    const scheduleApply = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        applyAllControls();
      });
    };

    document.addEventListener('change', (e) => {
      if (e.target && e.target.tagName === 'SELECT') {
        formatSelectElement(e.target);
      } else if (e.target && e.target.tagName === 'INPUT') {
        syncInputElement(e.target);
      }
    }, true);

    document.addEventListener('input', (e) => {
      if (e.target && e.target.tagName === 'INPUT') {
        syncInputElement(e.target);
      }
    }, true);

    window.addEventListener('resize', scheduleApply, { passive: true });

    events.on('preferences:overflow-tooltip', ({ enabled }) => {
      if (!enabled) {
        hideSmartTooltip();
      }
      scheduleApply();
    });

    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      for (const m of mutations) {
        if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
          shouldUpdate = true;
          break;
        }
      }
      if (shouldUpdate) scheduleApply();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    scheduleApply();
  }

  /**
   * Configura protección global de interfaz:
   * - Bloquea el menú contextual (clic derecho) en toda la plataforma.
   * - Evita seleccionar o arrastrar contenido de las páginas fuera de campos de formulario o zonas controladas.
   * - Restringe las acciones de copiar/cortar exclusivamente a inputs, textareas y elementos con [data-allow-copy="true"] o .allow-copy.
   * - Permite copiar con un clic los códigos e identificadores habilitados con [data-allow-copy="true"].
   */
  _setupContentProtection() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    let lastCopyWarnTime = 0;

    const isAllowedCopyOrSelectTarget = (target) => {
      if (!target || typeof target.closest !== 'function') return false;
      if (target.closest('input, textarea, [contenteditable="true"], [data-allow-copy="true"], .allow-copy')) {
        return true;
      }
      const selection = window.getSelection ? window.getSelection() : null;
      if (selection && selection.anchorNode) {
        const anchorEl = selection.anchorNode.nodeType === 1
          ? selection.anchorNode
          : selection.anchorNode.parentElement;
        if (anchorEl && anchorEl.closest('input, textarea, [contenteditable="true"], [data-allow-copy="true"], .allow-copy')) {
          return true;
        }
      }
      return false;
    };

    // 1. Bloquear clic derecho (menú contextual) en toda la aplicación
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    }, true);

    // 2. Bloquear inicio de selección de texto salvo en zonas controladas y campos editables
    document.addEventListener('selectstart', (e) => {
      if (!isAllowedCopyOrSelectTarget(e.target)) {
        e.preventDefault();
      }
    }, true);

    // 3. Bloquear arrastre de elementos e imágenes
    document.addEventListener('dragstart', (e) => {
      if (!isAllowedCopyOrSelectTarget(e.target)) {
        e.preventDefault();
      }
    }, true);

    // 4. Controlar eventos de copia y corte (solo autorizados en campos de formulario y áreas [data-allow-copy="true"])
    const handleClipboardGuard = (e) => {
      if (!isAllowedCopyOrSelectTarget(e.target)) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastCopyWarnTime > 3500) {
          lastCopyWarnTime = now;
          notification.info(
            'Copia controlada activa',
            'Solo se permite copiar códigos, coordenadas, resultados de calculadoras o campos de formulario.'
          );
        }
      }
    };

    document.addEventListener('copy', handleClipboardGuard, true);
    document.addEventListener('cut', handleClipboardGuard, true);

    // 5. Bloquear combinaciones de teclado no autorizadas (Ctrl+C, Ctrl+X, Ctrl+A fuera de zonas permitidas, y Ctrl+U / Ctrl+S)
    document.addEventListener('keydown', (e) => {
      const key = (e.key || '').toLowerCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (!ctrlOrCmd) return;

      if (key === 'u' || key === 's') {
        e.preventDefault();
        return;
      }

      if ((key === 'c' || key === 'x' || key === 'a') && !isAllowedCopyOrSelectTarget(e.target)) {
        e.preventDefault();
        if (key === 'c' || key === 'x') {
          const now = Date.now();
          if (now - lastCopyWarnTime > 3500) {
            lastCopyWarnTime = now;
            notification.info(
              'Copia controlada activa',
              'Haga clic sobre un código, coordenada o cuadro de resultados autorizado para copiar su contenido.'
            );
          }
        }
      }
    }, true);

    // 6. Facilitar copia rápida controlada al hacer clic sobre códigos o coordenadas marcados con [data-allow-copy="true"]
    document.addEventListener('click', async (e) => {
      const copyableTag = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('code[data-allow-copy="true"], td[data-allow-copy="true"], div[data-allow-copy="true"]:not(.card-body)')
        : null;
      if (!copyableTag) return;

      const textToCopy = (copyableTag.textContent || '').replace(/\s+/g, ' ').trim();
      if (!textToCopy) return;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textToCopy);
          notification.success('Dato copiado al portapapeles', `Se copió: "${textToCopy}"`);
        }
      } catch (_err) {
        // Si el navegador requiere selección manual, ya está habilitada mediante user-select: text
      }
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
