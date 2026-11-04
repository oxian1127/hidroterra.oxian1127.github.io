# HIDROTERRA — Plataforma de Monitoreo Hídrico Rural, Gestión Territorial y Análisis Agroclimático
## Contexto Territorial: Montes de María, Colombia

**HIDROTERRA** es una aplicación web progresiva (**Progressive Web App - PWA**) diseñada para el registro, monitoreo periódico, análisis agroclimático y gestión comunitaria de los recursos hídricos en territorios rurales, inicialmente en la subregión de **Montes de María (Bolívar y Sucre, Colombia)**.

Diseñada bajo el principio **Offline-First**, la plataforma funciona de forma 100% autónoma en campo sin depender de conexión constante a Internet ni servidores externos para su operación diaria. Todos los datos se almacenan localmente en **IndexedDB (v3)** con identificadores universales (`UUID v4`), marcas temporales ISO 8601 y cola de operaciones lista para sincronización futura con un backend centralizado.

---

## 1. Módulos y Características Principales

1. **Panel Principal Ampliado (`#dashboard`):**
   - Indicadores en tiempo real de fuentes hídricas registradas, fuentes con disponibilidad alta/moderada vs. baja/crítica, volumen total estimado disponible frente a capacidad registrada, pluviómetros activos, lluvia acumulada del mes y alertas hídricas activas.
   - Gráficos interactivos de evolución de disponibilidad hídrica y precipitación diaria de los últimos 30 días.
   - Mapa territorial resumido, tabla de mediciones hídricas recientes y accesos rápidos de campo.
2. **Fuentes de Agua e Infraestructura (`#water-sources`):**
   - Inventario de pozos, aljibes, jagüeyes, reservorios, manantiales, arroyos, ríos, quebradas, acueductos rurales, tanques comunitarios, puntos de captación de agua lluvia y sistemas de almacenamiento.
   - Registro de capacidad conocida en litros (`knownCapacityLiters`), profundidad de referencia (`referenceDepthMeters`), fotografía opcional (`photoDataUrl`), coordenadas GPS y acceso directo a la Ficha Técnica de Disponibilidad.
3. **Monitoreo de Disponibilidad Hídrica (`#water-availability`):**
   - Registro periódico de mediciones de nivel, caudal o volumen (`m`, `cm`, `L`, `m3`, `%`, `l_s`) mediante 6 métodos de campo (regla graduada, cinta/sonda, aforo volumétrico, estimación visual, sensor o medición manual directa).
   - Clasificación automática por tipo de fuente en `alta`, `moderada`, `baja`, `critica` o `sin_informacion`.
   - Gráficos de evolución histórica (Chart.js), comparador de mediciones entre dos fechas y **Ficha Técnica de Disponibilidad** con balance climático y demanda de cultivos asociados.
4. **Herramientas y Calculadoras Hídricas (`#water-tools`):**
   - **Captación de Agua Lluvia:** Cálculo mediante $V = P \times A \times C$ con preseteo desde pluviómetros registrados y coeficientes por tipo de cubierta.
   - **Capacidad de Almacenamiento:** Cálculo geométrico para tanques cilíndricos, rectangulares/cisternas, reservorios/jagüeyes con factor de talud y geometría personalizada.
   - **Balance Hídrico Simplificado:** $\text{Almacenamiento final} = \text{Almacenamiento inicial} + \text{Entradas} - \text{Salidas} - \text{Pérdidas}$.
   - **Autonomía Hídrica:** Estimación de días de reserva según demanda familiar, pecuaria, riego agrícola y margen de seguridad.
5. **Sistema de Alertas Hídricas (`#water-alerts`):**
   - Generación y evaluación de alertas basadas exclusivamente en datos reales: fuente en nivel crítico, disponibilidad baja, descenso consecutivo de nivel, ausencia de lluvias, pronóstico de lluvia intensa y fuentes sin medición reciente.
   - Flujo para marcar alertas como **Atendidas** con fecha y nota técnica de resolución, más panel de configuración de umbrales.
6. **Pluviómetros (`#pluviometers`) y Registro de Lluvias (`#rainfall`):**
   - Fichas técnicas georreferenciadas, captura de precipitación en milímetros (`mm`), control de lecturas duplicadas y acumulados diarios/mensuales.
7. **Clima y Meteorología — HIDROTERRA CLIMA (`#climate`):**
   - Integración con **Open-Meteo** (`America/Bogota`), pronóstico horario (24 h) y diario (7 días), evapotranspiración FAO $\text{ET}_0$, humedad del suelo y caché local (`weather_cache`).
   - **Balance Hídrico Climático Integrado:** Cruce entre pronóstico, lluvia real medida en pluviómetros, disponibilidad de fuentes cercanas y demanda de cultivos activos, diferenciando explícitamente dato observado de estimación y pronóstico.
8. **Mapa Territorial Ampliado (`#map`):**
   - Visor cartográfico **Leaflet + OpenStreetMap** con capas para fuentes hídricas, reservorios/tanques/captación, mediciones georreferenciadas, pluviómetros, comunidades y parcelas.
   - Filtros por tipo de infraestructura, estado de disponibilidad, municipio y comunidad, leyenda cartográfica y popups con enlace directo a la Ficha Técnica y al Historial de Mediciones.
9. **Reportes e Indicadores Territoriales (`#reports`):**
   - 9 tipos de reporte incluyendo Estado de Disponibilidad Hídrica, Historial de Mediciones Hídricas y Balance Territorial por Comunidad y Municipio, con filtros por fecha, municipio y comunidad, exportación a CSV (UTF-8 BOM), JSON e impresión limpia.
10. **Respaldo, Datos y Sincronización (`#settings`):**
    - Exportación e importación de copias de seguridad JSON (`hidroterra-respaldo-AAAA-MM-DD.json`) con análisis previo (*Dry-Run*) y retrocompatibilidad total con respaldos anteriores.

---

## 2. Tecnologías Empleadas

- **Frontend:** HTML5 semántico, CSS3 moderno (Variables, Flexbox, CSS Grid, Modo Claro/Oscuro), Bootstrap 5.3, JavaScript ES Modules nativo.
- **Persistencia Local:** IndexedDB nativo (`pana_v2_agua_db` v3) estructurado mediante migraciones versionadas y patrón Repositorio.
- **Cartografía:** Leaflet v1.9.4 + OpenStreetMap.
- **Gráficos Estadísticos:** Chart.js v4.4.2.
- **Meteorología:** API Open-Meteo (`https://api.open-meteo.com/v1/forecast`) con caché persistente en IndexedDB.
- **PWA Offline-First:** Web App Manifest (`manifest.json`) y Service Worker (`sw.js` `hidroterra-cache-v2.0.0`).

---

## 3. Instrucciones de Ejecución Local

En la raíz del proyecto, inicie un servidor HTTP estático:

```bash
python -m http.server 8000
```

- **Aplicación Principal:** `http://localhost:8000`
- **Suite de Pruebas Automatizadas (16 escenarios de gestión hídrica + suites base):** `http://localhost:8000/tests/test-runner.html`
