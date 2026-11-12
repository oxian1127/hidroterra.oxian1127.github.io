/**
 * Vista: Acerca de y Manual de Uso (About & User Manual View)
 * Información institucional del proyecto, descripción de la plataforma y guía operativa paso a paso.
 */

import { APP_CONFIG } from '../../config/app.config.js';
import { DB_CONFIG } from '../../config/database.config.js';
import { escapeHtml } from '../../core/validators.js';

export class AboutView {
  constructor(router) {
    this.router = router;
    this.activeTab = 'project'; // 'project' | 'manual' | 'faq'
  }

  async render(container, params = {}) {
    if (params.tab && ['project', 'manual', 'faq'].includes(params.tab)) {
      this.activeTab = params.tab;
    }

    container.innerHTML = `
      <div class="about-view">
        <!-- Encabezado de la vista -->
        <div class="view-header d-flex justify-between align-center mb-4" style="flex-wrap: wrap; gap: var(--spacing-3);">
          <div>
            <h2>Acerca de ${escapeHtml(APP_CONFIG.name)} y Manual de Uso</h2>
            <p class="text-muted">Información general del proyecto, arquitectura de la plataforma y guía operativa paso a paso para el monitoreo hídrico comunitario.</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline btn-sm" id="btn-about-print" title="Imprimir manual de uso">
              <span>Imprimir Guía</span>
            </button>
            <button class="btn btn-primary btn-sm" id="btn-about-go-dashboard">
              <span>Ir al Panel</span>
            </button>
          </div>
        </div>

        <!-- Banner Hero Institucional del Proyecto -->
        <div class="card mb-4" style="border-left: 5px solid var(--color-green-700);">
          <div class="card-body" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-5);">
            <div style="display: flex; align-items: center; gap: var(--spacing-4); max-width: 760px;">
              <img src="./assets/icons/icon-192.svg" alt="${escapeHtml(APP_CONFIG.name)}" style="width: 68px; height: 68px; flex-shrink: 0;" />
              <div>
                <div style="display: flex; align-items: center; gap: var(--spacing-2); flex-wrap: wrap; margin-bottom: 6px;">
                  <span class="badge badge-success"><i class="fa-solid fa-droplet"></i> Proyecto Agua — Montes de María</span>
                  <span class="badge badge-info">Versión ${escapeHtml(APP_CONFIG.version)} (PWA Offline-First)</span>
                </div>
                <h3 style="font-size: var(--font-size-xl); margin-bottom: 6px; color: var(--color-neutral-900);">
                  ${escapeHtml(APP_CONFIG.name)} — ${escapeHtml(APP_CONFIG.fullName)}
                </h3>
                <p style="font-size: var(--font-size-sm); color: var(--color-neutral-600); line-height: 1.55; margin: 0;">
                  <em>«Datos de hoy para un territorio con agua mañana»</em>. Herramienta tecnológica comunitaria diseñada para el registro autónomo, seguimiento pluviométrico, inventario de fuentes hídricas y análisis agroproductivo en zonas rurales de los Montes de María, Colombia.
                </p>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; font-size: var(--font-size-xs); color: var(--color-neutral-600); background-color: var(--color-neutral-50); padding: var(--spacing-3) var(--spacing-4); border-radius: var(--radius-md); border: 1px solid var(--color-neutral-200);">
              <div><i class="fa-solid fa-location-dot" style="color: var(--color-green-700); width: 16px;"></i> <strong>Región:</strong> ${escapeHtml(APP_CONFIG.geo.regionName)}, Colombia</div>
              <div><i class="fa-solid fa-database" style="color: var(--color-blue-700); width: 16px;"></i> <strong>Motor Híbrido:</strong> IndexedDB (${escapeHtml(DB_CONFIG.name)} v${DB_CONFIG.version}) + Firebase Firestore (<code>nam5</code>)</div>
              <div><i class="fa-solid fa-wifi" style="color: var(--color-green-700); width: 16px;"></i> <strong>Operación:</strong> Autónoma Offline-First + Sincronización Multiorganización</div>
              <div><strong>Desarrollado por:</strong> José Félix Ibáñez Romero. Ing. de Sistemas</div>
            </div>
          </div>
        </div>

        <!-- Pestañas de Navegación Interna -->
        <div class="nav-tabs" role="tablist">
          <button class="nav-tab-btn ${this.activeTab === 'project' ? 'active' : ''}" data-tab="project" role="tab">
            Información del Proyecto y Plataforma
          </button>
          <button class="nav-tab-btn ${this.activeTab === 'manual' ? 'active' : ''}" data-tab="manual" role="tab">
            Manual de Uso Paso a Paso
          </button>
          <button class="nav-tab-btn ${this.activeTab === 'faq' ? 'active' : ''}" data-tab="faq" role="tab">
            Preguntas Frecuentes y Consejos de Campo
          </button>
        </div>

        <!-- Contenido Dinámico según Pestaña -->
        <div id="about-tab-content">
          ${this._renderTabContent()}
        </div>
      </div>
    `;

    this._bindEvents(container);
  }

  _renderTabContent() {
    if (this.activeTab === 'manual') {
      return this._renderManualTab();
    }
    if (this.activeTab === 'faq') {
      return this._renderFaqTab();
    }
    return this._renderProjectTab();
  }

  _renderProjectTab() {
    return `
      <!-- 1. Propósito e Información del Proyecto -->
      <div class="dashboard-visual-grid mb-4">
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div>
              <h3 class="card-title"><i class="fa-solid fa-seedling" style="color: var(--color-green-700); margin-right: 6px;"></i> Sobre el Proyecto Territorial</h3>
              <p class="card-subtitle">Contexto social, ambiental y productivo en Montes de María</p>
            </div>
          </div>
          <div class="card-body" style="font-size: var(--font-size-sm); line-height: 1.65; color: var(--color-neutral-700);">
            <p style="margin-bottom: var(--spacing-3);">
              El proyecto de monitoreo hídrico rural en <strong>Montes de María (Bolívar y Sucre, Colombia)</strong> surge para fortalecer la gobernanza comunitaria del agua, la adaptación climática y la toma de decisiones productivas de las familias campesinas y monitores locales.
            </p>
            <p style="margin-bottom: var(--spacing-3);">
              En territorios rurales donde el acceso a conectividad móvil es limitado o intermitente y las lluvias presentan alta variabilidad entre veredas, contar con registros sistemáticos de <strong>precipitación en milímetros (mm)</strong> y del estado de pozos, arroyos, manantiales, jagüeyes y reservorios permite planificar mejor los ciclos de siembra (ñame, yuca, maíz, plátano, hortalizas) y prevenir riesgos por déficit hídrico o exceso de lluvias.
            </p>
            <div style="background-color: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-3) var(--spacing-4); margin-top: var(--spacing-3);">
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 6px;">
                <i class="fa-solid fa-bullseye" style="color: var(--color-green-700);"></i> Objetivos Clave del Sistema:
              </strong>
              <ul style="padding-left: 1.2rem; margin: 0;">
                <li>Consolidar una red comunitaria de pluviómetros y fuentes de agua georreferenciadas.</li>
                <li>Facilitar la captura de datos en campo desde teléfonos móviles, tabletas o computadores sin depender de Internet.</li>
                <li>Generar reportes claros, gráficas de comportamiento de lluvias y respaldos portables para socialización comunitaria y técnica.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div>
              <h3 class="card-title"><i class="fa-solid fa-laptop-code" style="color: var(--color-blue-700); margin-right: 6px;"></i> Descripción de la Página y Arquitectura</h3>
              <p class="card-subtitle">Tecnología Web Progresiva (PWA) con enfoque Offline-First</p>
            </div>
          </div>
          <div class="card-body" style="font-size: var(--font-size-sm); line-height: 1.65; color: var(--color-neutral-700);">
            <p style="margin-bottom: var(--spacing-3);">
              <strong>${escapeHtml(APP_CONFIG.name)}</strong> es una Aplicación Web Progresiva (PWA) de código modular que funciona directamente en el navegador del dispositivo sin requerir servidores externos ni suscripciones en la nube para su operación diaria.
            </p>
            <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-hard-drive" style="color: var(--color-green-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Base de Datos Local Persistente (IndexedDB v3)</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Toda la información se guarda de forma segura en el almacenamiento interno del navegador mediante almacenes relacionales para fuentes, mediciones hídricas, alertas, pluviómetros, lluvias, sitios, parcelas, cultivos, observaciones y cola de sincronización.
                  </p>
                </div>
              </div>

              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-water" style="color: var(--color-blue-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Monitoreo de Disponibilidad, Calculadoras y Alertas Hídricas</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Seguimiento periódico de niveles y volúmenes disponibles por fuente (diferenciando volumen observado y estimado), calculadoras de captación pluvial (<code>V = P × A × C</code>), geometrías de almacenamiento, balance hídrico, autonomía y alertas tempranas configurables.
                  </p>
                </div>
              </div>

              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-satellite-dish" style="color: var(--color-blue-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Georreferenciación GPS Nativa y Mapas Interactivos</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Captura coordenadas WGS84 usando el chip GPS del dispositivo incluso sin datos móviles, valida que estén dentro de Montes de María y representa en el mapa el estado de disponibilidad por colores.
                  </p>
                </div>
              </div>

              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-cloud-sun-rain" style="color: var(--color-blue-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">HIDROTERRA CLIMA y Vinculación Clima – Agua</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Pronóstico horario (24 h) y diario (7 días), evapotranspiración FAO ET₀, alertas agroclimáticas, contraste entre lluvia real medida y modelo numérico, y cruce con el potencial de recarga de fuentes hídricas.
                  </p>
                </div>
              </div>

              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-mobile-screen-button" style="color: var(--color-green-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Menú Lateral en Acordeón y Menú Superior Derecho con Notificaciones</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Menú lateral agrupado por categorías desplegables con ubicación de base de datos (<code>nam5</code>), y botón desplegable compacto en la <strong>esquina superior derecha</strong> de la barra superior que concentra la sesión activa (Usuario, Organización, Rol), estado de conexión con Firebase, apartado de <strong>Notificaciones y Alertas</strong> con contador, acceso al perfil y cierre de sesión.
                  </p>
                </div>
              </div>

              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-users-gear" style="color: var(--color-blue-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Gobernanza Multiorganización, Hashing PBKDF2-SHA256 y Firebase Firestore</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Inicio de sesión demostrativo con Web Crypto API (<code>PBKDF2-SHA256</code>, sal aleatoria y 120.000 iteraciones), 4 roles (<code>SUPERADMINISTRADOR</code>, <code>ADMIN_ORGANIZACION</code>, <code>EDITOR</code>, <code>CONSULTA</code>), Directorio Público de Organizaciones, Panel Superadministrador, Registro de Auditoría, sincronización por lotes con Firestore y opción para <strong>vaciar la base de datos en Firestore al finalizar el periodo de pruebas</strong>.
                  </p>
                </div>
              </div>

              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-shield-halved" style="color: var(--color-green-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Protección de Contenido, 9 Reportes y Respaldos con Confirmación</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Protección frente a selecciones o copias accidentales y bloqueo de clic derecho (permitiendo copia controlada solo en formularios y datos técnicos autorizados como coordenadas GPS e ID del dispositivo), junto con diálogo de confirmación antes de exportar copias de seguridad JSON.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Mapa de Módulos de la Plataforma -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-sitemap" style="color: var(--color-green-700); margin-right: 6px;"></i> Descripción de los Módulos de la Plataforma</h3>
            <p class="card-subtitle">Conozca qué hace cada sección del menú lateral y acceda directamente a ella</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-switch-to-manual">
            <span>Ver Manual Paso a Paso</span>
          </button>
        </div>
        <div class="card-body">
          <div class="form-grid-2">
            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong>1. Inicio / Panel de Control</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="dashboard">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Resumen ejecutivo con indicadores en tiempo real (fuentes activas, pluviómetros, acumulado mensual en mm, estado hídrico territorial, volumen total estimado disponible y alertas activas), acciones rápidas, gráficos y mini-mapa.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong>2. Sitios y Comunidades</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="sites">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Directorio territorial de veredas, corregimientos, centros poblados y sectores en los municipios de Montes de María. Sirve como base para vincular todos los demás registros.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong>3. Fuentes de Agua</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="water-sources">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Inventario detallado de pozos, arroyos, ríos, manantiales, jagüeyes, reservorios, tanques y puntos de captación pluvial, incluyendo capacidad en litros, profundidad de referencia, fotografía y acceso directo a su Ficha de Disponibilidad.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px; border-left: 3px solid var(--color-blue-700);">
              <div class="d-flex justify-between align-center w-100">
                <strong>4. Disponibilidad Hídrica</strong>
                <button class="btn btn-primary btn-sm btn-nav-module" data-route="water-availability">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Registro periódico de mediciones de nivel (m, cm, L, m³, %, L/s), clasificación automática diferenciada por tipo de fuente (alta, moderada, baja, crítica), comparador entre fechas, gráficos de evolución y Ficha Técnica de Disponibilidad.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px; border-left: 3px solid var(--color-green-700);">
              <div class="d-flex justify-between align-center w-100">
                <strong>5. Herramientas y Calculadoras Hídricas</strong>
                <button class="btn btn-primary btn-sm btn-nav-module" data-route="water-tools">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Cuatro calculadoras técnicas reutilizables con carga de datos de campo: Captación de agua lluvia en techos (<code>V = P × A × C</code>), Capacidad geométrica de tanques y reservorios, Balance hídrico simplificado y Autonomía hídrica en días de reserva.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px; border-left: 3px solid var(--color-warning);">
              <div class="d-flex justify-between align-center w-100">
                <strong>6. Alertas Hídricas</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="water-alerts">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Sistema de alertas tempranas basado en datos reales (fuentes críticas, descenso de nivel, déficit pluviométrico, pronóstico de lluvias intensas y fuentes sin medición reciente) con umbrales configurables y gestión de resolución.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong>7. Pluviómetros</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="pluviometers">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Fichas técnicas de los equipos de medición instalados en fincas y comunidades: código único, tipo de pluviómetro, fecha de instalación, altitud (msnm) y responsable.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong>8. Registro de Lluvias</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="rainfall">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Módulo central de captura de lecturas pluviométricas en milímetros (mm), con alertas de lluvias extremas, control de duplicados y gráficas dinámicas diarias y mensuales.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px; border-left: 3px solid var(--color-blue-700);">
              <div class="d-flex justify-between align-center w-100">
                <strong>9. Clima y Meteorología (HIDROTERRA CLIMA)</strong>
                <button class="btn btn-primary btn-sm btn-nav-module" data-route="climate">Abrir Clima</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Monitoreo meteorológico y análisis agroclimático: condiciones actuales (Open-Meteo), pronóstico 24 h y 7 días, evapotranspiración FAO ET₀, vinculación Clima – Agua (recarga potencial en m³) y comparación entre lluvia observada y pronosticada.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong>10. Mapa Territorial</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="map">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Visor cartográfico interactivo con activación/desactivación de capas, filtro por estado de disponibilidad hídrica, marcadores coloreados según nivel (alta, moderada, baja, crítica) y fichas emergentes detalladas.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong>11. Parcelas y Cultivos</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="parcels">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Seguimiento de predios productivos, área en hectáreas o m², productores responsables y cultivos sembrados (fechas de siembra, estado fenológico y cosecha esperada).
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong>12. Observaciones, Auditoría, Directorio, Reportes y Configuración</strong>
                <div class="d-flex gap-2" style="flex-wrap:wrap;">
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="directory">Directorio</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="audit">Auditoría</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="reports">Reportes</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="settings">Configuración</button>
                </div>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Directorio público de organizaciones comunitarias, registro de auditoría, bitácora de observaciones de campo, generador de 9 informes técnicos exportables a CSV/JSON/Impresión y centro de <strong>Configuración y Respaldos</strong> (Sincronización con Firebase Firestore, Mi Perfil, Mi Organización, Seguridad PBKDF2-SHA256, Gestión de Usuarios, modo oscuro y copias de seguridad JSON).
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderManualTab() {
    return `
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <h3 class="card-title"><i class="fa-solid fa-list-check" style="color: var(--color-green-700); margin-right: 6px;"></i> Manual de Uso Paso a Paso</h3>
            <p class="card-subtitle">Siga este flujo recomendado para registrar, monitorear, calcular y respaldar la información hídrica sin errores</p>
          </div>
        </div>
        <div class="card-body">
          <div style="display: flex; flex-direction: column; gap: var(--spacing-4);">

            <!-- PASO 1 -->
            <div class="coords-picker-box" style="margin-bottom: 0;">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-success" style="margin-right: 6px;">Paso 1</span>
                  Registrar las Comunidades o Sitios Territoriales
                </h4>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="sites">
                  Ir a Sitios y Comunidades
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-700); margin-bottom: 8px; line-height: 1.55;">
                Antes de crear fuentes de agua, pluviómetros o parcelas, registre las veredas o corregimientos donde trabajará:
              </p>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li>En el menú izquierdo, seleccione <strong>Sitios y Comunidades</strong> y pulse el botón <strong>«+ Nueva Comunidad / Sitio»</strong>.</li>
                <li>Escriba el nombre de la vereda o sector (ej. <em>Vereda La Cansona</em>), el municipio (ej. <em>El Carmen de Bolívar</em>), la población estimada y el departamento.</li>
                <li>Si se encuentra en el sitio, pulse <strong>«Obtener ubicación actual»</strong> para capturar las coordenadas GPS automáticamente, o escríbalas en grados decimales y presione <strong>Guardar</strong>.</li>
              </ol>
            </div>

            <!-- PASO 2 -->
            <div class="coords-picker-box" style="margin-bottom: 0; border-left: 4px solid var(--color-blue-700);">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-info" style="margin-right: 6px;">Paso 2</span>
                  Inventariar Fuentes de Agua con Capacidad y Profundidad de Referencia
                </h4>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="water-sources">
                  Ir a Fuentes de Agua
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-700); margin-bottom: 8px; line-height: 1.55;">
                Registre cada pozo, jagüey, reservorio, tanque comunitario, manantial o arroyo indicando sus parámetros de diseño para habilitar el cálculo automático de disponibilidad:
              </p>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li>Ingrese a <strong>Fuentes de Agua</strong> y haga clic en <strong>«Registrar Fuente de Agua»</strong>.</li>
                <li>Asigne código, nombre, tipo de fuente, comunidad asociada, usos principales (consumo humano, agropecuario, riego) y coordenadas GPS.</li>
                <li>Complete la <strong>Capacidad estimada en litros (L)</strong> y la <strong>Profundidad máxima o nivel de referencia (m)</strong> cuando se conozcan, y adjunte fotografía si dispone de ella.</li>
              </ol>
            </div>

            <!-- PASO 3 -->
            <div class="coords-picker-box" style="margin-bottom: 0; border-left: 4px solid var(--color-blue-700);">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-info" style="margin-right: 6px;">Paso 3</span>
                  Monitorear Disponibilidad Hídrica, Comparar Fechas y Consultar Fichas Técnicas
                </h4>
                <button class="btn btn-primary btn-sm btn-nav-module" data-route="water-availability">
                  Ir a Disponibilidad Hídrica
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-700); margin-bottom: 8px; line-height: 1.55;">
                Realice el seguimiento periódico del estado real de cada infraestructura hídrica:
              </p>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li>Pulse <strong>«Registrar Medición»</strong>, elija la fuente hídrica, la fecha/hora y el <strong>Método de medición</strong> (medición manual de nivel, regla limnimétrica, cinta o sonda de profundidad, medición volumétrica o estimación técnica).</li>
                <li>Ingrese el valor medido y su unidad (<code>m</code>, <code>cm</code>, <code>L</code>, <code>m³</code>, <code>%</code> o <code>L/s</code>). El sistema distingue entre <strong>valores observados directamente</strong> y <strong>volúmenes estimados por cálculo</strong> a partir de la capacidad o profundidad de la fuente.</li>
                <li>Consulte la clasificación automática según el tipo de fuente (<strong>Alta</strong>, <strong>Moderada</strong>, <strong>Baja</strong>, <strong>Crítica</strong> o <strong>Sin datos</strong>), el gráfico de evolución histórica y el <strong>Comparador entre dos fechas</strong>.</li>
                <li>Haga clic en el botón <strong>«Ficha Técnica»</strong> de cualquier fuente para abrir su <strong>Ficha Técnica de Disponibilidad</strong> con todos sus indicadores, historial, fotografías y observaciones.</li>
              </ol>
            </div>

            <!-- PASO 4 -->
            <div class="coords-picker-box" style="margin-bottom: 0; border-left: 4px solid var(--color-green-700);">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-success" style="margin-right: 6px;">Paso 4</span>
                  Utilizar las 4 Calculadoras de Herramientas Hídricas
                </h4>
                <button class="btn btn-primary btn-sm btn-nav-module" data-route="water-tools">
                  Ir a Herramientas Hídricas
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-700); margin-bottom: 8px; line-height: 1.55;">
                Apoye la planificación comunitaria y el diseño predial con cuatro calculadoras técnicas conectadas a los registros reales del territorio:
              </p>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li><strong>1. Captación de Agua Lluvia (<code>V = P × A × C</code>):</strong> Cargue la precipitación observada en un pluviómetro o ingrese los mm de lluvia, el área del techo en m² y el tipo de cubierta (zinc, teja de barro, concreto, geomembrana) para obtener el volumen captable en litros y m³ y los tanques equivalentes.</li>
                <li><strong>2. Almacenamiento por Geometría:</strong> Calcule la capacidad total y el volumen actual según el tirante de agua para tanques cilíndricos, tanques rectangulares o jagüeyes trapezoidales con talud.</li>
                <li><strong>3. Balance Hídrico Simplificado:</strong> Compare las entradas (captación pluvial + volumen almacenado + aportes) frente a las salidas (consumo doméstico, pecuario, riego y pérdidas por evaporación/infiltración) para identificar superávit o déficit hídrico.</li>
                <li><strong>4. Autonomía Hídrica:</strong> Seleccione una fuente real para cargar su volumen actual y estime cuántos días de reserva tiene la comunidad según el número de habitantes, cabezas de ganado y hectáreas de riego, más un escenario de ahorro del 20 %.</li>
              </ol>
            </div>

            <!-- PASO 5 -->
            <div class="coords-picker-box" style="margin-bottom: 0; border-left: 4px solid var(--color-warning);">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-warning" style="margin-right: 6px;">Paso 5</span>
                  Gestionar el Sistema de Alertas Hídricas y Configurar Umbrales
                </h4>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="water-alerts">
                  Ir a Alertas Hídricas
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-700); margin-bottom: 8px; line-height: 1.55;">
                Identifique oportunamente riesgos de desabastecimiento o eventos hidrometeorológicos extremos:
              </p>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li>En <strong>Alertas Hídricas</strong> pulse <strong>«Reevaluar Alertas»</strong> para analizar todas las fuentes, pluviómetros y pronósticos en caché.</li>
                <li>Revise las 5 reglas automáticas: <em>Fuente en estado crítico/bajo</em>, <em>Descenso brusco de nivel</em>, <em>Déficit de lluvias</em>, <em>Pronóstico de lluvias intensas</em> y <em>Fuente sin mediciones recientes</em>.</li>
                <li>Use <strong>«Configurar Umbrales y Reglas»</strong> para adaptar los porcentajes y días límite a las condiciones locales de su zona, pulse <strong>«Ver Ficha de Disponibilidad»</strong> para inspeccionar la fuente afectada o marque la alerta como <strong>Atendida</strong> registrando la acción tomada.</li>
              </ol>
            </div>

            <!-- PASO 6 -->
            <div class="coords-picker-box" style="margin-bottom: 0;">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-info" style="margin-right: 6px;">Paso 6</span>
                  Registrar Pluviómetros y Capturar Mediciones de Lluvia en Milímetros (mm)
                </h4>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="pluviometers">Pluviómetros</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="rainfall">Registro de Lluvias</button>
                </div>
              </div>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li>En <strong>Pluviómetros &rarr; «Añadir Pluviómetro»</strong>, asigne un código único (ej. <code>PLUV-CARMEN-01</code>), nombre, tipo de equipo, comunidad asociada, altitud (msnm) y monitor responsable.</li>
                <li>En <strong>Registro de Lluvias &rarr; «Registrar Nueva Medición»</strong>, seleccione el pluviómetro e ingrese la lámina medida en <strong>milímetros (mm)</strong> junto con la fecha y hora de lectura.</li>
                <li>El sistema valida duplicados automáticamente y actualiza al instante las tarjetas de acumulado y los gráficos diarios y mensuales.</li>
              </ol>
            </div>

            <!-- PASO 7: HIDROTERRA CLIMA -->
            <div class="coords-picker-box" style="margin-bottom: 0; border-left: 4px solid var(--color-blue-700);">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-info" style="margin-right: 6px;">Paso 7</span>
                  Consultar Pronóstico Agroclimático y Vinculación Clima – Agua
                </h4>
                <button class="btn btn-primary btn-sm btn-nav-module" data-route="climate">
                  Ir a Clima y Meteorología
                </button>
              </div>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li><strong>Selección de Ubicación:</strong> Elija un Pluviómetro, Fuente hídrica, Comunidad o Parcela, o seleccione un punto en el Mapa Climático.</li>
                <li><strong>Condiciones, Pronóstico 24 h / 7 Días y ET₀:</strong> Consulte temperatura, humedad, viento, presión, evapotranspiración FAO ET₀ y días secos consecutivos.</li>
                <li><strong>Vinculación Clima – Disponibilidad Hídrica:</strong> Revise la tarjeta de impacto hídrico que cruza la lluvia pronosticada a 7 días con las fuentes cercanas para estimar el potencial de recarga pluvial en m³ y priorizar el seguimiento de fuentes en estado crítico o bajo.</li>
                <li><strong>Comparación de Precipitaciones:</strong> Compare siempre por separado la lluvia física observada en sus pluviómetros frente a la precipitación pronosticada para 24 h y 7 días.</li>
              </ol>
            </div>

            <!-- PASO 8 -->
            <div class="coords-picker-box" style="margin-bottom: 0;">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-warning" style="margin-right: 6px;">Paso 8</span>
                  Explorar el Mapa por Disponibilidad, Exportar los 9 Reportes y Respaldar en JSON
                </h4>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="map">Mapa</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="reports">Reportes</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="settings">Respaldos</button>
                </div>
              </div>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li><strong>Mapa Territorial:</strong> Active o desactive capas y utilice el filtro de <strong>Estado de Disponibilidad Hídrica</strong> para localizar en el mapa las fuentes con disponibilidad alta (verde), moderada (azul), baja (ámbar) o crítica (rojo), y abra su Ficha de Disponibilidad desde el marcador.</li>
                <li><strong>Reportes y Exportación:</strong> Genere cualquiera de los <strong>9 informes técnicos</strong> (incluyendo <em>Estado de Disponibilidad Hídrica de Fuentes</em>, <em>Historial de Mediciones de Nivel y Volumen</em> y <em>Balance Pluviométrico vs Disponibilidad</em>) y descárguelos en <strong>CSV (Excel)</strong>, <strong>JSON</strong> o <strong>Impresión / PDF</strong>.</li>
                <li><strong>Menú Superior Derecho y Notificaciones:</strong> En la esquina superior derecha de la barra superior encontrará el botón desplegable con su nombre, organización, estado de conexión a Firebase y el apartado <strong>Notificaciones y Alertas</strong> (donde se agrupan los avisos de respaldo pendiente y las alertas hídricas activas sin ocupar espacio en la pantalla), además de las opciones para cambiar el tema, exportar respaldo JSON o cerrar sesión.</li>
              </ol>
            </div>

            <!-- PASO 9 -->
            <div class="coords-picker-box" style="margin-bottom: 0; border-left: 4px solid var(--color-green-700);">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-success" style="margin-right: 6px;">Paso 9</span>
                  Sincronizar con Firebase Firestore, Administrar Organizaciones y Vaciar Datos de Prueba
                </h4>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="directory">Directorio</button>
                  <button class="btn btn-primary btn-sm btn-nav-module" data-route="settings">Configuración y Firebase</button>
                </div>
              </div>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li><strong>Sincronizar Datos con Firebase (<code>nam5</code>):</strong> En <strong>Configuración y Respaldos &rarr; Sincronizar Datos con Firebase</strong>, pulse <em>1. Analizar datos locales</em>, revise la <em>2. Vista previa de migración</em> y ejecute <em>3. Sincronizar con Firestore</em> para respaldar en la nube los registros de cada organización conservando sus IDs, fechas y coordenadas GPS.</li>
                <li><strong>Mi Organización, Usuarios y Directorio Público:</strong> Complete los datos institucionales, autorice la publicación en el <strong>Directorio de Organizaciones</strong> conforme a la Ley 1581 de 2012 y gestione las cuentas de su organización según su rol (<code>SUPERADMINISTRADOR</code>, <code>ADMIN_ORGANIZACION</code>, <code>EDITOR</code> o <code>CONSULTA</code>).</li>
                <li><strong>Vaciar Base de Datos en Firestore al Finalizar el Periodo de Pruebas:</strong> Cuando concluya la etapa de pruebas y desee comenzar a ingresar datos reales de campo, ingrese a <strong>Configuración y Respaldos</strong>, pulse <strong>«Vaciar Base de Datos en Firestore (Fin de Pruebas)»</strong> y escriba la palabra <code>VACIAR</code> para limpiar las colecciones operativas en Firestore e IndexedDB conservando intactas las organizaciones y cuentas de usuario.</li>
              </ol>
            </div>

          </div>
        </div>
      </div>
    `;
  }

  _renderFaqTab() {
    return `
      <div class="dashboard-visual-grid mb-4">
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div>
              <h3 class="card-title"><i class="fa-solid fa-circle-question" style="color: var(--color-green-700); margin-right: 6px;"></i> Preguntas Frecuentes (FAQ)</h3>
              <p class="card-subtitle">Respuestas a las dudas más comunes durante el trabajo en campo</p>
            </div>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: var(--spacing-4); font-size: var(--font-size-sm); line-height: 1.6;">
            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                1. ¿Necesito tener conexión a Internet para registrar lluvias, mediciones de nivel o usar las calculadoras?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                No. Una vez abierta la aplicación por primera vez, el Service Worker guarda todos sus módulos y calculadoras internamente, y almacena los registros en IndexedDB dentro del dispositivo. Verá el indicador <em>«Sin Conexión (Offline)»</em> en el encabezado y podrá trabajar con total normalidad.
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                2. ¿Por qué los umbrales de disponibilidad hídrica cambian entre un pozo, un jagüey y un tanque?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                Porque cada infraestructura se comporta hidrológicamente de forma distinta: un jagüey o reservorio a cielo abierto sufre mayor evaporación e infiltración (por lo que se considera crítico por debajo del 25 %–30 %), mientras que un tanque cerrado conserva mejor su volumen (crítico bajo el 20 %) y un pozo se evalúa según su columna de agua útil sobre la profundidad de referencia.
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                3. ¿Cuál es la diferencia entre el volumen observado y el volumen estimado en Disponibilidad Hídrica?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                El <strong>volumen observado</strong> es el que el monitor mide directamente en litros o m³ (por ejemplo, en un tanque graduado). El <strong>volumen estimado</strong> lo calcula automáticamente el sistema cuando usted ingresa una lectura de nivel (en metros o centímetros) o porcentaje y la fuente cuenta con su capacidad máxima y profundidad de referencia registradas.
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                4. ¿Cómo puedo activar la lectura del texto completo cuando un botón o selector muestra puntos suspensivos (...)?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                Para mantener todas las vistas ordenadas sin que los textos largos desborden las cajas, el sistema recorta el excedente con puntos suspensivos (<code>...</code>). Esta ayuda viene desactivada por defecto para no resultar molesta; si desea usarla, ingrese a <strong>Reportes y Sistema &rarr; Configuración y Respaldos</strong> y active la opción <strong>«Mostrar texto completo en controles recortados (...)»</strong>. Con ello podrá ver el texto completo al pasar el mouse (PC) o al mantener presionado un instante el control (teléfono).
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                5. ¿Por qué el sistema no me deja eliminar un pluviómetro o una fuente con registros?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                Por regla de integridad histórica: si un pluviómetro o fuente hídrica ya tiene mediciones asociadas, se protege para no perder la serie histórica. Si dejó de utilizarse, edite su ficha y cambie su estado operativo a <strong>«Retirado»</strong> o <strong>«Inactivo»</strong>.
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                6. ¿Cómo uno los datos recolectados en varios teléfonos o computadores?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                En cada teléfono exporte el <strong>Respaldo JSON</strong>. Luego, en el computador principal vaya a <strong>Configuración y Respaldos &rarr; Seleccionar Archivo JSON</strong>, cargue cada archivo y elija la opción <strong>«Combinar y Actualizar (Recomendado)»</strong>. El sistema integrará todas las fuentes, mediciones de disponibilidad, lluvias y alertas sin borrar los registros existentes.
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                7. ¿Cómo funciona HIDROTERRA CLIMA cuando salgo a campo sin conexión a Internet?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                Cada consulta meteorológica realizada con conexión se guarda automáticamente en el almacén local <code>weather_cache</code>. En modo offline el sistema recupera el último pronóstico descargado indicando su fecha y hora exacta, y separa siempre la lluvia observada en pluviómetros de las estimaciones numéricas de Open-Meteo.
              </p>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <div>
              <h3 class="card-title"><i class="fa-solid fa-compass" style="color: var(--color-blue-700); margin-right: 6px;"></i> Buenas Prácticas de Monitoreo en Campo</h3>
              <p class="card-subtitle">Recomendaciones técnicas para garantizar calidad de datos</p>
            </div>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: var(--spacing-3); font-size: var(--font-size-sm); line-height: 1.6;">
            <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
              <i class="fa-solid fa-clock" style="color: var(--color-blue-700); font-size: 1.15rem; margin-top: 2px;"></i>
              <div>
                <strong>Lectura pluviométrica a hora fija (7:00 a. m.)</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  Procure leer el pluviómetro todos los días a la misma hora (estándar meteorológico: 7:00 a. m.) y vaciar el recipiente inmediatamente después de tomar el dato.
                </p>
              </div>
            </div>

            <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
              <i class="fa-solid fa-ruler-vertical" style="color: var(--color-blue-700); font-size: 1.15rem; margin-top: 2px;"></i>
              <div>
                <strong>Punto fijo de referencia al medir niveles de agua</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  En pozos, jagüeyes y reservorios utilice siempre el mismo brocal o regla limnimétrica como referencia para que el historial y las variaciones porcentuales sean comparables entre fechas.
                </p>
              </div>
            </div>

            <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
              <i class="fa-solid fa-location-crosshairs" style="color: var(--color-green-700); font-size: 1.15rem; margin-top: 2px;"></i>
              <div>
                <strong>Captura de coordenadas a cielo despejado</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  Al usar el botón <em>«Obtener ubicación actual»</em>, sitúese al aire libre junto al pluviómetro o fuente de agua y espere unos segundos para obtener la mejor precisión GPS.
                </p>
              </div>
            </div>

            <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
              <i class="fa-solid fa-hand-pointer" style="color: var(--color-blue-700); font-size: 1.15rem; margin-top: 2px;"></i>
              <div>
                <strong>Globo opcional de textos largos y copia controlada</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  En <strong>Configuración y Respaldos</strong> puede activar o desactivar el globo de texto completo para elementos con <code>...</code>. Además, aunque el contenido general está protegido contra copias accidentales, puede copiar coordenadas GPS o el ID del dispositivo haciendo clic sobre ellos.
                </p>
              </div>
            </div>

            <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
              <i class="fa-solid fa-circle-half-stroke" style="color: var(--color-green-700); font-size: 1.15rem; margin-top: 2px;"></i>
              <div>
                <strong>Uso del Modo Claro / Oscuro en campo</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  Bajo luz solar directa utilice el <strong>Modo Claro</strong> para máximo contraste; en ambientes interiores o nocturnos active el <strong>Modo Oscuro</strong> desde <strong>Configuración y Respaldos</strong> (o desde la barra superior en computador) para ahorrar batería.
                </p>
              </div>
            </div>

            <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
              <i class="fa-solid fa-vial" style="color: var(--color-earth-700); font-size: 1.15rem; margin-top: 2px;"></i>
              <div>
                <strong>Pruebas con datos de demostración</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  Si está capacitando a nuevos monitores, puede cargar el conjunto de datos de ejemplo de Montes de María desde <strong>Configuración y Respaldos &rarr; Cargar Datos de Ejemplo</strong> para practicar sin riesgo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents(container) {
    // Botones del encabezado
    const printBtn = container.querySelector('#btn-about-print');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    const dashBtn = container.querySelector('#btn-about-go-dashboard');
    if (dashBtn) {
      dashBtn.addEventListener('click', () => this.router.navigate('dashboard'));
    }

    // Pestañas principales
    const tabBtns = container.querySelectorAll('.nav-tab-btn[data-tab]');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === this.activeTab));
        const contentBox = container.querySelector('#about-tab-content');
        if (contentBox) {
          contentBox.innerHTML = this._renderTabContent();
          this._bindDynamicContentEvents(contentBox, container);
        }
      });
    });

    const contentBox = container.querySelector('#about-tab-content');
    if (contentBox) {
      this._bindDynamicContentEvents(contentBox, container);
    }
  }

  _bindDynamicContentEvents(contentBox, rootContainer) {
    // Botones de navegación rápida a módulos
    contentBox.querySelectorAll('.btn-nav-module').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetRoute = btn.dataset.route;
        if (targetRoute) {
          this.router.navigate(targetRoute);
        }
      });
    });

    // Botón para saltar de la pestaña Proyecto a la pestaña Manual
    const switchManualBtn = contentBox.querySelector('#btn-switch-to-manual');
    if (switchManualBtn) {
      switchManualBtn.addEventListener('click', () => {
        const manualTabBtn = rootContainer.querySelector('.nav-tab-btn[data-tab="manual"]');
        if (manualTabBtn) manualTabBtn.click();
      });
    }
  }
}

