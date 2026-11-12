/**
 * Vista: Inicio de Sesión Demostrativo y Asistente de Configuración Inicial — HIDROTERRA
 * (Secciones 3 y 6)
 *
 * Incluye:
 * - Formulario de inicio de sesión con Correo Electrónico y Contraseña.
 * - Botón para mostrar/ocultar contraseña.
 * - Flujo de establecimiento inicial de contraseña para cuentas nuevas (pendingPasswordSetup).
 * - Procedimiento administrativo de recuperación/restablecimiento de contraseña.
 * - Acceso directo sin iniciar sesión al Directorio Público de Organizaciones (#directory).
 * - Asistente de configuración inicial (ejecutado una única vez) para inicializar el Superadministrador
 *   y los perfiles institucionales de las organizaciones presentes en los datos reales.
 */

import { APP_CONFIG } from '../../config/app.config.js';
import {
  sessionService,
  IDENTIFIED_BASE_ORGANIZATIONS
} from '../../core/session.service.js';
import { validatePasswordStrength } from '../../core/crypto-auth.js';
import { escapeHtml } from '../../core/validators.js';
import { notification } from '../components/notification.js';

export class LoginView {
  constructor(router) {
    this.router = router;
    this.mode = 'login'; // 'login' | 'setup_wizard' | 'first_password' | 'reset_request'
    this.setupComplete = true;
    this.pendingEmail = '';
  }

  async render(container) {
    container.innerHTML = `
      <div style="min-height: 82vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-4);">
        <div class="card" style="max-width: 480px; width: 100%; padding: var(--spacing-6); text-align: center;">
          <p class="text-muted" style="margin: 0;">Verificando conexión con Firebase Firestore y estado de cuentas...</p>
        </div>
      </div>
    `;

    try {
      this.setupComplete = await sessionService.isInitialSetupCompleted();
      if (!this.setupComplete) {
        this.mode = 'setup_wizard';
      }
    } catch {
      this.setupComplete = false;
    }

    this._renderCurrentMode(container);
  }

  _renderCurrentMode(container) {
    if (this.mode === 'setup_wizard') {
      this._renderSetupWizard(container);
      return;
    }
    if (this.mode === 'first_password') {
      this._renderFirstPasswordSetup(container);
      return;
    }
    if (this.mode === 'reset_request') {
      this._renderPasswordResetRequest(container);
      return;
    }
    this._renderLoginCard(container);
  }

  _renderLoginCard(container) {
    container.innerHTML = `
      <div class="login-screen-wrapper" style="min-height: 82vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--spacing-4);">
        <div class="card" style="max-width: 480px; width: 100%; border-top: 4px solid var(--color-green-700); box-shadow: var(--shadow-elevated);">
          <div class="card-body" style="padding: var(--spacing-6);">
            <div style="text-align: center; margin-bottom: var(--spacing-5);">
              <img src="./assets/icons/icon-192.svg" alt="${escapeHtml(APP_CONFIG.name)}" style="width: 64px; height: 64px; margin: 0 auto 10px;" />
              <h2 style="margin: 0; color: var(--color-neutral-900); font-weight: 700;">${escapeHtml(APP_CONFIG.name)}</h2>
              <p style="margin: 4px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Plataforma Multiorganización de Monitoreo Hídrico Rural — Montes de María
              </p>
            </div>

            <div id="login-error-box" class="alert alert-danger" style="display: none; font-size: var(--font-size-xs); padding: 10px 12px; margin-bottom: var(--spacing-4); border-radius: var(--radius-md); background-color: var(--color-danger-bg); color: var(--color-danger); border: 1px solid rgba(220, 38, 38, 0.25);"></div>

            <form id="form-login" novalidate>
              <div class="form-group mb-3">
                <label class="form-label" for="login-email">Correo electrónico institucional o de usuario</label>
                <input type="email" id="login-email" class="form-control" placeholder="usuario@organizacion.org" value="${escapeHtml(this.pendingEmail)}" required autocomplete="username" />
              </div>

              <div class="form-group mb-3">
                <label class="form-label" for="login-password">Contraseña</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <input type="password" id="login-password" class="form-control" placeholder="Ingrese su contraseña" required autocomplete="current-password" style="flex: 1;" />
                  <button type="button" class="btn btn-outline btn-sm" id="btn-toggle-pwd" style="white-space: nowrap;">
                    <span>Mostrar</span>
                  </button>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: var(--spacing-4); font-size: var(--font-size-xs);">
                <button type="button" class="btn btn-outline btn-sm" id="btn-go-first-password" style="font-size: 0.76rem; padding: 4px 8px;">
                  <span>Establecer contraseña inicial</span>
                </button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-go-reset-pwd" style="font-size: 0.76rem; padding: 4px 8px;">
                  <span>Recuperar contraseña</span>
                </button>
              </div>

              <button type="submit" class="btn btn-primary w-100" id="btn-submit-login" style="width: 100%; padding: 0.7rem;">
                <span id="login-btn-text">Iniciar sesión</span>
              </button>
            </form>

            <hr style="margin: var(--spacing-4) 0; border-color: var(--color-neutral-200);" />

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button type="button" class="btn btn-outline w-100" id="btn-open-public-directory" style="width: 100%;">
                <span>Consultar Directorio Público de Organizaciones</span>
              </button>

              ${!this.setupComplete ? `
                <button type="button" class="btn btn-blue btn-sm w-100" id="btn-open-setup-wizard" style="width: 100%;">
                  <span>Ejecutar Asistente de Configuración Inicial (Primera Vez)</span>
                </button>
              ` : ''}
            </div>

            <div style="margin-top: var(--spacing-4); padding: 10px 12px; background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); font-size: 0.73rem; color: var(--color-neutral-600); line-height: 1.45;">
              <strong>Nota académica y demostrativa:</strong> Este sistema valida credenciales mediante derivación criptográfica local <code>PBKDF2-SHA256</code> (Web Crypto API) y consultas demostrativas a Firebase Firestore. No constituye un servicio de autenticación de producción.
            </div>
          </div>
        </div>
      </div>
    `;

    const form = container.querySelector('#form-login');
    const emailInput = container.querySelector('#login-email');
    const pwdInput = container.querySelector('#login-password');
    const togglePwdBtn = container.querySelector('#btn-toggle-pwd');
    const errorBox = container.querySelector('#login-error-box');
    const submitBtn = container.querySelector('#btn-submit-login');
    const submitText = container.querySelector('#login-btn-text');

    if (togglePwdBtn && pwdInput) {
      togglePwdBtn.addEventListener('click', () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        togglePwdBtn.innerHTML = `<span>${isPwd ? 'Ocultar' : 'Mostrar'}</span>`;
      });
    }

    container.querySelector('#btn-go-first-password')?.addEventListener('click', () => {
      this.pendingEmail = emailInput?.value || '';
      this.mode = 'first_password';
      this._renderCurrentMode(container);
    });

    container.querySelector('#btn-go-reset-pwd')?.addEventListener('click', () => {
      this.pendingEmail = emailInput?.value || '';
      this.mode = 'reset_request';
      this._renderCurrentMode(container);
    });

    container.querySelector('#btn-open-public-directory')?.addEventListener('click', () => {
      this.router.navigate('directory');
    });

    container.querySelector('#btn-open-setup-wizard')?.addEventListener('click', () => {
      this.mode = 'setup_wizard';
      this._renderCurrentMode(container);
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.style.display = 'none';

      const email = emailInput?.value || '';
      const password = pwdInput?.value || '';

      try {
        if (submitBtn) submitBtn.disabled = true;
        if (submitText) submitText.textContent = 'Verificando credenciales en Firestore...';

        await sessionService.login(email, password);
        notification.success('Bienvenido a HIDROTERRA', 'Sesión iniciada correctamente.');
        this.router.navigate('dashboard');
      } catch (err) {
        if (err.code === 'PENDING_PASSWORD_SETUP') {
          this.pendingEmail = err.userEmail || email;
          this.mode = 'first_password';
          this._renderCurrentMode(container);
          notification.info(
            'Establecimiento de contraseña requerido',
            'Su cuenta inicial está activa. Defina su contraseña personal para continuar.'
          );
          return;
        }
        if (errorBox) {
          errorBox.textContent = err.message || 'Error al iniciar sesión.';
          errorBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = 'Iniciar sesión';
      }
    });
  }

  _renderFirstPasswordSetup(container) {
    container.innerHTML = `
      <div style="min-height: 82vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-4);">
        <div class="card" style="max-width: 480px; width: 100%; border-top: 4px solid var(--color-blue-700);">
          <div class="card-body" style="padding: var(--spacing-6);">
            <h3 style="margin: 0 0 6px; color: var(--color-neutral-900);">Establecer Contraseña Inicial</h3>
            <p style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin-bottom: var(--spacing-4);">
              Si el administrador central creó su cuenta o autorizó el establecimiento de contraseña, defina aquí su clave personal (se almacenará únicamente el hash <code>PBKDF2-SHA256</code> con sal aleatoria).
            </p>

            <div id="first-pwd-error" style="display: none; padding: 10px 12px; margin-bottom: var(--spacing-3); border-radius: var(--radius-md); background-color: var(--color-danger-bg); color: var(--color-danger); font-size: var(--font-size-xs);"></div>

            <form id="form-first-password">
              <div class="form-group mb-3">
                <label class="form-label">Correo electrónico de la cuenta</label>
                <input type="email" id="fp-email" class="form-control" value="${escapeHtml(this.pendingEmail)}" required />
              </div>
              <div class="form-group mb-3">
                <label class="form-label">Nueva contraseña (mínimo 8 caracteres, letras y números)</label>
                <input type="password" id="fp-new" class="form-control" required />
              </div>
              <div class="form-group mb-4">
                <label class="form-label">Confirmar nueva contraseña</label>
                <input type="password" id="fp-confirm" class="form-control" required />
              </div>

              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline" id="btn-fp-back" style="flex: 1;">
                  <span>Volver</span>
                </button>
                <button type="submit" class="btn btn-primary" id="btn-fp-submit" style="flex: 2;">
                  <span>Guardar Contraseña e Ingresar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#btn-fp-back')?.addEventListener('click', () => {
      this.mode = 'login';
      this._renderCurrentMode(container);
    });

    container.querySelector('#form-first-password')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = container.querySelector('#first-pwd-error');
      if (errBox) errBox.style.display = 'none';

      const email = container.querySelector('#fp-email')?.value || '';
      const newPwd = container.querySelector('#fp-new')?.value || '';
      const confirmPwd = container.querySelector('#fp-confirm')?.value || '';
      const submitBtn = container.querySelector('#btn-fp-submit');

      try {
        if (submitBtn) submitBtn.disabled = true;
        await sessionService.setupInitialAccountPassword(email, newPwd, confirmPwd);
        notification.success('Contraseña establecida', 'Su contraseña ha sido configurada y la sesión fue iniciada.');
        this.router.navigate('dashboard');
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message;
          errBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  _renderPasswordResetRequest(container) {
    container.innerHTML = `
      <div style="min-height: 82vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-4);">
        <div class="card" style="max-width: 480px; width: 100%; border-top: 4px solid var(--color-earth-700);">
          <div class="card-body" style="padding: var(--spacing-6);">
            <h3 style="margin: 0 0 6px; color: var(--color-neutral-900);">Restablecimiento Administrativo de Contraseña</h3>
            <p style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin-bottom: var(--spacing-4);">
              Al no emplear servicios de correo transaccional externos, la solicitud queda registrada en Firestore para que el Administrador de su Organización o el Superadministrador habilite el restablecimiento de su clave.
            </p>

            <div id="reset-msg-box" style="display: none; padding: 10px 12px; margin-bottom: var(--spacing-3); border-radius: var(--radius-md); font-size: var(--font-size-xs);"></div>

            <form id="form-reset-request">
              <div class="form-group mb-3">
                <label class="form-label">Correo electrónico registrado</label>
                <input type="email" id="reset-email" class="form-control" value="${escapeHtml(this.pendingEmail)}" required />
              </div>
              <div class="form-group mb-4">
                <label class="form-label">Observación o motivo de la solicitud</label>
                <input type="text" id="reset-reason" class="form-control" placeholder="Ej. Olvido de clave en equipo de campo" required />
              </div>

              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline" id="btn-reset-back" style="flex: 1;">
                  <span>Volver al Inicio</span>
                </button>
                <button type="submit" class="btn btn-primary" id="btn-reset-submit" style="flex: 2;">
                  <span>Registrar Solicitud</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#btn-reset-back')?.addEventListener('click', () => {
      this.mode = 'login';
      this._renderCurrentMode(container);
    });

    container.querySelector('#form-reset-request')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msgBox = container.querySelector('#reset-msg-box');
      const email = container.querySelector('#reset-email')?.value || '';
      const reason = container.querySelector('#reset-reason')?.value || '';
      const btn = container.querySelector('#btn-reset-submit');

      try {
        if (btn) btn.disabled = true;
        await sessionService.requestAdministrativePasswordReset(email, reason);
        if (msgBox) {
          msgBox.style.display = 'block';
          msgBox.style.backgroundColor = 'var(--color-green-50)';
          msgBox.style.color = 'var(--color-green-800)';
          msgBox.textContent = 'Solicitud registrada en Firestore. El administrador puede autorizar el restablecimiento desde Gestión de Usuarios.';
        }
      } catch (err) {
        if (msgBox) {
          msgBox.style.display = 'block';
          msgBox.style.backgroundColor = 'var(--color-danger-bg)';
          msgBox.style.color = 'var(--color-danger)';
          msgBox.textContent = err.message;
        }
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  _renderSetupWizard(container) {
    container.innerHTML = `
      <div style="padding: var(--spacing-4) 0; max-width: 880px; margin: 0 auto;">
        <div class="card" style="border-top: 5px solid var(--color-green-700);">
          <div class="card-header">
            <div>
              <h3 class="card-title">Asistente de Configuración Inicial — HIDROTERRA Multiorganización</h3>
              <p class="card-subtitle">
                Inicialización única del Superadministrador y de las organizaciones identificadas en los datos reales del proyecto (sin contraseñas fijas en el código fuente).
              </p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" id="btn-wizard-to-login">
              <span>Ir a Iniciar Sesión</span>
            </button>
          </div>

          <div class="card-body">
            <div id="wizard-error-box" style="display: none; padding: 12px; margin-bottom: var(--spacing-4); border-radius: var(--radius-md); background-color: var(--color-danger-bg); color: var(--color-danger); font-size: var(--font-size-xs);"></div>

            <form id="form-initial-setup">
              <div style="background-color: var(--color-neutral-50); padding: var(--spacing-4); border-radius: var(--radius-md); border: 1px solid var(--color-neutral-200); margin-bottom: var(--spacing-4);">
                <h4 style="margin: 0 0 8px; font-size: var(--font-size-base); color: var(--color-neutral-900);">
                  1. Crear Cuenta de Superadministrador Central
                </h4>
                <p style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin-bottom: var(--spacing-3);">
                  Defina las credenciales del Superadministrador. Su contraseña será procesada mediante <code>PBKDF2-SHA256</code> con sal aleatoria de 16 bytes y 120,000 iteraciones antes de guardarse en Firestore.
                </p>

                <div class="form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Nombres del Superadministrador *</label>
                    <input type="text" id="wiz-sa-first" class="form-control" value="José Félix" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Apellidos *</label>
                    <input type="text" id="wiz-sa-last" class="form-control" value="Ibáñez Romero" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Correo electrónico del Superadministrador *</label>
                    <input type="email" id="wiz-sa-email" class="form-control" placeholder="admin@hidroterra.org" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Teléfono (opcional)</label>
                    <input type="text" id="wiz-sa-phone" class="form-control" placeholder="Ej. +57 300..." />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Contraseña del Superadministrador *</label>
                    <input type="password" id="wiz-sa-pwd" class="form-control" placeholder="Mínimo 8 caracteres, mayúscula, minúscula y número" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Confirmar contraseña *</label>
                    <input type="password" id="wiz-sa-pwd2" class="form-control" placeholder="Repita la contraseña" required />
                  </div>
                </div>
              </div>

              <div style="background-color: var(--color-neutral-50); padding: var(--spacing-4); border-radius: var(--radius-md); border: 1px solid var(--color-neutral-200); margin-bottom: var(--spacing-4);">
                <h4 style="margin: 0 0 8px; font-size: var(--font-size-base); color: var(--color-neutral-900);">
                  2. Organizaciones Identificadas en los Registros Existentes (${IDENTIFIED_BASE_ORGANIZATIONS.length})
                </h4>
                <p style="font-size: var(--font-size-xs); color: var(--color-neutral-600); margin-bottom: var(--spacing-3);">
                  Estas organizaciones provienen directamente de las fuentes hídricas, pluviómetros y comunidades registradas en HIDROTERRA. Como los datos originales no incluían correos electrónicos, puede completarlos aquí (o dejarlos en blanco para asignarlos después desde el panel administrativo) y opcionalmente asignar su contraseña inicial.
                </p>

                <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
                  ${IDENTIFIED_BASE_ORGANIZATIONS.map(org => `
                    <div class="card" style="margin: 0; padding: var(--spacing-3); border: 1px solid var(--color-neutral-200);">
                      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                        <div>
                          <strong style="color: var(--color-neutral-900);">${escapeHtml(org.name)}</strong>
                          <span class="badge badge-info" style="margin-left: 6px;">${escapeHtml(org.municipality)}, ${escapeHtml(org.department)}</span>
                        </div>
                        <span style="font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                          Responsable identificado: <strong>${escapeHtml(org.representativeName)}</strong>
                        </span>
                      </div>
                      <div class="form-grid-2">
                        <div class="form-group" style="margin-bottom: 0;">
                          <label class="form-label">Correo electrónico del administrador (completar si se conoce)</label>
                          <input type="email" class="form-control wiz-org-email" data-org-id="${escapeHtml(org.id)}" placeholder="Pendiente de completar por el administrador" />
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                          <label class="form-label">Contraseña inicial (o dejar vacía para que el usuario la establezca al primer ingreso)</label>
                          <input type="password" class="form-control wiz-org-pwd" data-org-id="${escapeHtml(org.id)}" placeholder="Dejar vacío para establecimiento inicial guiado" />
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="d-flex justify-between align-center" style="gap: 12px; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline" id="btn-wiz-directory">
                  <span>Ver Directorio Público</span>
                </button>
                <button type="submit" class="btn btn-primary" id="btn-wiz-submit">
                  <span>Inicializar Sistema en Firestore y Crear Cuentas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#btn-wizard-to-login')?.addEventListener('click', () => {
      this.mode = 'login';
      this._renderCurrentMode(container);
    });

    container.querySelector('#btn-wiz-directory')?.addEventListener('click', () => {
      this.router.navigate('directory');
    });

    container.querySelector('#form-initial-setup')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = container.querySelector('#wizard-error-box');
      if (errBox) errBox.style.display = 'none';

      const firstName = container.querySelector('#wiz-sa-first')?.value || '';
      const lastName = container.querySelector('#wiz-sa-last')?.value || '';
      const email = container.querySelector('#wiz-sa-email')?.value || '';
      const phone = container.querySelector('#wiz-sa-phone')?.value || '';
      const pwd = container.querySelector('#wiz-sa-pwd')?.value || '';
      const pwd2 = container.querySelector('#wiz-sa-pwd2')?.value || '';
      const submitBtn = container.querySelector('#btn-wiz-submit');

      if (pwd !== pwd2) {
        if (errBox) {
          errBox.textContent = 'Las contraseñas del Superadministrador no coinciden.';
          errBox.style.display = 'block';
        }
        return;
      }

      const orgAdmins = IDENTIFIED_BASE_ORGANIZATIONS.map(org => {
        const emailEl = container.querySelector(`.wiz-org-email[data-org-id="${org.id}"]`);
        const pwdEl = container.querySelector(`.wiz-org-pwd[data-org-id="${org.id}"]`);
        return {
          organizationId: org.id,
          representativeName: org.representativeName,
          email: emailEl?.value || '',
          initialPassword: pwdEl?.value || ''
        };
      });

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Guardando organizaciones y hashes PBKDF2 en Firestore...</span>';
        }

        await sessionService.completeInitialSetupWizard({
          superadminFirstName: firstName,
          superadminLastName: lastName,
          superadminEmail: email,
          superadminPhone: phone,
          superadminPassword: pwd,
          organizationAdmins: orgAdmins
        });

        notification.success(
          'Configuración Inicial Completada',
          'Se han creado las organizaciones y la cuenta de Superadministrador en Firestore.'
        );
        this.router.navigate('superadmin');
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message;
          errBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Inicializar Sistema en Firestore y Crear Cuentas</span>';
        }
      }
    });
  }
}

