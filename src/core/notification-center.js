/**
 * Servicio del Centro de Notificaciones de HIDROTERRA
 * Gestiona las notificaciones activas y descartadas (avisos de respaldo y alertas hídricas)
 * con persistencia permanente por usuario en localStorage e IndexedDB, sincronizando en tiempo
 * real la ventana desplegable de la barra superior y el Centro de Notificaciones.
 */

import { events } from './events.js';
import { nowIso } from './date-utils.js';
import { sessionService } from './session.service.js';
import { idb } from '../infrastructure/database/indexeddb.js';

const DISMISSED_STORAGE_KEY_PREFIX = 'hidroterra_dismissed_notifications_v2';

class NotificationCenterService {
  constructor() {
    this.rawState = {
      showBackupWarning: false,
      daysSince: null,
      activeAlerts: [],
      initialized: false
    };

    // Solo cuando el usuario completa un nuevo respaldo real se reactiva un futuro aviso de respaldo
    events.on('backup:completed', () => {
      const map = this._getDismissedMap();
      if (map['notif-backup-warning']) {
        delete map['notif-backup-warning'];
        this._saveDismissedMap(map);
        events.emit('notifications:updated');
      }
    });

    // Al cambiar de sesión, cargar las preferencias persistidas del usuario
    events.on('session:changed', () => {
      this._hydrateFromIndexedDB();
      events.emit('notifications:updated');
    });

    this._hydrateFromIndexedDB();
  }

  _getStorageKey() {
    const userId = sessionService.getCurrentUser()?.id || 'global';
    return `${DISMISSED_STORAGE_KEY_PREFIX}_${userId}`;
  }

  _getDismissedMap() {
    try {
      const userKey = this._getStorageKey();
      const raw = localStorage.getItem(userKey) || localStorage.getItem(DISMISSED_STORAGE_KEY_PREFIX);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  _saveDismissedMap(mapObj) {
    const cleanMap = mapObj && typeof mapObj === 'object' ? mapObj : {};
    const userKey = this._getStorageKey();
    try {
      const serialized = JSON.stringify(cleanMap);
      localStorage.setItem(userKey, serialized);
      localStorage.setItem(DISMISSED_STORAGE_KEY_PREFIX, serialized);
    } catch {
      // Ignorar restricciones de localStorage
    }

    // Persistir también en IndexedDB (system_meta) para garantizar durabilidad total
    try {
      idb.put('system_meta', {
        key: userKey,
        dismissedMap: cleanMap,
        updatedAt: nowIso()
      }).catch(() => {});
    } catch {
      // Ignorar si IndexedDB aún no está inicializado
    }
  }

  async _hydrateFromIndexedDB() {
    try {
      const userKey = this._getStorageKey();
      const localRaw = localStorage.getItem(userKey);
      if (localRaw) return;
      const metaRecord = await idb.get('system_meta', userKey);
      if (metaRecord && metaRecord.dismissedMap && typeof metaRecord.dismissedMap === 'object') {
        const serialized = JSON.stringify(metaRecord.dismissedMap);
        localStorage.setItem(userKey, serialized);
        localStorage.setItem(DISMISSED_STORAGE_KEY_PREFIX, serialized);
        events.emit('notifications:updated');
      }
    } catch {
      // Ignorar
    }
  }

  setRawNotifications({ showBackupWarning, daysSince, activeAlerts } = {}) {
    if (showBackupWarning !== undefined) {
      this.rawState.showBackupWarning = Boolean(showBackupWarning);
    }
    if (daysSince !== undefined) {
      this.rawState.daysSince = daysSince;
    }
    if (Array.isArray(activeAlerts)) {
      this.rawState.activeAlerts = activeAlerts;
    }
    this.rawState.initialized = true;

    events.emit('notifications:updated');
  }

  /**
   * Construye la lista completa de notificaciones (activas y descartadas)
   * respetando siempre el estado descartado persistido por el usuario.
   */
  getAllNotifications() {
    const dismissedMap = this._getDismissedMap();
    const allItems = [];
    const matchedDismissKeys = new Set();

    const isBackupDismissed = Boolean(dismissedMap['notif-backup-warning']);
    if (this.rawState.showBackupWarning || isBackupDismissed) {
      const backupMsg = this.rawState.daysSince !== null
        ? `Han transcurrido ${this.rawState.daysSince} días desde el último respaldo. Se recomienda exportar una copia JSON o sincronizar con Firebase.`
        : (dismissedMap['notif-backup-warning']?.message || 'Hay datos registrados localmente sin respaldo reciente. Recuerde sincronizar con Firebase o exportar una copia JSON.');

      const id = 'notif-backup-warning';
      if (isBackupDismissed) matchedDismissKeys.add(id);

      allItems.push({
        id,
        type: 'backup',
        priority: 'media',
        categoryLabel: 'Seguridad y Respaldo Territorial',
        title: 'Aviso de seguridad territorial — Respaldo pendiente',
        message: backupMsg,
        createdAt: dismissedMap[id]?.createdAt || nowIso(),
        actionType: 'export_backup',
        actionLabel: 'Exportar Ahora',
        dismissed: isBackupDismissed,
        dismissedAt: dismissedMap[id]?.dismissedAt || null
      });
    }

    for (const alert of (this.rawState.activeAlerts || [])) {
      const id = `notif-alert-${alert.id}`;
      const ruleKey = alert.ruleCode ? `notif-rule-${alert.ruleCode}` : null;
      const dismissEntry = dismissedMap[id] || (ruleKey ? dismissedMap[ruleKey] : null) || null;
      const isDismissed = Boolean(dismissEntry);

      if (dismissedMap[id]) matchedDismissKeys.add(id);
      if (ruleKey && dismissedMap[ruleKey]) matchedDismissKeys.add(ruleKey);

      allItems.push({
        id,
        alertId: alert.id,
        ruleCode: alert.ruleCode || null,
        type: 'water_alert',
        priority: alert.priority || 'media',
        categoryLabel: 'Alerta Hídrica Territorial',
        title: `Alerta Hídrica (${String(alert.priority || 'media').toUpperCase()}) — ${alert.relatedEntityName || 'Fuente Hídrica'}`,
        message: alert.description || 'Alerta activa detectada en el monitoreo hídrico.',
        ruleDescription: alert.ruleDescription || '',
        relatedEntityId: alert.relatedEntityId || null,
        relatedEntityType: alert.relatedEntityType || null,
        createdAt: alert.generatedAt || alert.createdAt || nowIso(),
        actionType: 'go_alerts',
        actionLabel: 'Gestionar en Alertas Hídricas',
        dismissed: isDismissed,
        dismissedAt: dismissEntry?.dismissedAt || null
      });
    }

    // Incluir notificaciones descartadas que permanecen en el historial del usuario
    Object.entries(dismissedMap).forEach(([key, meta]) => {
      if (matchedDismissKeys.has(key)) return;
      if (key.startsWith('notif-rule-')) return; // Evitar duplicar entrada auxiliar de regla
      if (!allItems.some(item => item.id === key) && meta && meta.title) {
        allItems.push({
          id: key,
          ruleCode: meta.ruleCode || null,
          type: meta.type || 'system',
          priority: meta.priority || 'baja',
          categoryLabel: meta.categoryLabel || 'Notificación del Sistema',
          title: meta.title,
          message: meta.message || '',
          createdAt: meta.createdAt || meta.dismissedAt,
          actionType: meta.actionType || null,
          actionLabel: meta.actionLabel || null,
          dismissed: true,
          dismissedAt: meta.dismissedAt || nowIso()
        });
      }
    });

    const active = allItems.filter(item => !item.dismissed);
    const dismissed = allItems
      .filter(item => item.dismissed)
      .sort((a, b) => new Date(b.dismissedAt || 0).getTime() - new Date(a.dismissedAt || 0).getTime());

    return {
      active,
      dismissed,
      totalActive: active.length,
      totalDismissed: dismissed.length
    };
  }

  /**
   * Descarta una notificación individual por su ID y persiste la decisión del usuario
   */
  dismiss(notifId) {
    if (!notifId) return;
    const { active } = this.getAllNotifications();
    const target = active.find(n => n.id === notifId);
    const map = this._getDismissedMap();
    const ts = nowIso();

    const entry = {
      id: notifId,
      ruleCode: target?.ruleCode || null,
      title: target?.title || 'Notificación descartada',
      message: target?.message || '',
      categoryLabel: target?.categoryLabel || 'Notificación',
      priority: target?.priority || 'media',
      type: target?.type || 'system',
      createdAt: target?.createdAt || ts,
      dismissedAt: ts
    };

    map[notifId] = entry;
    if (target?.ruleCode) {
      map[`notif-rule-${target.ruleCode}`] = entry;
    }

    this._saveDismissedMap(map);
    events.emit('notifications:updated');
  }

  /**
   * Descarta todas las notificaciones activas actuales y persiste el cambio
   */
  dismissAllActive() {
    const { active } = this.getAllNotifications();
    if (active.length === 0) return 0;
    const map = this._getDismissedMap();
    const ts = nowIso();

    active.forEach(target => {
      const entry = {
        id: target.id,
        ruleCode: target.ruleCode || null,
        title: target.title,
        message: target.message,
        categoryLabel: target.categoryLabel,
        priority: target.priority,
        type: target.type,
        createdAt: target.createdAt || ts,
        dismissedAt: ts
      };
      map[target.id] = entry;
      if (target.ruleCode) {
        map[`notif-rule-${target.ruleCode}`] = entry;
      }
    });

    this._saveDismissedMap(map);
    events.emit('notifications:updated');
    return active.length;
  }

  /**
   * Restaura una notificación previamente descartada
   */
  restore(notifId) {
    if (!notifId) return;
    const map = this._getDismissedMap();
    const target = map[notifId];
    if (target?.ruleCode) {
      delete map[`notif-rule-${target.ruleCode}`];
    }
    delete map[notifId];
    this._saveDismissedMap(map);
    events.emit('notifications:updated');
  }

  /**
   * Restaura todas las notificaciones descartadas
   */
  restoreAllDismissed() {
    this._saveDismissedMap({});
    events.emit('notifications:updated');
  }
}

export const notificationCenter = new NotificationCenterService();
