/**
 * Pruebas unitarias: Sistema Multiorganización, Hashing PBKDF2-SHA256, Roles y Sincronización Firestore
 */

import {
  createPasswordCredential,
  verifyPasswordCredential,
  validatePasswordStrength,
  PBKDF2_ALGORITHM,
  PBKDF2_ITERATIONS
} from '../src/core/crypto-auth.js';
import {
  sessionService,
  ROLES,
  IDENTIFIED_BASE_ORGANIZATIONS,
  canViewRecord,
  canCreateRecord,
  canEditRecord,
  canDeleteRecord
} from '../src/core/session.service.js';
import { firebaseSyncService } from '../src/application/firebase-sync.service.js';

export function runMultiOrgAuthTests(suite) {
  suite.test('Web Crypto PBKDF2-SHA256: Genera hash y sal aleatoria única y verifica contraseña de forma segura', async (assert) => {
    const cred1 = await createPasswordCredential('HidroTerra2026!');
    const cred2 = await createPasswordCredential('HidroTerra2026!');

    assert.strictEqual(cred1.passwordAlgorithm, PBKDF2_ALGORITHM, 'Algoritmo PBKDF2-SHA256 registrado');
    assert.strictEqual(cred1.passwordIterations, PBKDF2_ITERATIONS, '120,000 iteraciones configuradas');
    assert.ok(cred1.passwordHash && cred1.passwordHash.length === 64, 'Hash SHA-256 de 64 caracteres hex');
    assert.ok(cred1.passwordSalt && cred1.passwordSalt.length === 32, 'Sal aleatoria de 16 bytes (32 hex)');
    assert.ok(cred1.passwordSalt !== cred2.passwordSalt, 'Sales individuales distintas por cada generación');
    assert.ok(cred1.passwordHash !== cred2.passwordHash, 'Hashes distintos para la misma clave con distinta sal');

    const validCheck = await verifyPasswordCredential('HidroTerra2026!', cred1);
    const invalidCheck = await verifyPasswordCredential('ClaveIncorrecta99', cred1);

    assert.strictEqual(validCheck, true, 'Verifica correctamente la contraseña original');
    assert.strictEqual(invalidCheck, false, 'Rechaza contraseña incorrecta');
  });

  suite.test('Validación de fortaleza de contraseña: Exige mínimo 8 caracteres con letras y números', (assert) => {
    const weak = validatePasswordStrength('abc12');
    const noNumber = validatePasswordStrength('sololetraslargas');
    const strong = validatePasswordStrength('MontesMaria2026');

    assert.strictEqual(weak.valid, false, 'Rechaza contraseña corta');
    assert.strictEqual(noNumber.valid, false, 'Rechaza contraseña sin números');
    assert.strictEqual(strong.valid, true, 'Acepta contraseña segura');
  });

  suite.test('Organizaciones base identificadas: Extraídas de los registros reales sin inventar correos', (assert) => {
    assert.strictEqual(IDENTIFIED_BASE_ORGANIZATIONS.length, 4, '4 organizaciones reales identificadas en Montes de María');
    const orgIds = IDENTIFIED_BASE_ORGANIZATIONS.map(o => o.organizationId);
    assert.ok(orgIds.includes('org-comite-agua-caracoli'), 'Incluye Comité Comunitario de Agua de Caracolí');
    assert.ok(orgIds.includes('org-asociacion-las-palmas'), 'Incluye Asociación Agropecuaria de Las Palmas');
    assert.ok(orgIds.includes('org-comite-ambiental-colorados'), 'Incluye Comité Ambiental de Los Colorados');
    assert.ok(orgIds.includes('org-jac-canutalito'), 'Incluye Junta de Acción Comunal de Canutalito');

    // Verificar que no se inventaron correos electrónicos institucionales
    IDENTIFIED_BASE_ORGANIZATIONS.forEach(org => {
      assert.strictEqual(org.institutionalEmail, '', `Correo institucional vacío pendiente de completar en ${org.shortName}`);
    });
  });

  suite.test('Permisos por Rol y Aislamiento por organizationId: Verifica SUPERADMINISTRADOR, ADMIN_ORGANIZACION, EDITOR y CONSULTA', (assert) => {
    const prevUser = sessionService.currentUser;
    const prevOrg = sessionService.currentOrganization;

    try {
      const recOrgA = { id: 'r1', organizationId: 'org-comite-agua-caracoli' };
      const recOrgB = { id: 'r2', organizationId: 'org-asociacion-las-palmas' };

      // 1. Rol CONSULTA en Org A
      sessionService.currentUser = { id: 'u-consulta', role: ROLES.CONSULTA, organizationId: 'org-comite-agua-caracoli' };
      sessionService.currentOrganization = { id: 'org-comite-agua-caracoli', organizationId: 'org-comite-agua-caracoli', name: 'Caracolí' };
      assert.strictEqual(canViewRecord(recOrgA), true, 'CONSULTA puede ver registros de su organización');
      assert.strictEqual(canViewRecord(recOrgB), false, 'CONSULTA no puede ver registros de otra organización');
      assert.strictEqual(canCreateRecord('rainfall_records'), false, 'CONSULTA no puede crear registros');
      assert.strictEqual(canEditRecord(recOrgA), false, 'CONSULTA no puede editar registros');
      assert.strictEqual(canDeleteRecord(recOrgA), false, 'CONSULTA no puede eliminar registros');

      // 2. Rol EDITOR en Org A
      sessionService.currentUser = { id: 'u-editor', role: ROLES.EDITOR, organizationId: 'org-comite-agua-caracoli' };
      assert.strictEqual(canCreateRecord('rainfall_records'), true, 'EDITOR puede crear registros en su organización');
      assert.strictEqual(canEditRecord(recOrgA), true, 'EDITOR puede editar registros de su organización');
      assert.strictEqual(canEditRecord(recOrgB), false, 'EDITOR no puede editar registros de otra organización');
      assert.strictEqual(canDeleteRecord(recOrgA), false, 'EDITOR no puede eliminar registros');

      // 3. Rol ADMIN_ORGANIZACION en Org A
      sessionService.currentUser = { id: 'u-admin', role: ROLES.ADMIN_ORGANIZACION, organizationId: 'org-comite-agua-caracoli' };
      assert.strictEqual(canDeleteRecord(recOrgA), true, 'ADMIN_ORGANIZACION puede eliminar registros de su organización');
      assert.strictEqual(canDeleteRecord(recOrgB), false, 'ADMIN_ORGANIZACION no puede eliminar registros de otra organización');

      // 4. Rol SUPERADMINISTRADOR
      sessionService.currentUser = { id: 'u-super', role: ROLES.SUPERADMINISTRADOR, organizationId: 'org-admin-central' };
      sessionService.currentOrganization = { id: 'org-admin-central', organizationId: 'org-admin-central', name: 'Administración Central' };
      assert.strictEqual(canViewRecord(recOrgA), true, 'SUPERADMINISTRADOR puede ver Org A');
      assert.strictEqual(canViewRecord(recOrgB), true, 'SUPERADMINISTRADOR puede ver Org B');
      assert.strictEqual(canEditRecord(recOrgB), true, 'SUPERADMINISTRADOR puede editar cualquier organización');
      assert.strictEqual(canDeleteRecord(recOrgB), true, 'SUPERADMINISTRADOR puede eliminar en cualquier organización');
    } finally {
      sessionService.currentUser = prevUser;
      sessionService.currentOrganization = prevOrg;
    }
  });

  suite.test('Inferencia de organizationId para migración a Firestore: Clasifica registros existentes con certeza', (assert) => {
    const infSite = firebaseSyncService.inferOrganizationForRecord('sites', {
      id: 'site-carmen-caracoli',
      name: 'Vereda Caracolí'
    });
    assert.strictEqual(infSite.organizationId, 'org-comite-agua-caracoli', 'Asocia site-carmen-caracoli a Comité de Agua de Caracolí');
    assert.strictEqual(infSite.certainty, 'alta', 'Certeza alta por sitio conocido');

    const infUnknown = firebaseSyncService.inferOrganizationForRecord('water_sources', {
      id: 'ws-sin-org',
      name: 'Fuente aislada sin comunidad'
    });
    assert.strictEqual(infUnknown.organizationId, null, 'Deja pendiente de asignación cuando no hay vínculo identificable');
  });
}

