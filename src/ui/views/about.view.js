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
              <span><i class="fa-solid fa-print"></i> Imprimir Guía</span>
            </button>
            <button class="btn btn-primary btn-sm" id="btn-about-go-dashboard">
              <span><i class="fa-solid fa-gauge"></i> Ir al Panel</span>
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
              <div><i class="fa-solid fa-database" style="color: var(--color-blue-700); width: 16px;"></i> <strong>Motor Local:</strong> IndexedDB (${escapeHtml(DB_CONFIG.name)} v${DB_CONFIG.version})</div>
              <div><i class="fa-solid fa-wifi" style="color: var(--color-green-700); width: 16px;"></i> <strong>Operación:</strong> 100% Autónoma sin Internet</div>
            </div>
          </div>
        </div>

        <!-- Pestañas de Navegación Interna -->
        <div class="nav-tabs" role="tablist">
          <button class="nav-tab-btn ${this.activeTab === 'project' ? 'active' : ''}" data-tab="project" role="tab">
            <i class="fa-solid fa-circle-info"></i> Información del Proyecto y Plataforma
          </button>
          <button class="nav-tab-btn ${this.activeTab === 'manual' ? 'active' : ''}" data-tab="manual" role="tab">
            <i class="fa-solid fa-book-open"></i> Manual de Uso Paso a Paso
          </button>
          <button class="nav-tab-btn ${this.activeTab === 'faq' ? 'active' : ''}" data-tab="faq" role="tab">
            <i class="fa-solid fa-circle-question"></i> Preguntas Frecuentes y Consejos de Campo
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
              <strong>${escapeHtml(APP_CONFIG.name)} (PAnA V2 AGUA)</strong> es una Aplicación Web Progresiva (PWA) de código modular que funciona directamente en el navegador del dispositivo sin requerir servidores externos ni suscripciones en la nube para su operación diaria.
            </p>
            <div style="display: flex; flex-direction: column; gap: var(--spacing-3);">
              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-hard-drive" style="color: var(--color-green-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Base de Datos Local Persistente (IndexedDB)</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Toda la información se guarda de forma segura en el almacenamiento interno del navegador mediante 7 almacenes relacionales con reglas de integridad.
                  </p>
                </div>
              </div>

              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-satellite-dish" style="color: var(--color-blue-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Georreferenciación GPS Nativa y Mapas Interactivos</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Captura coordenadas WGS84 usando el chip GPS del dispositivo incluso sin datos móviles y valida que estén dentro del polígono de Montes de María.
                  </p>
                </div>
              </div>

              <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
                <i class="fa-solid fa-shield-halved" style="color: var(--color-green-700); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <strong style="color: var(--color-neutral-900);">Intercambio de Datos e Integridad</strong>
                  <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                    Exportación a Excel (CSV UTF-8) y respaldos completos en JSON con asistente de combinación o restauración para consolidar datos de varios monitores.
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
            <span><i class="fa-solid fa-book-open"></i> Ver Manual Paso a Paso</span>
          </button>
        </div>
        <div class="card-body">
          <div class="form-grid-2">
            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong><i class="fa-solid fa-gauge" style="color: var(--color-green-700);"></i> 1. Inicio / Panel de Control</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="dashboard">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Resumen ejecutivo con indicadores en tiempo real (fuentes activas, pluviómetros, acumulado mensual en mm), gráfico de precipitación diaria, mini-mapa y últimas lecturas.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong><i class="fa-solid fa-mountain-sun" style="color: var(--color-earth-700);"></i> 2. Sitios y Comunidades</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="sites">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Directorio territorial de veredas, corregimientos, centros poblados y sectores en los municipios de Montes de María. Sirve como base para vincular todos los demás registros.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong><i class="fa-solid fa-faucet-drip" style="color: var(--color-blue-700);"></i> 3. Fuentes de Agua</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="water-sources">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Inventario detallado de pozos, arroyos, ríos, manantiales, jagüeyes, reservorios y acueductos veredales, incluyendo su estado observado, usos principales y coordenadas.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong><i class="fa-solid fa-cloud-showers-heavy" style="color: var(--color-green-700);"></i> 4. Pluviómetros</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="pluviometers">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Fichas técnicas de los equipos de medición instalados en fincas y comunidades: código único, tipo de pluviómetro, fecha de instalación, altitud (msnm) y responsable.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong><i class="fa-solid fa-cloud-rain" style="color: var(--color-blue-700);"></i> 5. Registro de Lluvias</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="rainfall">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Módulo central de captura de lecturas pluviométricas en milímetros (mm), con alertas de lluvias extremas, control de duplicados y gráficas dinámicas diarias y mensuales.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong><i class="fa-solid fa-map-location-dot" style="color: var(--color-green-700);"></i> 6. Mapa Territorial</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="map">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Visor cartográfico interactivo con activación/desactivación de capas (fuentes de agua, pluviómetros, comunidades y parcelas) y fichas emergentes al hacer clic en cada punto.
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong><i class="fa-solid fa-seedling" style="color: var(--color-green-700);"></i> 7. Parcelas y Cultivos</strong>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="parcels">Abrir</button>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Seguimiento de predios productivos, área en hectáreas o m², productores responsables y cultivos sembrados (fechas de siembra, estado fenológico y cosecha esperada).
              </p>
            </div>

            <div class="recent-activity-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
              <div class="d-flex justify-between align-center w-100">
                <strong><i class="fa-solid fa-clipboard-list" style="color: var(--color-blue-700);"></i> 8. Observaciones, Reportes y Respaldos</strong>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="observations">Notas</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="reports">Reportes</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="settings">Datos</button>
                </div>
              </div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                Bitácora de observaciones de campo, generador de 6 informes exportables a CSV/JSON/Impresión y centro de configuración, modo oscuro y copias de seguridad.
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
            <p class="card-subtitle">Siga este flujo recomendado para registrar, consultar y respaldar la información hídrica sin errores</p>
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
                  <i class="fa-solid fa-arrow-right"></i> Ir a Sitios y Comunidades
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-700); margin-bottom: 8px; line-height: 1.55;">
                Antes de crear fuentes de agua, pluviómetros o parcelas, registre las veredas o corregimientos donde trabajará:
              </p>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li>En el menú izquierdo, seleccione <strong>Sitios y Comunidades</strong> y pulse el botón <strong>«+ Nueva Comunidad / Sitio»</strong>.</li>
                <li>Escriba el nombre de la vereda o sector (ej. <em>Vereda La Cansona</em>), el municipio (ej. <em>El Carmen de Bolívar</em>) y el departamento.</li>
                <li>Si se encuentra en el sitio, pulse <strong>«Obtener ubicación actual»</strong> para capturar las coordenadas GPS automáticamente, o escríbalas en grados decimales y presione <strong>Guardar</strong>.</li>
              </ol>
            </div>

            <!-- PASO 2 -->
            <div class="coords-picker-box" style="margin-bottom: 0;">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-info" style="margin-right: 6px;">Paso 2</span>
                  Registrar los Pluviómetros de la Red Comunitaria
                </h4>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="pluviometers">
                  <i class="fa-solid fa-arrow-right"></i> Ir a Pluviómetros
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-700); margin-bottom: 8px; line-height: 1.55;">
                Cada equipo instalado en una finca, escuela o predio comunitario debe tener su ficha técnica:
              </p>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li>Ingrese a <strong>Pluviómetros</strong> y haga clic en <strong>«Añadir Pluviómetro»</strong>.</li>
                <li>Asigne un <strong>Código único</strong> fácil de identificar (ej. <code>PLUV-CARMEN-01</code>) y un nombre descriptivo (ej. <em>Pluviómetro Finca La Esperanza</em>).</li>
                <li>Seleccione el tipo de equipo (manual graduado, comunitario, estación meteorológica o artesanal), la comunidad asociada y el nombre del monitor responsable.</li>
                <li>Registre las coordenadas GPS y la altitud (msnm). En la tabla podrá usar el buscador superior para filtrar por código, nombre, estado o comunidad.</li>
              </ol>
            </div>

            <!-- PASO 3 -->
            <div class="coords-picker-box" style="margin-bottom: 0;">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-info" style="margin-right: 6px;">Paso 3</span>
                  Capturar Mediciones de Lluvia en Milímetros (mm)
                </h4>
                <button class="btn btn-outline btn-sm btn-nav-module" data-route="rainfall">
                  <i class="fa-solid fa-arrow-right"></i> Ir a Registro de Lluvias
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: var(--color-neutral-700); margin-bottom: 8px; line-height: 1.55;">
                Cuando realice la lectura del pluviómetro (idealmente a la misma hora cada mañana después de un día de lluvia):
              </p>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li>Puede entrar desde <strong>Registro de Lluvias &rarr; «Registrar Nueva Medición»</strong>, o pulsar el botón azul de lluvia (<i class="fa-solid fa-cloud-rain"></i>) junto al pluviómetro.</li>
                <li>Seleccione el pluviómetro correspondiente e ingrese la cantidad medida en <strong>milímetros (mm)</strong> (valores mayores o iguales a <code>0</code>, acepta decimales como <code>14.5</code>).</li>
                <li>Verifique la <strong>Fecha y Hora de Medición</strong> (cuándo se tomó la lectura en campo) y el tipo de medición (acumulado 24h, evento puntual, etc.).</li>
                <li>El sistema verificará automáticamente que no exista un registro duplicado cercano en el tiempo y actualizará al instante las tarjetas de acumulado y el gráfico diario/mensual.</li>
              </ol>
            </div>

            <!-- PASO 4 -->
            <div class="coords-picker-box" style="margin-bottom: 0;">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-success" style="margin-right: 6px;">Paso 4</span>
                  Inventariar Fuentes de Agua, Parcelas y Observaciones de Campo
                </h4>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="water-sources">Fuentes</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="parcels">Parcelas</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="observations">Observaciones</button>
                </div>
              </div>
              <ul style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li><strong>Fuentes de Agua:</strong> Registre pozos, arroyos, manantiales o jagüeyes indicando su disponibilidad actual (disponible, nivel bajo, seco en verano, contaminada, etc.) y su uso (consumo humano, riego, ganadería).</li>
                <li><strong>Parcelas y Cultivos:</strong> En la pestaña <em>Parcelas</em> registre los predios y luego use el botón <strong>«Sembrar cultivo»</strong> (<i class="fa-solid fa-seedling"></i>) para asociar cultivos de ñame, yuca, maíz u otros.</li>
                <li><strong>Observaciones Hídricas:</strong> Anote eventos cualitativos importantes (inicio de sequía, creciente de arroyo, humedad del suelo o mantenimiento de equipos) vinculándolos a una comunidad, fuente o pluviómetro.</li>
              </ul>
            </div>

            <!-- PASO 5 -->
            <div class="coords-picker-box" style="margin-bottom: 0;">
              <div class="d-flex justify-between align-center" style="flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                <h4 style="margin: 0; color: var(--color-neutral-900);">
                  <span class="badge badge-warning" style="margin-right: 6px;">Paso 5</span>
                  Consultar el Mapa, Exportar Reportes y Realizar Respaldos JSON
                </h4>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="reports">Ir a Reportes</button>
                  <button class="btn btn-outline btn-sm btn-nav-module" data-route="settings">Ir a Respaldos</button>
                </div>
              </div>
              <ol style="font-size: var(--font-size-sm); color: var(--color-neutral-700); padding-left: 1.25rem; margin: 0; line-height: 1.6;">
                <li><strong>Mapa Territorial:</strong> Active o desactive las casillas superiores para ver en el mapa las fuentes, pluviómetros, comunidades y parcelas. Haga clic sobre cualquier marcador para ver su resumen.</li>
                <li><strong>Reportes y Exportación:</strong> Elija entre los 6 tipos de informe, filtre por fechas o comunidad y presione <strong>«Descargar CSV»</strong> (para abrir en Excel) o <strong>«Imprimir Reporte»</strong> (para guardar en PDF o papel).</li>
                <li><strong>Copia de Seguridad (Fundamental):</strong> Al terminar su jornada de registro, pulse el botón <strong>«Respaldo JSON»</strong> en la barra superior derecha o desde <strong>Respaldo y Datos</strong>. Guarde ese archivo <code>.json</code> en una memoria USB, carpeta segura o envíelo al coordinador técnico.</li>
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
                1. ¿Necesito tener conexión a Internet para registrar lluvias o fuentes en la vereda?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                No. Una vez que haya abierto la aplicación por primera vez, el sistema guarda todos sus programas internamente (Service Worker) y almacena los registros en el dispositivo. Verá el indicador <em>«Sin Conexión (Offline)»</em> en el encabezado y podrá seguir trabajando con total normalidad.
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                2. ¿Por qué el sistema no me deja eliminar un pluviómetro?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                Por regla de integridad histórica: si un pluviómetro ya tiene mediciones de lluvia asociadas, el sistema impide borrarlo para no dejar huérfanas las lecturas históricas. Si el equipo se dañó o ya no se usa, edítelo y cambie su estado a <strong>«Retirado»</strong> o <strong>«Inactivo»</strong>.
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                3. ¿Cómo uno los datos recolectados en varios teléfonos o computadores?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                En cada teléfono exporte el <strong>Respaldo JSON</strong>. Luego, en el computador principal vaya a <strong>Respaldo y Datos &rarr; Seleccionar Archivo JSON</strong>, cargue cada archivo y elija la opción <strong>«Combinar y Actualizar (Recomendado)»</strong>. El sistema sumará los registros nuevos sin borrar los que ya estaban.
              </p>
            </div>

            <div>
              <strong style="color: var(--color-neutral-900); display: block; margin-bottom: 4px;">
                4. ¿Qué ocurre si borro el historial y los datos de navegación del navegador?
              </strong>
              <p style="margin: 0; color: var(--color-neutral-600);">
                Como la base de datos vive dentro del navegador (IndexedDB), borrar los «Datos de sitios» eliminará los registros locales si no tiene una copia externa. Por eso la aplicación muestra un aviso preventivo si pasan más de ${APP_CONFIG.storage.backupWarningDays} días sin exportar un Respaldo JSON.
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
                <strong>Lectura a hora fija (7:00 a. m.)</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  Procure leer el pluviómetro todos los días a la misma hora (estándar meteorológico: 7:00 a. m.) y vaciar el recipiente inmediatamente después de tomar el dato.
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
              <i class="fa-solid fa-circle-half-stroke" style="color: var(--color-green-700); font-size: 1.15rem; margin-top: 2px;"></i>
              <div>
                <strong>Uso del Modo Claro / Oscuro en campo</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  Bajo luz solar directa utilice el <strong>Modo Claro</strong> para máximo contraste; en ambientes interiores o nocturnos active el <strong>Modo Oscuro</strong> desde el ícono de luna (<i class="fa-solid fa-moon"></i>) en el encabezado para ahorrar batería.
                </p>
              </div>
            </div>

            <div class="recent-activity-item" style="align-items: flex-start; gap: var(--spacing-3);">
              <i class="fa-solid fa-vial" style="color: var(--color-earth-700); font-size: 1.15rem; margin-top: 2px;"></i>
              <div>
                <strong>Pruebas con datos de demostración</strong>
                <p style="margin: 2px 0 0; font-size: var(--font-size-xs); color: var(--color-neutral-600);">
                  Si está capacitando a nuevos monitores, puede cargar el conjunto de datos de ejemplo de Montes de María desde <strong>Respaldo y Datos &rarr; Cargar Datos de Ejemplo</strong> para practicar sin riesgo.
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

