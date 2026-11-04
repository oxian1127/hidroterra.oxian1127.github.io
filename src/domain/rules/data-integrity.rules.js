/**
 * Reglas de integridad referencial y protección de datos
 */

import { IntegrityError } from '../../core/errors.js';

export function assertCanDeletePluviometer(pluviometerId, rainfallRecords) {
  if (!rainfallRecords || !Array.isArray(rainfallRecords)) return true;
  const count = rainfallRecords.filter(r => r.pluviometerId === pluviometerId).length;
  if (count > 0) {
    throw new IntegrityError(
      `No se puede eliminar físicamente el pluviómetro porque tiene ${count} mediciones de lluvia vinculadas. Para conservar la trazabilidad de los datos, cambie su estado a "Retirado".`,
      { pluviometerId, rainfallRecordsCount: count }
    );
  }
  return true;
}

export function assertCanDeleteSite(siteId, { waterSources = [], pluviometers = [], parcels = [] }) {
  const sourcesCount = waterSources.filter(s => s.siteId === siteId).length;
  const pluvsCount = pluviometers.filter(p => p.siteId === siteId).length;
  const parcelsCount = parcels.filter(p => p.siteId === siteId).length;

  const total = sourcesCount + pluvsCount + parcelsCount;
  if (total > 0) {
    const details = [];
    if (sourcesCount > 0) details.push(`${sourcesCount} fuentes de agua`);
    if (pluvsCount > 0) details.push(`${pluvsCount} pluviómetros`);
    if (parcelsCount > 0) details.push(`${parcelsCount} parcelas`);

    throw new IntegrityError(
      `No se puede eliminar la comunidad o sitio porque tiene elementos vinculados: ${details.join(', ')}. Desvincule o reasigne los elementos antes de eliminarlo.`,
      { siteId, sourcesCount, pluvsCount, parcelsCount }
    );
  }
  return true;
}

export function assertCanDeleteParcel(parcelId, crops = []) {
  const cropsCount = crops.filter(c => c.parcelId === parcelId).length;
  if (cropsCount > 0) {
    throw new IntegrityError(
      `No se puede eliminar la parcela porque tiene ${cropsCount} registros de cultivos asociados. Elimine primero los cultivos o cambie el estado de la parcela a "Inactiva".`,
      { parcelId, cropsCount }
    );
  }
  return true;
}

export function assertCanDeleteWaterSource(sourceId, waterMeasurements = []) {
  if (!waterMeasurements || !Array.isArray(waterMeasurements)) return true;
  const count = waterMeasurements.filter(m => m.sourceId === sourceId).length;
  if (count > 0) {
    throw new IntegrityError(
      `No se puede eliminar físicamente la fuente hídrica porque tiene ${count} mediciones de disponibilidad vinculadas. Para conservar la trazabilidad histórica, utilice la opción de desactivar la fuente.`,
      { sourceId, waterMeasurementsCount: count }
    );
  }
  return true;
}
