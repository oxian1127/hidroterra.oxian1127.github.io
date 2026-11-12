# HIDROTERRA — Plataforma de Monitoreo Hídrico Rural, Gestión Territorial y Análisis Agroclimático
## Contexto Territorial: Montes de María, Colombia

**HIDROTERRA** es una aplicación web progresiva (**Progressive Web App - PWA**) diseñada para el registro, monitoreo periódico, análisis agroclimático y gestión comunitaria de los recursos hídricos en territorios rurales, inicialmente en la subregión de **Montes de María (Bolívar y Sucre, Colombia)**.

Diseñada bajo el principio **Offline-First**, la plataforma funciona de forma 100% autónoma en campo sin depender de conexión constante a Internet ni servidores externos para su operación diaria. Todos los datos se almacenan localmente en **IndexedDB (v3)** con identificadores universales (`UUID v4`), marcas temporales ISO 8601 y cola de operaciones lista para sincronización futura con un backend centralizado.

> **Autoría y Desarrollo:** Software desarrollado por **José Félix Ibáñez Romero. Ing. de Sistemas**.

---

## 1. Organización del Menú y Módulos Principales

El menú lateral cuenta con un diseño minimalista en tonos verdes institucionales suaves, organizado mediante un acceso directo principal y **4 categorías desplegables en acordeón** (con íconos identificativos exclusivos en las opciones principales):

### Acceso Principal y Gobernanza Multiorganización
0. **Inicio de Sesión Demostrativo (`#login`), Panel Superadministrador (`#superadmin`) y Directorio Público (`#directory`):**
   - **Inicio de Sesión Demostrativo con PBKDF2-SHA256:** Validación local mediante Web Crypto API (`PBKDF2` + `SHA-256`, sal aleatoria de 16 bytes por usuario y `120.000` iteraciones) contra la colección `users` de Firebase Firestore, sin almacenar contraseñas en texto plano.
   - **Asistente de Configuración Inicial Único:** Creación guiada del `SUPERADMINISTRADOR`, perfiles institucionales de las 4 organizaciones reales identificadas en Montes de María y cuentas de administrador organizacional con establecimiento de contraseña por primera vez.
   - **Roles y Permisos (`SUPERADMINISTRADOR`, `ADMIN_ORGANIZACION`, `EDITOR`, `CONSULTA`):** Separación demostrativa y visual de datos por `organizationId` en todos los módulos operativos.
   - **Panel Superadministrador (`#superadmin`):** Estadísticas globales de organizaciones, usuarios, lluvias, pluviómetros, fuentes y alertas, gráfica comparativa entre organizaciones y edición global auditada.
   - **Directorio de Organizaciones (`#directory`):** Accesible públicamente sin iniciar sesión, con búsqueda y filtros por departamento, municipio y tipo de organización, respetando la configuración de privacidad y el consentimiento de publicación (Ley 1581 de 2012).
1. **Inicio / Panel (`#dashboard`):**
   - Indicadores en tiempo real de fuentes hídricas registradas, fuentes con disponibilidad alta/moderada vs. baja/crítica, volumen total estimado disponible frente a capacidad registrada, pluviómetros activos, lluvia acumulada del mes y alertas hídricas activas.
   - Gráficos interactivos de evolución de disponibilidad hídrica y precipitación diaria de los últimos 30 días, mini-mapa territorial, tabla de mediciones recientes y accesos rápidos de campo.

### Categoría 1: Gestión Hídrica
2. **Fuentes de Agua (`#water-sources`):**
   - Inventario de pozos, aljibes, jagüeyes, reservorios, manantiales, arroyos, ríos, quebradas, acueductos rurales, tanques comunitarios, puntos de captación de agua lluvia y sistemas de almacenamiento.
   - Registro de capacidad conocida en litros (`knownCapacityLiters`), profundidad de referencia (`referenceDepthMeters`), fotografía opcional (`photoDataUrl`), coordenadas GPS y acceso directo a la Ficha Técnica de Disponibilidad.
3. **Disponibilidad Hídrica (`#water-availability`):**
   - Registro periódico de mediciones de nivel, caudal o volumen (`m`, `cm`, `L`, `m3`, `%`, `l_s`) mediante 6 métodos de campo (regla graduada, cinta/sonda, aforo volumétrico, estimación visual, sensor o medición manual directa).
   - Clasificación automática por tipo de fuente en `alta`, `moderada`, `baja`, `critica` o `sin_informacion`.
   - Gráficos de evolución histórica (Chart.js), comparador de mediciones entre dos fechas y **Ficha Técnica de Disponibilidad** con balance climático y demanda de cultivos asociados.
4. **Herramientas Hídricas (`#water-tools`):**
   - **Captación de Agua Lluvia:** Cálculo mediante $V = P \times A \times C$ con preseteo desde pluviómetros registrados y coeficientes por tipo de cubierta.
   - **Capacidad de Almacenamiento:** Cálculo geométrico para tanques cilíndricos, rectangulares/cisternas, reservorios/jagüeyes con factor de talud y geometría personalizada.
   - **Balance Hídrico Simplificado:** $\text{Almacenamiento final} = \text{Almacenamiento inicial} + \text{Entradas} - \text{Salidas} - \text{Pérdidas}$.
   - **Autonomía Hídrica:** Estimación de días de reserva según demanda familiar, pecuaria, riego agrícola y margen de seguridad.
5. **Alertas Hídricas (`#water-alerts`):**
   - Generación y evaluación de alertas basadas exclusivamente en datos reales: fuente en nivel crítico, disponibilidad baja, descenso consecutivo de nivel, ausencia de lluvias, pronóstico de lluvia intensa y fuentes sin medición reciente.
   - Flujo para marcar alertas como **Atendidas** con fecha y nota técnica de resolución, más panel de configuración de umbrales.

### Categoría 2: Lluvias y Clima
6. **Pluviómetros (`#pluviometers`) y Registro de Lluvias (`#rainfall`):**
   - Fichas técnicas georreferenciadas, captura de precipitación en milímetros (`mm`), control de lecturas duplicadas y acumulados diarios/mensuales.
7. **Clima y Meteorología — HIDROTERRA CLIMA (`#climate`):**
   - Integración con **Open-Meteo** (`America/Bogota`), pronóstico horario (24 h) y diario (7 días), evapotranspiración FAO $\text{ET}_0$, humedad del suelo y caché local (`weather_cache`).
   - **Balance Hídrico Climático Integrado:** Cruce entre pronóstico, lluvia real medida en pluviómetros, disponibilidad de fuentes cercanas y demanda de cultivos activos, diferenciando explícitamente dato observado de estimación y pronóstico.

### Categoría 3: Territorio y Campo
8. **Mapa Territorial (`#map`):**
   - Visor cartográfico **Leaflet + OpenStreetMap** con capas para fuentes hídricas, reservorios/tanques/captación, mediciones georreferenciadas, pluviómetros, comunidades y parcelas.
   - Filtros por tipo de infraestructura, estado de disponibilidad, municipio y comunidad, leyenda cartográfica y popups con enlace directo a la Ficha Técnica y al Historial de Mediciones.
9. **Sitios y Comunidades (`#sites`), Parcelas y Cultivos (`#parcels`) y Observaciones Hídricas (`#observations`):**
   - Directorio de veredas y corregimientos, seguimiento de unidades productivas y cultivos asociados al agua, y bitácora de aforos y novedades de campo.

### Categoría 4: Reportes y Sistema
10. **Reportes y Exportación (`#reports`):**
    - 9 tipos de reporte incluyendo Estado de Disponibilidad Hídrica, Historial de Mediciones Hídricas y Balance Territorial por Comunidad y Municipio, con filtros por fecha, municipio y comunidad, exportación a CSV (UTF-8 BOM), JSON e impresión limpia.
10.1. **Registro de Auditoría (`#audit`):**
    - Trazabilidad en Firestore (`audit_logs`) de inicios y cierres de sesión, sincronizaciones con Firebase, creación/edición/eliminación de registros y comparación de valores anteriores vs. nuevos cuando el `SUPERADMINISTRADOR` modifica información de cualquier organización.
11. **Configuración y Respaldos (`#settings`):**
    - **Sincronizar Datos con Firebase (`hidroterra-32ce7`):** Análisis automático de registros locales en IndexedDB, vista previa de migración por organización, resolución de registros sin organización e importación idempotente por lotes hacia las colecciones de Firestore (`organizations`, `users`, `rain_events`, `pluviometers`, `water_sources`, `water_measurements`, `water_alerts`, `sites`, `parcels`, `crops`, `observations`, `audit_logs`, `public_directory`).
    - **Mi Perfil, Mi Organización, Seguridad y Gestión de Usuarios:** Administración de datos personales, perfil institucional y consentimiento del directorio público, cambio de contraseña con verificación PBKDF2 y gestión de usuarios por organización.
    - **Apariencia y Visualización:** Conmutador de **Modo Claro / Modo Oscuro** y opción configurable por el usuario para activar o desactivar el **globo flotante de texto completo** en controles o botones con puntos suspensivos (`...`), desactivada por defecto para evitar distracciones.
    - **Copias de Seguridad con Confirmación:** Exportación e importación de copias de seguridad JSON (`hidroterra-respaldo-AAAA-MM-DD.json`) con diálogo de confirmación previa antes de exportar, análisis previo (*Dry-Run*) al importar y retrocompatibilidad total.
12. **Acerca de y Manual (`#about`):**
    - Documentación institucional del proyecto, descripción de módulos, manual operativo paso a paso y preguntas frecuentes (FAQ).

---

## 2. Experiencia de Usuario, Adaptabilidad Móvil y Protección de Contenido

- **Estética Profesional y Limpia:** Íconos concentrados exclusivamente en las opciones principales del menú lateral y pines cartográficos, manteniendo todos los botones y textos de módulos limpios y legibles.
- **Adaptación de Textos Largos (`...`):** Truncado inteligente con puntos suspensivos en selectores (`select`), cajas de texto (`input`) y botones para evitar desbordamientos en pantallas pequeñas, con lectura emergente opcional configurable desde **Configuración y Respaldos**.
- **Cabecera Móvil Simplificada:** En pantallas móviles (`<= 768px`) se ocultan los botones de Modo Oscuro y Respaldo de la barra superior para priorizar el espacio útil, manteniéndolos disponibles dentro de **Configuración y Respaldos**.
- **Protección de Contenido y Copia Controlada:** Bloqueo de menú contextual (clic derecho), selección de texto y copia general en las vistas para evitar alteraciones o selecciones accidentales en campo, habilitando la copia únicamente en campos de formulario y áreas autorizadas (`[data-allow-copy="true"]`), como las coordenadas GPS de las fichas y el identificador único del dispositivo.

---

## 3. Tecnologías Empleadas

- **Frontend:** HTML5 semántico, CSS3 moderno (Variables, Flexbox, CSS Grid, Modo Claro/Oscuro), Bootstrap 5.3, JavaScript ES Modules nativo.
- **Persistencia Local:** IndexedDB nativo (`pana_v2_agua_db` v3) estructurado mediante migraciones versionadas y patrón Repositorio.
- **Cartografía:** Leaflet v1.9.4 + OpenStreetMap.
- **Gráficos Estadísticos:** Chart.js v4.4.2.
- **Meteorología:** API Open-Meteo (`https://api.open-meteo.com/v1/forecast`) con caché persistente en IndexedDB.
- **PWA Offline-First:** Web App Manifest (`manifest.json`) y Service Worker (`sw.js` `hidroterra-cache-v2.1.6`).

---

## 4. Instrucciones de Ejecución Local

En la raíz del proyecto, inicie un servidor HTTP estático:

```bash
python -m http.server 8000
```

- **Aplicación Principal:** `http://localhost:8000`
- **Suite de Pruebas Automatizadas (16 escenarios de gestión hídrica + suites base):** `http://localhost:8000/tests/test-runner.html`
