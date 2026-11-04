# PAnA V2 AGUA — Plataforma de Monitoreo Hídrico Rural
## Contexto Territorial: Montes de María, Colombia

**PAnA V2 AGUA** es una aplicación web progresiva (Progressive Web App - PWA) diseñada para el registro, seguimiento y consulta de fuentes de agua, pluviómetros comunitarios, mediciones de precipitación y condiciones productivas en las zonas rurales de Montes de María.

Diseñada bajo el principio **Offline-First**, la plataforma no depende de conexión constante a Internet, sensores IoT costosos ni bases de datos en la nube para su funcionamiento operativo. Todos los datos de negocio se almacenan de forma persistente y local en el navegador del dispositivo mediante **IndexedDB**.

---

## 1. Características Principales

- **Tablero de Control (Dashboard):** Métricas reales calculadas desde la base de datos local (fuentes, pluviómetros activos, mediciones de lluvia, precipitación acumulada del mes en mm, comunidades y parcelas). Gráfico de precipitación diaria con Chart.js y mapa territorial resumido.
- **Fuentes de Agua:** Registro de pozos, arroyos, ríos, manantiales, jagüeyes, reservorios y acueductos veredales con coordenadas GPS, estado observado, uso del agua y desactivación lógica.
- **Pluviómetros:** Fichas técnicas de equipos con captura de coordenadas por GPS del navegador (`navigator.geolocation`) o entrada manual decimal (WGS84), altitud en msnm, historial individual de lecturas y control de estado operativo.
- **Registro de Lluvias:** Formulario de captura en milímetros (mm, valores $\ge 0$), diferenciación entre fecha de medición y de creación, detección preventiva de registros duplicados en ventana de 60 minutos, tabla cronológica y agregaciones automáticas por día, mes o periodo personalizado.
- **Sitios y Comunidades:** Organización territorial de veredas y corregimientos en municipios como El Carmen de Bolívar, San Jacinto, San Juan Nepomuceno, Ovejas y Chalán.
- **Parcelas y Cultivos:** Registro opcional de predios y cultivos (ñame, yuca, maíz, hortalizas) para relacionar la demanda productiva con las precipitaciones.
- **Observaciones Hídricas:** Bitácora cualitativa de notas de campo sobre sequía, estado de fuentes y humedad del suelo.
- **Cartografía Interactiva (Leaflet + OpenStreetMap):** Marcadores diferenciados por tipo de elemento, filtros por categoría, ventanas emergentes y diseño resiliente con aviso informativo en modo sin conexión.
- **Reportes y Exportación:** Generación de 6 reportes territoriales, exportación a formato tabular CSV (con codificación UTF-8 BOM compatible con Microsoft Excel), exportación a JSON estructurado y vista de impresión limpia.
- **Respaldos y Seguridad:** Exportación completa de respaldo JSON (`pana-v2-agua-respaldo-AAAA-MM-DD.json`), importación con validación estricta de estructura y vista previa comparativa (*dry-run diff*), ofreciendo estrategias de **Restauración total** o **Combinación y actualización**.
- **PWA Instalable:** Service Worker con precaché de recursos locales (HTML, CSS, JS, iconos y bibliotecas vendor locales) para funcionamiento autónomo sin Internet.

---

## 2. Tecnologías Empleadas

- **Frontend:** HTML5 semántico, CSS3 moderno (Variables, Flexbox, CSS Grid), JavaScript ES Modules (sin frameworks pesados).
- **Persistencia Local:** IndexedDB nativo estructurado mediante el patrón Repositorio.
- **Cartografía:** Leaflet v1.9.4 (alojado localmente en `assets/vendor/leaflet/`).
- **Gráficos Estadísticos:** Chart.js v4.4.2 (alojado localmente en `assets/vendor/chartjs/`).
- **PWA:** Web App Manifest (`manifest.json`) y Service Worker (`sw.js`).
- **Geolocalización:** API Geolocation nativa del navegador con manejo de tolerancias y tiempos de espera.

---

## 3. Instrucciones de Ejecución Local

Debido a que los navegadores modernos restringen el uso de **ES Modules**, **IndexedDB** y **Service Workers** bajo el protocolo `file:///`, la aplicación debe ejecutarse a través de un servidor HTTP local.

### Opción A: Servidor HTTP con Python 3 (Recomendado)

En la raíz del proyecto, ejecute en su terminal o PowerShell:

```bash
python -m http.server 8000
```

Abra su navegador web en la dirección:
**`http://localhost:8000`**

### Opción B: Visual Studio Code (Live Server)

1. Abra la carpeta del proyecto en Visual Studio Code.
2. Haga clic derecho sobre `index.html` y seleccione **«Open with Live Server»**.
3. El navegador abrirá automáticamente la aplicación en `http://127.0.0.1:5500`.

---

## 4. Instalación como PWA y Modo Offline

### Instalación en el dispositivo:
- **Computador (Chrome / Edge):** En la barra de direcciones aparecerá un icono de instalación (pantalla con flecha). Haga clic en **«Instalar PAnA V2 AGUA»**.
- **Teléfono Móvil (Android / Chrome):** Abra el menú de opciones del navegador (tres puntos) y presione **«Instalar aplicación»** o **«Agregar a la pantalla principal»**.

### Comprobación sin conexión:
1. Abra la aplicación una primera vez con conexión para que el Service Worker almacene en caché los recursos estáticos.
2. Desconecte el Wi-Fi, los datos móviles o active el modo avión (o simule *Offline* desde las herramientas de desarrollador F12 > pestaña *Network*).
3. Recargue la aplicación: comprobará que arranca de inmediato, el indicador superior cambia a **«Sin Conexión (Offline)»** y todas las funciones de creación, consulta, edición y exportación continúan operando normalmente.

---

## 5. Gestión de Respaldos (Copias de Seguridad)

### Almacenamiento local y limitaciones:
La base de datos se guarda en el perfil local del navegador (IndexedDB). Si el usuario borra intencionalmente el historial o los datos de navegación del sitio, o si cambia de teléfono/computador, la base de datos local puede reiniciarse.

### Exportación periódica recomendada:
- Diríjase a **«Respaldo y Datos»** o use el botón rápido **«Respaldo JSON»** en el encabezado.
- Guarde el archivo descargado en una memoria USB, carpeta personal o compártalo con el equipo técnico local.

### Restauración e Importación:
- Presione **«Seleccionar Archivo JSON...»**.
- El sistema analizará el archivo y mostrará un modal con el desglose exacto de registros nuevos y registros existentes.
- Puede elegir entre **«Combinar y Actualizar»** (mantiene los datos actuales y agrega los del archivo) o **«Restaurar copia exacta»** (vacía la base previa tras descargar un respaldo preventivo de seguridad).

---

## 6. Ejecución de la Suite de Pruebas Automatizadas

La aplicación cuenta con una suite de pruebas unitarias verificables directamente en el navegador.

1. Con el servidor local en marcha, acceda a:
**`http://localhost:8000/tests/test-runner.html`**
2. Se ejecutarán automáticamente las pruebas de:
   - Validadores de latitud (-90 a 90), longitud (-180 a 180), precipitación (números $\ge 0$) y saneamiento XSS.
   - Cálculo determinista de acumulados diarios, mensuales y totales de lluvia.
   - Detección preventiva de lecturas duplicadas en umbral temporal.
   - Validación de esquema de respaldo JSON y detección de archivos inválidos.
   - Operaciones CRUD e integridad referencial (prohibición de borrado de pluviómetros con historial de mediciones).

---

## 7. Preparación para Fase 2: Futura Nube y API REST

El software fue concebido con separación de capas para facilitar la futura transición a un backend centralizado sin rehacer la interfaz:

- **Capa de Dominio y Modelos:** Entidades con identificadores universales estables (`id: UUID v4`) y marcas temporales en ISO 8601 (`createdAt`, `updatedAt`).
- **Capa de Repositorios:** Repositorio base estandarizado (`BaseRepository`) que expone métodos `getAll`, `getById`, `create`, `update`, `delete` y `saveBatch`. En Fase 2, bastará con sustituir el adaptador de bajo nivel por un cliente HTTP REST sin modificar las vistas ni los formularios.
- **Adaptador de Sincronización:** Definido en `src/infrastructure/sync/sync-adapter.js` con los contratos para la gestión de colas pendientes, envío por lotes (*push/pull*) y resolución determinista de conflictos por marca temporal.
