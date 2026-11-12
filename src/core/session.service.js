/**
 * Servicio Centralizado de Sesión, Organizaciones, Usuarios, Roles y Permisos — HIDROTERRA
 *
 * Implementa:
 * - Inicio de sesión demostrativo contra Firestore (colección `users`) con verificación PBKDF2-SHA256.
 * - Asistente de configuración inicial (ejecutado una sola vez) para crear el Superadministrador
 *   y las organizaciones identificadas en los datos reales existentes sin contraseñas fijas en código.
 * - Funciones centrales reutilizables de permisos y aislamiento demostrativo por `organizationId`:
 *   getCurrentUser(), getCurrentOrganization(), getUserRole(), canViewRecord(),
 *   canCreateRecord(), canEditRecord(), canDeleteRecord(), getOrganizationRecords(), getAllOrganizationsRecords().
 *
 * IMPORTANTE (Alcance Académico y Demostrativo):
 * Esta separación controla la experiencia de usuario e interfaz, pero no constituye una barrera
 * de seguridad de backend frente a accesos directos a Firestore sin Firebase Authentication.
 */

import { firebaseService, FIRESTORE_COLLECTIONS } from '../../js/firebase-service.js';
import {
  createPasswordCredential,
  verifyPasswordCredential,
  validatePasswordStrength
} from './crypto-auth.js';
import { auditService } from '../application/audit.service.js';
import { events } from './events.js';
import { nowIso } from './date-utils.js';
import { generateId } from './validators.js';

const SESSION_STORAGE_KEY = 'hidroterra_active_session_v1';

export const USER_ROLES = {
  SUPERADMINISTRADOR: 'SUPERADMINISTRADOR',
  ADMIN_ORGANIZACION: 'ADMIN_ORGANIZACION',
  EDITOR: 'EDITOR',
  CONSULTA: 'CONSULTA'
};

export const ROLES = USER_ROLES;

export const USER_ROLE_LABELS = {
  SUPERADMINISTRADOR: 'Superadministrador',
  ADMIN_ORGANIZACION: 'Administrador de Organización',
  EDITOR: 'Editor',
  CONSULTA: 'Consulta'
};

export const ROLE_LABELS = USER_ROLE_LABELS;

/**
 * Organizaciones extraídas estrictamente de los registros reales existentes en HIDROTERRA
 * (sin inventar correos electrónicos, NIT ni teléfonos que no figuran en los datos originales).
 */
export const IDENTIFIED_BASE_ORGANIZATIONS = [
  {
    id: 'org-comite-agua-caracoli',
    organizationId: 'org-comite-agua-caracoli',
    name: 'Comité de Agua Caracolí',
    shortName: 'Comité Caracolí',
    nit: '',
    organizationType: 'Comité Comunitario de Agua',
    description: 'Organización comunitaria responsable del Pozo Profundo Comunal Caracolí (FNT-CARM-01) y del monitoreo pluviométrico en la Escuela Caracolí (PLUV-CARM-01).',
    department: 'Bolívar',
    municipality: 'El Carmen de Bolívar',
    address: 'Vereda Caracolí',
    website: '',
    socialLinks: '',
    logoDataUrl: '',
    representativeName: 'Prof. Martha Gómez',
    representativeRole: 'Responsable de Monitoreo y Comité de Agua',
    institutionalEmail: '',
    phone: '',
    whatsapp: '',
    workAreas: ['Abastecimiento Comunitario', 'Monitoreo de Pozos', 'Pluviometría Escolar'],
    status: 'activa',
    siteIds: ['site-carmen-caracoli'],
    knownResponsibles: [
      'Comité de Agua Caracolí',
      'Comité de Agua',
      'Prof. Martha Gómez',
      'Martha Gómez',
      'Don Jacinto Paternina',
      'Jacinto Paternina'
    ],
    privacySettings: {
      publishedInDirectory: true,
      consentGranted: false,
      consentDate: null,
      showEmail: false,
      showPhone: false,
      showWhatsapp: false,
      showContactName: true,
      showWebsite: false,
      showSocialLinks: false
    }
  },
  {
    id: 'org-asociacion-las-palmas',
    organizationId: 'org-asociacion-las-palmas',
    name: 'Asociación Agropecuaria Las Palmas',
    shortName: 'Asopalmas',
    nit: '',
    organizationType: 'Asociación Agropecuaria Comunitaria',
    description: 'Asociación comunitaria a cargo del Jagüey Comunitario El Tamarindo (FNT-SJAC-01), el Pluviómetro Finca Bella Vista (PLUV-SJAC-01) y parcelas productivas en Las Palmas.',
    department: 'Bolívar',
    municipality: 'San Jacinto',
    address: 'Corregimiento Las Palmas',
    website: '',
    socialLinks: '',
    logoDataUrl: '',
    representativeName: 'Don Emiro Torres',
    representativeRole: 'Coordinador de Monitoreo Agropecuario',
    institutionalEmail: '',
    phone: '',
    whatsapp: '',
    workAreas: ['Jagüeyes y Reservorios', 'Producción Agropecuaria', 'Monitoreo Pluviométrico'],
    status: 'activa',
    siteIds: ['site-sanjacinto-palmas'],
    knownResponsibles: [
      'Asociación Agropecuaria Las Palmas',
      'Don Emiro Torres',
      'Emiro Torres',
      'Doña Carmen Arrieta'
    ],
    privacySettings: {
      publishedInDirectory: true,
      consentGranted: false,
      consentDate: null,
      showEmail: false,
      showPhone: false,
      showWhatsapp: false,
      showContactName: true,
      showWebsite: false,
      showSocialLinks: false
    }
  },
  {
    id: 'org-comite-ambiental-colorados',
    organizationId: 'org-comite-ambiental-colorados',
    name: 'Comité Ambiental y Guardabosques Los Colorados',
    shortName: 'Comité Los Colorados',
    nit: '',
    organizationType: 'Comité Ambiental Comunitario',
    description: 'Colectivo de guardabosques y monitores comunitarios a cargo del Manantial Ojo de Agua Los Colorados (FNT-SJNP-01) y el Pluviómetro Vereda San Pedro (PLUV-SJNP-01).',
    department: 'Bolívar',
    municipality: 'San Juan Nepomuceno',
    address: 'Vereda San Pedro Consolado',
    website: '',
    socialLinks: '',
    logoDataUrl: '',
    representativeName: 'Guardabosques Comunitarios',
    representativeRole: 'Coordinación Ambiental Comunitaria',
    institutionalEmail: '',
    phone: '',
    whatsapp: '',
    workAreas: ['Protección de Manantiales', 'Bosque Seco Tropical', 'Monitoreo Comunitario'],
    status: 'activa',
    siteIds: ['site-sanjuan-sanpedro'],
    knownResponsibles: [
      'Guardabosques Comunitarios',
      'Comité Ambiental Los Colorados',
      'Comité Ambiental'
    ],
    privacySettings: {
      publishedInDirectory: true,
      consentGranted: false,
      consentDate: null,
      showEmail: false,
      showPhone: false,
      showWhatsapp: false,
      showContactName: true,
      showWebsite: false,
      showSocialLinks: false
    }
  },
  {
    id: 'org-jac-canutalito',
    organizationId: 'org-jac-canutalito',
    name: 'Junta de Acción Comunal Canutalito',
    shortName: 'JAC Canutalito',
    nit: '',
    organizationType: 'Junta de Acción Comunal',
    description: 'Junta de Acción Comunal responsable del monitoreo del Arroyo Mancomoján — Paso Canutalito (FNT-OVEJ-01), el Pluviómetro Comunitario Canutalito (PLUV-OVEJ-01) y cultivos asociados.',
    department: 'Sucre',
    municipality: 'Ovejas',
    address: 'Corregimiento Canutalito',
    website: '',
    socialLinks: '',
    logoDataUrl: '',
    representativeName: 'Luis Carlos Martínez',
    representativeRole: 'Coordinador Hídrico Comunitario',
    institutionalEmail: '',
    phone: '',
    whatsapp: '',
    workAreas: ['Gobernanza Comunitaria del Agua', 'Fuentes Superficiales', 'Agricultura Familiar'],
    status: 'activa',
    siteIds: ['site-ovejas-canutalito'],
    knownResponsibles: [
      'Junta de Acción Comunal Canutalito',
      'Luis Carlos Martínez',
      'Carlos Beleño'
    ],
    privacySettings: {
      publishedInDirectory: true,
      consentGranted: false,
      consentDate: null,
      showEmail: false,
      showPhone: false,
      showWhatsapp: false,
      showContactName: true,
      showWebsite: false,
      showSocialLinks: false
    }
  }
];

/**
 * Sanitiza un objeto de usuario eliminando hashes y sales antes de exponerlo a la sesión o UI
 */
export function sanitizeUserForClient(userDoc) {
  if (!userDoc) return null;
  const {
    passwordHash,
    passwordSalt,
    passwordIterations,
    passwordAlgorithm,
    ...safeUser
  } = userDoc;
  return {
    ...safeUser,
    hasPasswordConfigured: Boolean(passwordHash && passwordSalt)
  };
}

class SessionService {
  constructor() {
    this.currentUser = null;
    this.currentOrganization = null;
    this.organizationsCache = [];
    // Permite al SUPERADMINISTRADOR filtrar toda la aplicación por una organización específica o 'all'
    this.superadminSelectedOrgId = 'all';
    this._restoreSessionFromStorage();
  }

  _restoreSessionFromStorage() {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user && parsed.user.id) {
          this.currentUser = sanitizeUserForClient(parsed.user);
          this.currentOrganization = parsed.organization || null;
          this.superadminSelectedOrgId = parsed.superadminSelectedOrgId || 'all';
        }
      }
    } catch {
      this.currentUser = null;
      this.currentOrganization = null;
    }
  }

  _persistSessionToStorage() {
    try {
      if (!this.currentUser) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      const payload = JSON.stringify({
        user: sanitizeUserForClient(this.currentUser),
        organization: this.currentOrganization,
        superadminSelectedOrgId: this.superadminSelectedOrgId,
        savedAt: nowIso()
      });
      sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
      localStorage.setItem(SESSION_STORAGE_KEY, payload);
    } catch {
      // Ignorar restricciones de almacenamiento
    }
  }

  isAuthenticated() {
    return Boolean(this.currentUser && this.currentUser.id);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentOrganization() {
    if (this.currentUser?.role === USER_ROLES.SUPERADMINISTRADOR && this.superadminSelectedOrgId !== 'all') {
      const found = this.organizationsCache.find(o => o.id === this.superadminSelectedOrgId);
      if (found) return found;
    }
    return this.currentOrganization;
  }

  getUserRole() {
    return this.currentUser?.role || null;
  }

  isSuperAdmin() {
    return this.getUserRole() === USER_ROLES.SUPERADMINISTRADOR;
  }

  isOrgAdmin() {
    return this.getUserRole() === USER_ROLES.ADMIN_ORGANIZACION;
  }

  setSuperadminOrganizationFilter(orgId = 'all') {
    if (!this.isSuperAdmin()) return;
    this.superadminSelectedOrgId = orgId || 'all';
    this._persistSessionToStorage();
    events.emit('session:org-filter-changed', { organizationId: this.superadminSelectedOrgId });
    events.emit('data:reloaded');
  }

  getSuperadminOrganizationFilter() {
    return this.superadminSelectedOrgId || 'all';
  }

  /**
   * Determina el organizationId activo para asociar nuevos registros
   */
  getActiveOrganizationIdForCreation() {
    if (!this.currentUser) return null;
    if (this.isSuperAdmin()) {
      if (this.superadminSelectedOrgId && this.superadminSelectedOrgId !== 'all') {
        return this.superadminSelectedOrgId;
      }
      return this.currentUser.organizationId || 'org-admin-central';
    }
    return this.currentUser.organizationId || null;
  }

  /**
   * Verifica si ya se ejecutó el asistente de configuración inicial en Firestore
   */
  async isInitialSetupCompleted() {
    const setupDoc = await firebaseService.getDocument(FIRESTORE_COLLECTIONS.app_settings, 'initial_setup');
    if (setupDoc && setupDoc.completed === true) {
      return true;
    }
    const existingUsers = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.users);
    const hasSuperAdmin = existingUsers.some(
      u => u.role === USER_ROLES.SUPERADMINISTRADOR && u.passwordHash && u.passwordSalt
    );
    return hasSuperAdmin;
  }

  /**
   * Asegura que las 4 organizaciones base identificadas en los datos reales estén creadas en Firestore
   * sin sobrescribir cambios posteriores hechos por sus administradores.
   */
  async ensureBaseOrganizationsInFirestore() {
    const existing = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.organizations);
    const existingIds = new Set(existing.map(o => o.id || o.organizationId));
    const operations = [];

    for (const baseOrg of IDENTIFIED_BASE_ORGANIZATIONS) {
      if (!existingIds.has(baseOrg.id)) {
        const orgDoc = {
          ...baseOrg,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        operations.push({
          collection: FIRESTORE_COLLECTIONS.organizations,
          id: baseOrg.id,
          data: orgDoc
        });
        operations.push({
          collection: FIRESTORE_COLLECTIONS.public_directory,
          id: baseOrg.id,
          data: this._buildPublicDirectoryEntry(orgDoc)
        });
      }
    }

    if (operations.length > 0) {
      await firebaseService.batchUpsert(operations);
    }

    this.organizationsCache = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.organizations);
    return this.organizationsCache;
  }

  /**
   * Construye el documento seguro que se publica en `public_directory` respetando la configuración de privacidad
   */
  _buildPublicDirectoryEntry(org) {
    const priv = org.privacySettings || {};
    return {
      id: org.id || org.organizationId,
      organizationId: org.id || org.organizationId,
      name: org.name || '',
      shortName: org.shortName || '',
      organizationType: org.organizationType || 'Organización Comunitaria',
      department: org.department || '',
      municipality: org.municipality || '',
      description: org.description || '',
      workAreas: Array.isArray(org.workAreas) ? org.workAreas : [],
      logoDataUrl: org.logoDataUrl || '',
      status: org.status || 'activa',
      publishedInDirectory: priv.publishedInDirectory !== false,
      consentGranted: Boolean(priv.consentGranted),
      consentDate: priv.consentDate || null,
      // Campos de contacto filtrados estrictamente según visibilidad autorizada
      contactName: priv.showContactName ? (org.representativeName || '') : '',
      contactRole: priv.showContactName ? (org.representativeRole || '') : '',
      publicEmail: (priv.consentGranted && priv.showEmail) ? (org.institutionalEmail || '') : '',
      publicPhone: (priv.consentGranted && priv.showPhone) ? (org.phone || '') : '',
      publicWhatsapp: (priv.consentGranted && priv.showWhatsapp) ? (org.whatsapp || '') : '',
      publicWebsite: priv.showWebsite ? (org.website || '') : '',
      publicSocialLinks: priv.showSocialLinks ? (org.socialLinks || '') : '',
      updatedAt: nowIso()
    };
  }

  /**
   * Ejecuta por única vez el asistente de inicialización del Superadministrador y cuentas iniciales
   */
  async completeInitialSetupWizard({
    superadminFirstName,
    superadminLastName,
    superadminEmail,
    superadminPhone,
    superadminPassword,
    organizationAdmins = []
  }) {
    const alreadyDone = await this.isInitialSetupCompleted();
    if (alreadyDone) {
      throw new Error('El asistente de configuración inicial ya fue ejecutado previamente.');
    }

    const emailClean = String(superadminEmail || '').trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      throw new Error('Debe ingresar un correo electrónico válido para el Superadministrador.');
    }

    const pwdCheck = validatePasswordStrength(superadminPassword);
    if (!pwdCheck.valid) {
      throw new Error(`La contraseña del Superadministrador no cumple los requisitos: ${pwdCheck.errors.join(' ')}`);
    }

    await this.ensureBaseOrganizationsInFirestore();

    const superCreds = await createPasswordCredential(superadminPassword);
    const superAdminId = 'user-superadmin-central';
    const superAdminDoc = {
      id: superAdminId,
      firstName: String(superadminFirstName || 'Administrador').trim(),
      lastName: String(superadminLastName || 'Central HIDROTERRA').trim(),
      name: `${String(superadminFirstName || 'Administrador').trim()} ${String(superadminLastName || 'Central HIDROTERRA').trim()}`.trim(),
      email: emailClean,
      position: 'Superadministrador General',
      phone: String(superadminPhone || '').trim(),
      organizationId: 'org-admin-central',
      organizationName: 'Administración Central HIDROTERRA',
      role: USER_ROLES.SUPERADMINISTRADOR,
      status: 'activo',
      pendingPasswordSetup: false,
      passwordResetRequested: false,
      ...superCreds,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    const batchOps = [
      {
        collection: FIRESTORE_COLLECTIONS.users,
        id: superAdminId,
        data: superAdminDoc
      }
    ];

    // Procesar cuentas de administradores iniciales de cada organización identificada
    for (const orgAdmin of organizationAdmins) {
      if (!orgAdmin.organizationId) continue;
      const orgDoc = this.organizationsCache.find(o => o.id === orgAdmin.organizationId);
      if (!orgDoc) continue;

      const adminEmail = String(orgAdmin.email || '').trim().toLowerCase();
      // Actualizar correo institucional en la organización si fue completado por el administrador central
      if (adminEmail) {
        const updatedOrg = {
          ...orgDoc,
          institutionalEmail: adminEmail,
          updatedAt: nowIso()
        };
        batchOps.push({
          collection: FIRESTORE_COLLECTIONS.organizations,
          id: orgDoc.id,
          data: updatedOrg
        });
        batchOps.push({
          collection: FIRESTORE_COLLECTIONS.public_directory,
          id: orgDoc.id,
          data: this._buildPublicDirectoryEntry(updatedOrg)
        });
      }

      const adminUserId = `user-admin-${orgDoc.id}`;
      let credFields = {
        passwordHash: '',
        passwordSalt: '',
        passwordAlgorithm: 'PBKDF2-SHA256',
        passwordIterations: 120000,
        pendingPasswordSetup: true
      };

      if (orgAdmin.initialPassword && String(orgAdmin.initialPassword).trim().length >= 8) {
        const creds = await createPasswordCredential(String(orgAdmin.initialPassword).trim());
        credFields = {
          ...creds,
          pendingPasswordSetup: false
        };
      }

      const repParts = String(orgAdmin.representativeName || orgDoc.representativeName || 'Administrador Organización').trim().split(' ');
      const firstName = repParts[0] || 'Administrador';
      const lastName = repParts.slice(1).join(' ') || orgDoc.shortName;

      batchOps.push({
        collection: FIRESTORE_COLLECTIONS.users,
        id: adminUserId,
        data: {
          id: adminUserId,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
          email: adminEmail, // Vacío si el administrador central lo dejó pendiente de completar
          position: orgDoc.representativeRole || 'Administrador de Organización',
          phone: String(orgAdmin.phone || orgDoc.phone || '').trim(),
          organizationId: orgDoc.id,
          organizationName: orgDoc.name,
          role: USER_ROLES.ADMIN_ORGANIZACION,
          status: 'activo',
          passwordResetRequested: false,
          ...credFields,
          createdAt: nowIso(),
          updatedAt: nowIso()
        }
      });
    }

    batchOps.push({
      collection: FIRESTORE_COLLECTIONS.app_settings,
      id: 'initial_setup',
      data: {
        id: 'initial_setup',
        completed: true,
        completedAt: nowIso(),
        completedByEmail: emailClean,
        version: '2.0.0'
      }
    });

    await firebaseService.batchUpsert(batchOps);

    await auditService.logEvent({
      user: superAdminDoc,
      module: 'setup',
      action: 'initial_setup_completed',
      recordId: 'initial_setup',
      details: `Configuración inicial completada y cuenta Superadministrador creada (${emailClean}).`
    });

    // Iniciar sesión automáticamente con el Superadministrador recién creado
    this.currentUser = sanitizeUserForClient(superAdminDoc);
    this.currentOrganization = {
      id: 'org-admin-central',
      organizationId: 'org-admin-central',
      name: 'Administración Central HIDROTERRA',
      shortName: 'Admin Central',
      organizationType: 'Coordinación General',
      department: 'Bolívar / Sucre',
      municipality: 'Montes de María',
      status: 'activa'
    };
    this._persistSessionToStorage();
    events.emit('session:changed', { user: this.currentUser, organization: this.currentOrganization });

    return this.currentUser;
  }

  /**
   * Inicio de sesión demostrativo mediante consulta a Firestore y verificación local PBKDF2-SHA256
   */
  async login(email, plainPassword) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !plainPassword) {
      throw new Error('Ingrese su correo electrónico y contraseña.');
    }

    const users = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.users);
    const userDoc = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

    if (!userDoc) {
      throw new Error('No se encontró una cuenta registrada con ese correo electrónico.');
    }

    if (userDoc.status === 'suspendido' || userDoc.status === 'inactivo') {
      throw new Error('Esta cuenta de usuario se encuentra suspendida. Contacte al administrador.');
    }

    if (userDoc.pendingPasswordSetup) {
      const err = new Error('Esta cuenta requiere establecer su contraseña inicial antes de ingresar.');
      err.code = 'PENDING_PASSWORD_SETUP';
      err.userEmail = cleanEmail;
      err.userName = userDoc.name || `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim();
      throw err;
    }

    const valid = await verifyPasswordCredential(plainPassword, userDoc);
    if (!valid) {
      throw new Error('Credenciales incorrectas. Verifique su correo y contraseña.');
    }

    let orgDoc = null;
    if (userDoc.organizationId && userDoc.organizationId !== 'org-admin-central') {
      orgDoc = await firebaseService.getDocument(FIRESTORE_COLLECTIONS.organizations, userDoc.organizationId);
      if (orgDoc && orgDoc.status === 'suspendida' && userDoc.role !== USER_ROLES.SUPERADMINISTRADOR) {
        throw new Error('La organización asociada a esta cuenta se encuentra temporalmente suspendida.');
      }
    } else {
      orgDoc = {
        id: 'org-admin-central',
        organizationId: 'org-admin-central',
        name: 'Administración Central HIDROTERRA',
        shortName: 'Admin Central',
        organizationType: 'Coordinación General',
        department: 'Bolívar / Sucre',
        municipality: 'Montes de María',
        status: 'activa'
      };
    }

    this.currentUser = sanitizeUserForClient(userDoc);
    this.currentOrganization = orgDoc;
    this.superadminSelectedOrgId = 'all';
    this._persistSessionToStorage();

    // Sincronizar datos operativos desde Firestore hacia IndexedDB al iniciar sesión
    const pullOrgId = this.isSuperAdmin() ? null : this.currentUser.organizationId;
    await firebaseService.pullOperationalDataToIndexedDB(pullOrgId);

    await auditService.logEvent({
      user: this.currentUser,
      organization: this.currentOrganization,
      module: 'auth',
      action: 'login',
      recordId: this.currentUser.id,
      details: `Inicio de sesión exitoso (${USER_ROLE_LABELS[this.currentUser.role] || this.currentUser.role}).`
    });

    events.emit('session:changed', { user: this.currentUser, organization: this.currentOrganization });
    return { user: this.currentUser, organization: this.currentOrganization };
  }

  /**
   * Establece por primera vez la contraseña de una cuenta inicial marcada con pendingPasswordSetup = true
   */
  async setupInitialAccountPassword(email, newPassword, confirmPassword) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Correo electrónico requerido.');
    if (newPassword !== confirmPassword) {
      throw new Error('La nueva contraseña y su confirmación no coinciden.');
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error(`La contraseña no es suficientemente segura: ${strength.errors.join(' ')}`);
    }

    const users = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.users);
    const userDoc = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (!userDoc) {
      throw new Error('No se encontró una cuenta asociada a ese correo electrónico.');
    }
    if (!userDoc.pendingPasswordSetup) {
      throw new Error('Esta cuenta ya tiene una contraseña establecida. Utilice el inicio de sesión normal o solicite restablecimiento administrativo.');
    }

    const creds = await createPasswordCredential(newPassword);
    const updatedUser = {
      ...userDoc,
      ...creds,
      pendingPasswordSetup: false,
      passwordResetRequested: false,
      updatedAt: nowIso()
    };

    await firebaseService.setDocument(FIRESTORE_COLLECTIONS.users, userDoc.id, updatedUser, true);

    await auditService.logEvent({
      user: sanitizeUserForClient(updatedUser),
      module: 'auth',
      action: 'initial_password_established',
      recordId: userDoc.id,
      details: `Establecimiento inicial de contraseña completado para ${cleanEmail}.`
    });

    return await this.login(cleanEmail, newPassword);
  }

  /**
   * Solicita restablecimiento administrativo de contraseña (sin envío de correo externo ni texto plano)
   */
  async requestAdministrativePasswordReset(email, reason = '') {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Ingrese el correo electrónico de la cuenta que requiere restablecimiento.');
    }

    const users = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.users);
    const userDoc = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (!userDoc) {
      throw new Error('No se encontró ningún usuario registrado con ese correo electrónico.');
    }

    const updated = {
      ...userDoc,
      passwordResetRequested: true,
      passwordResetReason: String(reason || 'Solicitud desde pantalla de inicio de sesión').trim(),
      passwordResetRequestedAt: nowIso(),
      updatedAt: nowIso()
    };

    await firebaseService.setDocument(FIRESTORE_COLLECTIONS.users, userDoc.id, updated, true);

    await auditService.logEvent({
      user: sanitizeUserForClient(userDoc),
      module: 'auth',
      action: 'password_reset_request',
      recordId: userDoc.id,
      details: `Solicitud administrativa de restablecimiento de contraseña para ${cleanEmail}. Motivo: ${updated.passwordResetReason}`
    });

    return true;
  }

  /**
   * Cierra la sesión activa y registra el evento en auditoría
   */
  async logout() {
    const prevUser = this.currentUser;
    const prevOrg = this.currentOrganization;

    this.currentUser = null;
    this.currentOrganization = null;
    this.superadminSelectedOrgId = 'all';
    this._persistSessionToStorage();

    if (prevUser) {
      await auditService.logEvent({
        user: prevUser,
        organization: prevOrg,
        module: 'auth',
        action: 'logout',
        recordId: prevUser.id,
        details: 'Cierre de sesión de usuario.'
      });
    }

    events.emit('session:changed', { user: null, organization: null });
  }

  // =========================================================================
  // FUNCIONES CENTRALES REUTILIZABLES DE PERMISOS Y AISLAMIENTO (Sección 8)
  // =========================================================================

  /**
   * Determina si el usuario actual puede visualizar un registro
   */
  canViewRecord(record) {
    if (!this.isAuthenticated()) return false;
    if (this.isSuperAdmin()) {
      if (this.superadminSelectedOrgId && this.superadminSelectedOrgId !== 'all') {
        return record?.organizationId === this.superadminSelectedOrgId;
      }
      return true;
    }
    if (!record || !record.organizationId) {
      return false;
    }
    return record.organizationId === this.currentUser.organizationId;
  }

  /**
   * Determina si el usuario actual puede crear registros operativos
   */
  canCreateRecord() {
    if (!this.isAuthenticated()) return false;
    const role = this.getUserRole();
    return (
      role === USER_ROLES.SUPERADMINISTRADOR ||
      role === USER_ROLES.ADMIN_ORGANIZACION ||
      role === USER_ROLES.EDITOR
    );
  }

  /**
   * Determina si el usuario actual puede editar un registro existente
   */
  canEditRecord(record = null) {
    if (!this.isAuthenticated()) return false;
    const role = this.getUserRole();
    if (role === USER_ROLES.SUPERADMINISTRADOR) return true;
    if (role === USER_ROLES.CONSULTA) return false;
    if (role === USER_ROLES.ADMIN_ORGANIZACION || role === USER_ROLES.EDITOR) {
      if (!record || !record.organizationId) return true;
      return record.organizationId === this.currentUser.organizationId;
    }
    return false;
  }

  /**
   * Determina si el usuario actual puede eliminar un registro existente
   */
  canDeleteRecord(record = null) {
    if (!this.isAuthenticated()) return false;
    const role = this.getUserRole();
    if (role === USER_ROLES.SUPERADMINISTRADOR) return true;
    if (role === USER_ROLES.ADMIN_ORGANIZACION) {
      if (!record || !record.organizationId) return false;
      return record.organizationId === this.currentUser.organizationId;
    }
    return false;
  }

  /**
   * Filtra una lista de registros devolviendo únicamente los pertenecientes a la organización indicada (o a la activa)
   */
  getOrganizationRecords(records = [], organizationId = null) {
    if (!Array.isArray(records)) return [];
    const targetOrgId = organizationId || this.currentUser?.organizationId;
    if (!targetOrgId) return [];
    return records.filter(r => r && r.organizationId === targetOrgId);
  }

  /**
   * Devuelve los registros de todas las organizaciones (exclusivo para SUPERADMINISTRADOR)
   */
  getAllOrganizationsRecords(records = []) {
    if (!Array.isArray(records)) return [];
    if (!this.isSuperAdmin()) {
      return this.getOrganizationRecords(records);
    }
    if (this.superadminSelectedOrgId && this.superadminSelectedOrgId !== 'all') {
      return records.filter(r => r && r.organizationId === this.superadminSelectedOrgId);
    }
    return records;
  }

  /**
   * Filtro central reutilizable aplicado por los repositorios según la sesión activa
   */
  filterRecordsForCurrentSession(records = []) {
    if (!Array.isArray(records)) return [];
    if (!this.isAuthenticated()) return [];
    if (this.isSuperAdmin()) {
      return this.getAllOrganizationsRecords(records);
    }
    return this.getOrganizationRecords(records, this.currentUser.organizationId);
  }

  // =========================================================================
  // GESTIÓN DE PERFIL, CAMBIO DE CONTRASEÑA, USUARIOS Y ORGANIZACIONES
  // =========================================================================

  /**
   * Actualiza el perfil personal del usuario autenticado (sin permitir cambiar su propio rol ni organizationId)
   */
  async updateMyProfile(profileChanges) {
    if (!this.isAuthenticated()) throw new Error('Sesión no iniciada.');
    const existing = await firebaseService.getDocument(FIRESTORE_COLLECTIONS.users, this.currentUser.id);
    if (!existing) throw new Error('Usuario no encontrado en Firestore.');

    const firstName = String(profileChanges.firstName ?? existing.firstName ?? '').trim();
    const lastName = String(profileChanges.lastName ?? existing.lastName ?? '').trim();
    const email = String(profileChanges.email ?? existing.email ?? '').trim().toLowerCase();

    if (!firstName) throw new Error('El nombre es obligatorio.');
    if (!email || !email.includes('@')) throw new Error('El correo electrónico es inválido.');

    // Impedir que un usuario normal modifique su propio rol u organizationId
    const updatedUser = {
      ...existing,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      position: String(profileChanges.position ?? existing.position ?? '').trim(),
      email,
      phone: String(profileChanges.phone ?? existing.phone ?? '').trim(),
      photoDataUrl: profileChanges.photoDataUrl !== undefined ? profileChanges.photoDataUrl : (existing.photoDataUrl || ''),
      role: existing.role,
      organizationId: existing.organizationId,
      updatedAt: nowIso()
    };

    await firebaseService.setDocument(FIRESTORE_COLLECTIONS.users, existing.id, updatedUser, true);
    this.currentUser = sanitizeUserForClient(updatedUser);
    this._persistSessionToStorage();

    await auditService.logEvent({
      user: this.currentUser,
      organization: this.currentOrganization,
      module: 'profile',
      action: 'user_update',
      recordId: existing.id,
      details: `Actualización de perfil personal de ${this.currentUser.name}.`
    });

    events.emit('session:changed', { user: this.currentUser, organization: this.currentOrganization });
    return this.currentUser;
  }

  /**
   * Cambia la contraseña del usuario autenticado verificando primero su contraseña actual
   */
  async changeMyPassword(currentPassword, newPassword, confirmPassword) {
    if (!this.isAuthenticated()) throw new Error('Sesión no iniciada.');
    if (!currentPassword) throw new Error('Debe ingresar su contraseña actual.');
    if (newPassword !== confirmPassword) {
      throw new Error('La nueva contraseña y su confirmación no coinciden.');
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error(`La nueva contraseña no cumple los requisitos de seguridad: ${strength.errors.join(' ')}`);
    }

    const userDoc = await firebaseService.getDocument(FIRESTORE_COLLECTIONS.users, this.currentUser.id);
    if (!userDoc) throw new Error('No se encontró el registro del usuario en Firestore.');

    const currentValid = await verifyPasswordCredential(currentPassword, userDoc);
    if (!currentValid) {
      throw new Error('La contraseña actual ingresada no es correcta.');
    }

    const newCreds = await createPasswordCredential(newPassword);
    const updatedUser = {
      ...userDoc,
      ...newCreds,
      pendingPasswordSetup: false,
      passwordResetRequested: false,
      passwordChangedAt: nowIso(),
      updatedAt: nowIso()
    };

    await firebaseService.setDocument(FIRESTORE_COLLECTIONS.users, userDoc.id, updatedUser, true);

    await auditService.logEvent({
      user: this.currentUser,
      organization: this.currentOrganization,
      module: 'security',
      action: 'password_change',
      recordId: userDoc.id,
      details: 'Cambio de contraseña realizado exitosamente mediante verificación PBKDF2-SHA256.'
    });

    return true;
  }

  /**
   * Obtiene todas las organizaciones (o la propia si no es Superadministrador)
   */
  async getOrganizations(includeAll = false) {
    await this.ensureBaseOrganizationsInFirestore();
    const allOrgs = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.organizations);
    this.organizationsCache = allOrgs;
    if (this.isSuperAdmin() || includeAll) {
      return allOrgs;
    }
    return allOrgs.filter(o => o.id === this.currentUser?.organizationId);
  }

  /**
   * Crea o actualiza una organización y sincroniza su entrada en `public_directory`
   */
  async saveOrganization(orgData, isNew = false) {
    if (!this.isAuthenticated()) throw new Error('Sesión no iniciada.');
    const targetOrgId = orgData.id || orgData.organizationId || `org-${generateId().slice(0, 8)}`;

    if (!this.isSuperAdmin()) {
      if (!this.isOrgAdmin() || targetOrgId !== this.currentUser.organizationId) {
        throw new Error('No tiene permisos para modificar la información de esta organización.');
      }
    }

    const existing = await firebaseService.getDocument(FIRESTORE_COLLECTIONS.organizations, targetOrgId);
    const mergedOrg = {
      ...(existing || {}),
      ...orgData,
      id: targetOrgId,
      organizationId: targetOrgId,
      name: String(orgData.name || existing?.name || '').trim(),
      shortName: String(orgData.shortName ?? existing?.shortName ?? '').trim(),
      nit: String(orgData.nit ?? existing?.nit ?? '').trim(),
      organizationType: String(orgData.organizationType ?? existing?.organizationType ?? 'Organización Comunitaria').trim(),
      description: String(orgData.description ?? existing?.description ?? '').trim(),
      department: String(orgData.department ?? existing?.department ?? 'Bolívar').trim(),
      municipality: String(orgData.municipality ?? existing?.municipality ?? '').trim(),
      address: String(orgData.address ?? existing?.address ?? '').trim(),
      website: String(orgData.website ?? existing?.website ?? '').trim(),
      socialLinks: String(orgData.socialLinks ?? existing?.socialLinks ?? '').trim(),
      logoDataUrl: orgData.logoDataUrl !== undefined ? orgData.logoDataUrl : (existing?.logoDataUrl || ''),
      representativeName: String(orgData.representativeName ?? existing?.representativeName ?? '').trim(),
      representativeRole: String(orgData.representativeRole ?? existing?.representativeRole ?? '').trim(),
      institutionalEmail: String(orgData.institutionalEmail ?? existing?.institutionalEmail ?? '').trim().toLowerCase(),
      phone: String(orgData.phone ?? existing?.phone ?? '').trim(),
      whatsapp: String(orgData.whatsapp ?? existing?.whatsapp ?? '').trim(),
      workAreas: Array.isArray(orgData.workAreas)
        ? orgData.workAreas
        : String(orgData.workAreas || '').split(',').map(s => s.trim()).filter(Boolean),
      status: orgData.status || existing?.status || 'activa',
      privacySettings: {
        ...(existing?.privacySettings || {}),
        ...(orgData.privacySettings || {})
      },
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso()
    };

    if (!mergedOrg.name) {
      throw new Error('El nombre completo de la organización es obligatorio.');
    }

    await firebaseService.setDocument(FIRESTORE_COLLECTIONS.organizations, targetOrgId, mergedOrg, true);
    await firebaseService.setDocument(
      FIRESTORE_COLLECTIONS.public_directory,
      targetOrgId,
      this._buildPublicDirectoryEntry(mergedOrg),
      true
    );

    if (this.currentOrganization && this.currentOrganization.id === targetOrgId) {
      this.currentOrganization = mergedOrg;
      this._persistSessionToStorage();
    }

    await auditService.logEvent({
      user: this.currentUser,
      organization: this.currentOrganization,
      module: 'organizations',
      action: isNew ? 'organization_create' : 'organization_update',
      recordId: targetOrgId,
      targetOrganizationId: targetOrgId,
      previousValues: existing,
      newValues: mergedOrg,
      details: `${isNew ? 'Creación' : 'Actualización'} de organización "${mergedOrg.name}".`
    });

    events.emit('session:changed', { user: this.currentUser, organization: this.currentOrganization });
    return mergedOrg;
  }

  /**
   * Obtiene la lista de usuarios (filtrada por organización si es ADMIN_ORGANIZACION)
   */
  async getUsers(organizationIdFilter = null) {
    if (!this.isAuthenticated()) return [];
    const allUsers = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.users);
    const safeList = allUsers.map(u => sanitizeUserForClient(u));

    if (this.isSuperAdmin()) {
      if (organizationIdFilter && organizationIdFilter !== 'all') {
        return safeList.filter(u => u.organizationId === organizationIdFilter);
      }
      return safeList;
    }

    if (this.isOrgAdmin()) {
      return safeList.filter(u => u.organizationId === this.currentUser.organizationId);
    }

    return safeList.filter(u => u.id === this.currentUser.id);
  }

  /**
   * Crea o edita un usuario respetando la jerarquía de roles
   */
  async saveUser(userData, isNew = false) {
    if (!this.isAuthenticated()) throw new Error('Sesión no iniciada.');
    if (!this.isSuperAdmin() && !this.isOrgAdmin()) {
      throw new Error('No tiene permisos para administrar cuentas de usuario.');
    }

    const userId = userData.id || `user-${Date.now()}-${generateId().slice(0, 6)}`;
    const existing = isNew ? null : await firebaseService.getDocument(FIRESTORE_COLLECTIONS.users, userId);

    // Un administrador de organización solo puede gestionar usuarios de su propia organización
    const targetOrgId = this.isSuperAdmin()
      ? (userData.organizationId || existing?.organizationId || this.currentUser.organizationId)
      : this.currentUser.organizationId;

    if (!this.isSuperAdmin() && existing && existing.organizationId !== this.currentUser.organizationId) {
      throw new Error('No puede modificar usuarios pertenecientes a otra organización.');
    }

    // Impedir que un administrador de organización asigne el rol SUPERADMINISTRADOR
    let requestedRole = userData.role || existing?.role || USER_ROLES.CONSULTA;
    if (!this.isSuperAdmin() && requestedRole === USER_ROLES.SUPERADMINISTRADOR) {
      throw new Error('Solo el Superadministrador puede asignar el rol de Superadministrador.');
    }

    // Impedir que un usuario modifique su propio rol u organizationId
    if (existing && existing.id === this.currentUser.id && !this.isSuperAdmin()) {
      requestedRole = existing.role;
    }

    const emailClean = String(userData.email ?? existing?.email ?? '').trim().toLowerCase();
    const allUsers = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.users);
    if (emailClean) {
      const duplicateEmail = allUsers.find(u => u.id !== userId && u.email && u.email.toLowerCase() === emailClean);
      if (duplicateEmail) {
        throw new Error(`El correo electrónico "${emailClean}" ya está asignado a otro usuario.`);
      }
    }

    let credFields = {
      passwordHash: existing?.passwordHash || '',
      passwordSalt: existing?.passwordSalt || '',
      passwordAlgorithm: existing?.passwordAlgorithm || 'PBKDF2-SHA256',
      passwordIterations: existing?.passwordIterations || 120000,
      pendingPasswordSetup: existing ? Boolean(existing.pendingPasswordSetup) : true
    };

    if (userData.plainPassword && String(userData.plainPassword).trim().length > 0) {
      const strength = validatePasswordStrength(userData.plainPassword);
      if (!strength.valid) {
        throw new Error(`Contraseña inválida: ${strength.errors.join(' ')}`);
      }
      const creds = await createPasswordCredential(String(userData.plainPassword).trim());
      credFields = {
        ...creds,
        pendingPasswordSetup: false
      };
    } else if (userData.requirePasswordSetupOnNextLogin) {
      credFields.pendingPasswordSetup = true;
    }

    const orgs = await this.getOrganizations(true);
    const orgDoc = orgs.find(o => o.id === targetOrgId);
    const firstName = String(userData.firstName ?? existing?.firstName ?? '').trim();
    const lastName = String(userData.lastName ?? existing?.lastName ?? '').trim();

    if (!firstName) throw new Error('El nombre del usuario es obligatorio.');

    const updatedDoc = {
      ...(existing || {}),
      id: userId,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email: emailClean,
      position: String(userData.position ?? existing?.position ?? '').trim(),
      phone: String(userData.phone ?? existing?.phone ?? '').trim(),
      organizationId: targetOrgId,
      organizationName: orgDoc?.name || existing?.organizationName || 'Administración Central',
      role: requestedRole,
      status: userData.status || existing?.status || 'activo',
      passwordResetRequested: false,
      ...credFields,
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso()
    };

    await firebaseService.setDocument(FIRESTORE_COLLECTIONS.users, userId, updatedDoc, true);

    await auditService.logEvent({
      user: this.currentUser,
      organization: this.currentOrganization,
      module: 'users',
      action: isNew ? 'user_create' : 'user_update',
      recordId: userId,
      targetOrganizationId: targetOrgId,
      previousValues: existing,
      newValues: sanitizeUserForClient(updatedDoc),
      details: `${isNew ? 'Creación' : 'Modificación'} de usuario "${updatedDoc.name}" (${USER_ROLE_LABELS[updatedDoc.role]}).`
    });

    return sanitizeUserForClient(updatedDoc);
  }

  /**
   * Consulta exclusivamente las tarjetas institucionales autorizadas en `public_directory`
   * Disponible sin iniciar sesión.
   */
  async getPublicDirectoryEntries() {
    await this.ensureBaseOrganizationsInFirestore();
    const entries = await firebaseService.getCollection(FIRESTORE_COLLECTIONS.public_directory);
    return entries.filter(e => e.publishedInDirectory !== false && e.status !== 'suspendida');
  }
}

export const sessionService = new SessionService();

// Exportar las funciones centrales solicitadas en la Sección 8
export const getCurrentUser = () => sessionService.getCurrentUser();
export const getCurrentOrganization = () => sessionService.getCurrentOrganization();
export const getUserRole = () => sessionService.getUserRole();
export const canViewRecord = (record) => sessionService.canViewRecord(record);
export const canCreateRecord = (entityType) => sessionService.canCreateRecord(entityType);
export const canEditRecord = (record) => sessionService.canEditRecord(record);
export const canDeleteRecord = (record) => sessionService.canDeleteRecord(record);
export const getOrganizationRecords = (records, orgId) => sessionService.getOrganizationRecords(records, orgId);
export const getAllOrganizationsRecords = (records) => sessionService.getAllOrganizationsRecords(records);

