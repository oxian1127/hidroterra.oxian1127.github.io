/**
 * Servicio de Aplicación: Parcelas y Cultivos (Parcels & Crops Service)
 */

import { Parcel } from '../domain/models/Parcel.js';
import { Crop } from '../domain/models/Crop.js';
import { parcelRepository } from '../infrastructure/database/repositories/parcel.repository.js';
import { cropRepository } from '../infrastructure/database/repositories/crop.repository.js';
import { assertCanDeleteParcel } from '../domain/rules/data-integrity.rules.js';
import { ValidationError } from '../core/errors.js';

export class ParcelsService {
  static async getAll(filters = {}) {
    let list = await parcelRepository.getAll();

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.responsible && p.responsible.toLowerCase().includes(q))
      );
    }

    if (filters.status && filters.status !== 'all') {
      list = list.filter(p => p.status === filters.status);
    }

    if (filters.siteId && filters.siteId !== 'all') {
      list = list.filter(p => p.siteId === filters.siteId);
    }

    return list.sort((a, b) => a.code.localeCompare(b.code));
  }

  static async getById(id) {
    return await parcelRepository.getById(id);
  }

  static async create(data) {
    const model = new Parcel(data);
    model.validate();

    const existing = await parcelRepository.getByCode(model.code);
    if (existing) {
      throw new ValidationError(`Ya existe una parcela con el código "${model.code}".`);
    }

    return await parcelRepository.create(model.toJSON());
  }

  static async update(id, data) {
    const current = await parcelRepository.getById(id);
    if (!current) throw new ValidationError('Parcela no encontrada.');

    const model = new Parcel({ ...current, ...data, id });
    model.validate();

    if (model.code !== current.code) {
      const existing = await parcelRepository.getByCode(model.code);
      if (existing && existing.id !== id) {
        throw new ValidationError(`Ya existe otra parcela con el código "${model.code}".`);
      }
    }

    return await parcelRepository.update(id, model.toJSON());
  }

  static async delete(id) {
    const crops = await cropRepository.getByParcelId(id);
    assertCanDeleteParcel(id, crops);
    return await parcelRepository.delete(id);
  }

  // Métodos de Cultivos vinculados
  static async getCrops(parcelId = null) {
    if (parcelId) {
      return await cropRepository.getByParcelId(parcelId);
    }
    return await cropRepository.getAll();
  }

  /**
   * Valida que el área asignada al cultivo no supere el área total de la parcela
   * ni la capacidad disponible considerando los demás cultivos ya registrados.
   */
  static async validateCropArea(parcelId, cropArea, excludeCropId = null) {
    const parcel = await parcelRepository.getById(parcelId);
    if (!parcel) {
      throw new ValidationError('La parcela asociada al cultivo no existe.');
    }

    if (cropArea !== null && cropArea !== undefined && cropArea !== '') {
      const nCropArea = Number(cropArea);

      if (parcel.area !== null && parcel.area !== undefined && Number(parcel.area) > 0) {
        let parcelTotalArea = Number(parcel.area);
        let unit = 'ha';
        if (parcel.areaUnit === 'metros_cuadrados') {
          parcelTotalArea = parcelTotalArea / 10000; // convert m² to ha
        }

        if (nCropArea > parcelTotalArea) {
          throw new ValidationError(
            `El área del cultivo (${nCropArea} ${unit}) no puede ser mayor que el área total de la parcela "${parcel.name}" (${parcelTotalArea.toFixed(2)} ${unit}).`
          );
        }

        const existingCrops = await cropRepository.getByParcelId(parcelId);
        const otherCrops = existingCrops.filter(c => (!excludeCropId || c.id !== excludeCropId) && c.status !== 'perdido');
        const occupiedArea = otherCrops.reduce((sum, c) => sum + (Number(c.cropArea) || 0), 0);
        const roundedOccupied = Math.round(occupiedArea * 100) / 100;
        const availableArea = Math.max(0, Math.round((parcelTotalArea - occupiedArea) * 100) / 100);

        if (nCropArea > availableArea) {
          throw new ValidationError(
            `El área del cultivo (${nCropArea} ${unit}) supera el área disponible en la parcela "${parcel.name}" (${availableArea} ${unit}). ` +
            `Área total: ${parcelTotalArea} ${unit}, actualmente sembrada por otros cultivos: ${roundedOccupied} ${unit}.`
          );
        }
      }
    }
  }

  static async createCrop(data) {
    const model = new Crop(data);
    model.validate();

    await this.validateCropArea(model.parcelId, model.cropArea, null);

    return await cropRepository.create(model.toJSON());
  }

  static async updateCrop(id, data) {
    const current = await cropRepository.getById(id);
    if (!current) throw new ValidationError('Cultivo no encontrado.');

    const model = new Crop({ ...current, ...data, id });
    model.validate();

    await this.validateCropArea(model.parcelId, model.cropArea, id);

    return await cropRepository.update(id, model.toJSON());
  }

  static async deleteCrop(id) {
    return await cropRepository.delete(id);
  }
}
