/**
 * Servicio de Auditoría Demostrativa (Audit Log Service) — HIDROTERRA
 * Registra inicios/cierres de sesión, creaciones, ediciones, eliminaciones,
 * gestión de usuarios, cambios institucionales y sincronizaciones en Firestore (audit_logs).
 *
 * NOTA TÉCNICA:
 * Este registro de auditoría es demostrativo y académico; sin un backend confiable,
 * los registros en cliente no garantizan inmutabilidad frente a manipulación directa.
 */

import { firebaseService, FIRESTORE_COLLECTIONS } from '../../js/firebase-service.js';
import { generateId } from '../core/validators.js';
import { nowIso } from '../core/date-utils.js';

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'passwordSalt',
  'passwordIterations',
  'passwordAlgorithm',
  'photoDataUrl',
  'logoDataUrl'
]);

function sanitizeAuditSnapshot(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const clean = {};
  Object.keys(obj).forEach(key => {
    if (!SENSITIVE_FIELDS.has(key)) {
      const val = obj[key];
      if (typeof val === 'string' && val.length > 300) {
        clean[key] = `${val.substring(0, 300)}...`;
      } else {
        clean[key] = val;
      }
    }
  });
  return clean;
}

class AuditService {
  /**
   * Registra un evento en la colección audit_logs de Firestore y su espejo local
   * @param {object} params
   */
  async logEvent({
    user = null,
    organization = null,
    module = 'system',
    action = 'operation',
    recordId = null,
    details = '',
    targetOrganizationId = null,
    previousValues = null,
    newValues = null
  }) {
    try {
      const id = `audit-${Date.now()}-${generateId().slice(0, 8)}`;
      const userOrgId = user?.organizationId || organization?.id || null;
      const effectiveOrgId = targetOrganizationId || userOrgId || 'global';
      const isCrossOrganizationEdit = Boolean(
        user?.role === 'SUPERADMINISTRADOR' &&
        targetOrganizationId &&
        userOrgId &&
        targetOrganizationId !== userOrgId
      ) || Boolean(user?.role === 'SUPERADMINISTRADOR' && (previousValues || newValues));

      const entry = {
        id,
        userId: user?.id || 'anonymous',
        userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email : 'Usuario no autenticado',
        userEmail: user?.email || '—',
        userRole: user?.role || 'PUBLICO',
        organizationId: effectiveOrgId,
        organizationName: organization?.name || user?.organizationName || (effectiveOrgId === 'global' ? 'Administración Central' : effectiveOrgId),
        module,
        action,
        recordId: recordId ? String(recordId) : '—',
        details: String(details || ''),
        isCrossOrganizationAdminAction: isCrossOrganizationEdit,
        previousValues: previousValues ? sanitizeAuditSnapshot(previousValues) : null,
        newValues: newValues ? sanitizeAuditSnapshot(newValues) : null,
        timestamp: nowIso(),
        createdAt: nowIso()
      };

      await firebaseService.setDocument(FIRESTORE_COLLECTIONS.audit_logs, id, entry, true);
      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Consulta el historial de auditoría aplicando filtros por organización, módulo o acción
   */
  async getAuditLogs(filters = {}) {
    const queryFilter = filters.organizationId && filters.organizationId !== 'all'
      ? { organizationId: filters.organizationId }
      : {};

    let logs = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.audit_logs, queryFilter);

    if (filters.module && filters.module !== 'all') {
      logs = logs.filter(l => l.module === filters.module);
    }
    if (filters.action && filters.action !== 'all') {
      logs = logs.filter(l => l.action === filters.action);
    }
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      logs = logs.filter(l =>
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
        (l.organizationName && l.organizationName.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q)) ||
        (l.recordId && String(l.recordId).toLowerCase().includes(q))
      );
    }

    logs.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
    return logs;
  }
}

export const auditService = new AuditService();

