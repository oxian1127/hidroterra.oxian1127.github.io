/**
 * Reglas de Dominio: Herramientas y Calculadoras Hídricas (Sección 5)
 * Implementa las 4 calculadoras técnicas reutilizables:
 * 5.1 Captación de agua lluvia (V = P * A * C)
 * 5.2 Almacenamiento por geometría (Cilíndrico, Rectangular, Reservorio, Personalizado)
 * 5.3 Balance hídrico simplificado (Af = Ai + Entradas - Salidas - Pérdidas)
 * 5.4 Autonomía hídrica (Días de reserva según demanda diaria)
 */

import { ValidationError } from '../../core/errors.js';

/**
 * Coeficientes de escorrentía / eficiencia típicos para superficies de captación rural
 */
export const ROOF_SURFACE_TYPES = {
  teja_metalica: { label: 'Lámina metálica / Zinc / Aluzinc', defaultCoeff: 0.85, range: '0.80 – 0.90' },
  teja_barro: { label: 'Teja de barro / Arcilla cocida', defaultCoeff: 0.75, range: '0.70 – 0.80' },
  fibrocemento: { label: 'Cubierta de fibrocemento / Placa', defaultCoeff: 0.80, range: '0.75 – 0.85' },
  concreto: { label: 'Placa de concreto / Terraza impermeabilizada', defaultCoeff: 0.85, range: '0.80 – 0.90' },
  plastico_invernadero: { label: 'Polietileno / Geomembrana / Marquesina', defaultCoeff: 0.90, range: '0.85 – 0.92' },
  suelo_compactado: { label: 'Patio de tierra compactada / Ladera tratada', defaultCoeff: 0.35, range: '0.25 – 0.50' },
  personalizado: { label: 'Otra superficie (coeficiente personalizado)', defaultCoeff: 0.80, range: '0.10 – 1.00' }
};

/**
 * 5.1 Calculadora de Captación de Agua Lluvia
 * Fórmula: V = P * A * C
 * Donde 1 mm de precipitación sobre 1 m² equivale a 1 litro.
 * Diferencia explícitamente la captación teórica bruta (C = 1.0) de la captación real efectiva (con C y descarte de primeras aguas).
 */
export function calculateRainwaterHarvesting({
  precipitationMm,
  catchmentAreaM2,
  surfaceType = 'teja_metalica',
  runoffCoefficient = null,
  firstFlushMm = 0,
  periodLabel = 'Evento / Periodo consultado',
  isForecastedPrecipitation = false
}) {
  const P = Number(precipitationMm);
  const A = Number(catchmentAreaM2);
  const surfaceConfig = ROOF_SURFACE_TYPES[surfaceType] || ROOF_SURFACE_TYPES.personalizado;
  const C = runoffCoefficient !== null && runoffCoefficient !== undefined && runoffCoefficient !== ''
    ? Number(runoffCoefficient)
    : surfaceConfig.defaultCoeff;
  const flushMm = firstFlushMm !== null && firstFlushMm !== undefined && firstFlushMm !== ''
    ? Number(firstFlushMm)
    : 0;

  if (!Number.isFinite(P) || P < 0) {
    throw new ValidationError('La precipitación (P) debe ser un número mayor o igual a 0 mm.');
  }
  if (!Number.isFinite(A) || A <= 0) {
    throw new ValidationError('El área de captación (A) debe ser un número positivo mayor a 0 m².');
  }
  if (!Number.isFinite(C) || C <= 0 || C > 1) {
    throw new ValidationError('El coeficiente de escorrentía (C) debe estar entre 0.01 y 1.00.');
  }
  if (!Number.isFinite(flushMm) || flushMm < 0) {
    throw new ValidationError('El descarte de primeras aguas debe ser un número mayor o igual a 0 mm.');
  }

  // Captación teórica bruta (100% de la lluvia caída sobre el área: P * A)
  const theoreticalVolumeLiters = Number((P * A).toFixed(1));
  const theoreticalVolumeM3 = Number((theoreticalVolumeLiters / 1000).toFixed(3));

  // Precipitación efectiva tras pérdidas por absorción/evaporación en cubierta (C) y desvío de lavado inicial
  const netPrecipitationMm = Math.max(0, P - flushMm);
  const realEffectiveVolumeLiters = Number((netPrecipitationMm * A * C).toFixed(1));
  const realEffectiveVolumeM3 = Number((realEffectiveVolumeLiters / 1000).toFixed(3));

  // Volumen sin descarte de primeras aguas pero aplicando coeficiente C (V = P * A * C puro)
  const formulaVolumeLiters = Number((P * A * C).toFixed(1));
  const formulaVolumeM3 = Number((formulaVolumeLiters / 1000).toFixed(3));

  const lossesLiters = Number((theoreticalVolumeLiters - realEffectiveVolumeLiters).toFixed(1));

  return {
    precipitationMm: P,
    catchmentAreaM2: A,
    surfaceType,
    surfaceLabel: surfaceConfig.label,
    runoffCoefficient: C,
    firstFlushMm: flushMm,
    periodLabel,
    precipitationSourceType: isForecastedPrecipitation ? 'pronosticada' : 'registrada',
    // Captación teórica (sin pérdidas, C = 1.0)
    theoreticalVolumeLiters,
    theoreticalVolumeM3,
    // Captación según fórmula directa V = P * A * C
    formulaVolumeLiters,
    formulaVolumeM3,
    // Captación real aprovechable (aplicando C y descarte de primeras aguas si se configuró)
    realEffectiveVolumeLiters,
    realEffectiveVolumeM3,
    lossesLiters
  };
}

/**
 * 5.2 Calculadora de Almacenamiento Hídrico
 * Soporta:
 * - Tanque cilíndrico (diámetro o radio, altura total, nivel actual de agua)
 * - Tanque rectangular (largo, ancho, altura total, nivel actual de agua)
 * - Reservorio rectangular / trapezoidal (largo, ancho, profundidad total, factor de talud, nivel actual)
 * - Depósito de dimensiones o capacidad personalizada
 */
export function calculateStorageCapacity({
  geometry = 'cilindrico',
  diameterMeters = null,
  lengthMeters = null,
  widthMeters = null,
  totalHeightMeters = null,
  currentWaterLevelMeters = null,
  slopeFactor = 1.0, // 1.0 para paredes verticales; ~0.75-0.85 para reservorios excavados con talud
  customTotalCapacityLiters = null,
  customCurrentVolumeLiters = null,
  dailyDemandLiters = null,
  reserveDaysTarget = null
}) {
  let totalCapacityM3 = 0;
  let availableVolumeM3 = 0;
  let formulaUsed = '';

  const H = totalHeightMeters !== null && totalHeightMeters !== '' ? Number(totalHeightMeters) : null;
  const hWater = currentWaterLevelMeters !== null && currentWaterLevelMeters !== ''
    ? Number(currentWaterLevelMeters)
    : H;

  if (geometry === 'cilindrico') {
    const D = Number(diameterMeters);
    if (!Number.isFinite(D) || D <= 0) {
      throw new ValidationError('El diámetro del tanque cilíndrico debe ser mayor a 0 metros.');
    }
    if (H === null || !Number.isFinite(H) || H <= 0) {
      throw new ValidationError('La altura total del tanque cilíndrico debe ser mayor a 0 metros.');
    }
    if (hWater !== null && (!Number.isFinite(hWater) || hWater < 0 || hWater > H)) {
      throw new ValidationError(`El nivel actual de agua debe estar entre 0 y la altura total (${H} m).`);
    }
    const radius = D / 2;
    const areaBase = Math.PI * radius * radius;
    totalCapacityM3 = areaBase * H;
    availableVolumeM3 = areaBase * (hWater !== null ? hWater : 0);
    formulaUsed = 'V = π × (D/2)² × h';
  } else if (geometry === 'rectangular' || geometry === 'reservorio_rectangular') {
    const L = Number(lengthMeters);
    const W = Number(widthMeters);
    const factor = geometry === 'reservorio_rectangular'
      ? (slopeFactor !== null && slopeFactor !== '' ? Number(slopeFactor) : 0.85)
      : 1.0;

    if (!Number.isFinite(L) || L <= 0) {
      throw new ValidationError('El largo debe ser mayor a 0 metros.');
    }
    if (!Number.isFinite(W) || W <= 0) {
      throw new ValidationError('El ancho debe ser mayor a 0 metros.');
    }
    if (H === null || !Number.isFinite(H) || H <= 0) {
      throw new ValidationError('La altura o profundidad total debe ser mayor a 0 metros.');
    }
    if (hWater !== null && (!Number.isFinite(hWater) || hWater < 0 || hWater > H)) {
      throw new ValidationError(`El nivel actual de agua debe estar entre 0 y la profundidad total (${H} m).`);
    }
    if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
      throw new ValidationError('El factor geométrico de talud debe estar entre 0.1 y 1.0.');
    }

    totalCapacityM3 = L * W * H * factor;
    availableVolumeM3 = L * W * (hWater !== null ? hWater : 0) * factor;
    formulaUsed = geometry === 'reservorio_rectangular'
      ? `V = L × A × H × C_talud (${factor})`
      : 'V = Largo × Ancho × Alto';
  } else if (geometry === 'personalizado') {
    const capL = Number(customTotalCapacityLiters);
    const curL = customCurrentVolumeLiters !== null && customCurrentVolumeLiters !== ''
      ? Number(customCurrentVolumeLiters)
      : 0;

    if (!Number.isFinite(capL) || capL <= 0) {
      throw new ValidationError('La capacidad total del depósito personalizado debe ser mayor a 0 litros.');
    }
    if (!Number.isFinite(curL) || curL < 0 || curL > capL) {
      throw new ValidationError(`El volumen actual debe estar entre 0 y la capacidad máxima (${capL} L).`);
    }

    totalCapacityM3 = capL / 1000;
    availableVolumeM3 = curL / 1000;
    formulaUsed = 'Volumen nominal personalizado';
  } else {
    throw new ValidationError('Geometría de almacenamiento no reconocida.');
  }

  const totalCapacityLiters = Number((totalCapacityM3 * 1000).toFixed(1));
  totalCapacityM3 = Number(totalCapacityM3.toFixed(3));

  const availableVolumeLiters = Number((availableVolumeM3 * 1000).toFixed(1));
  availableVolumeM3 = Number(availableVolumeM3.toFixed(3));

  const missingVolumeLiters = Math.max(0, Number((totalCapacityLiters - availableVolumeLiters).toFixed(1)));
  const missingVolumeM3 = Number((missingVolumeLiters / 1000).toFixed(3));

  const fillPercentage = totalCapacityLiters > 0
    ? Number(((availableVolumeLiters / totalCapacityLiters) * 100).toFixed(1))
    : 0;

  // Capacidad requerida según demanda diaria y días objetivo (opcional)
  let requiredCapacityLiters = null;
  let requiredCapacityM3 = null;
  let capacityDeficitLiters = null;

  if (dailyDemandLiters && Number(dailyDemandLiters) > 0 && reserveDaysTarget && Number(reserveDaysTarget) > 0) {
    requiredCapacityLiters = Number((Number(dailyDemandLiters) * Number(reserveDaysTarget)).toFixed(1));
    requiredCapacityM3 = Number((requiredCapacityLiters / 1000).toFixed(3));
    capacityDeficitLiters = Number((requiredCapacityLiters - totalCapacityLiters).toFixed(1));
  }

  return {
    geometry,
    formulaUsed,
    totalCapacityLiters,
    totalCapacityM3,
    availableVolumeLiters,
    availableVolumeM3,
    missingVolumeLiters,
    missingVolumeM3,
    fillPercentage,
    requiredCapacityLiters,
    requiredCapacityM3,
    capacityDeficitLiters
  };
}

/**
 * 5.3 Calculadora de Balance Hídrico Simplificado
 * Fórmula: Almacenamiento final = Almacenamiento inicial + Entradas - Salidas - Pérdidas
 * Advierte cuando los datos son insuficientes y aclara que es una aproximación operativa.
 */
export function calculateSimplifiedWaterBalance({
  initialStorageLiters = null,
  precipitationMm = null,
  catchmentAreaM2 = null,
  runoffCoefficient = 0.8,
  otherInflowsLiters = 0,
  estimatedConsumptionLiters = null,
  estimatedLossesLiters = 0,
  maxStorageCapacityLiters = null
}) {
  const warnings = [];

  if (initialStorageLiters === null || initialStorageLiters === '' || initialStorageLiters === undefined) {
    warnings.push('No se especificó el almacenamiento inicial; se asumió 0 L.');
  }
  if (estimatedConsumptionLiters === null || estimatedConsumptionLiters === '' || estimatedConsumptionLiters === undefined) {
    warnings.push('No se ingresó el consumo estimado (salidas); el balance podría sobrestimar la reserva final.');
  }

  const Ai = Number(initialStorageLiters) || 0;
  const P = Number(precipitationMm) || 0;
  const A = Number(catchmentAreaM2) || 0;
  const C = Number(runoffCoefficient) || 0.8;
  const otherIn = Number(otherInflowsLiters) || 0;
  const out = Number(estimatedConsumptionLiters) || 0;
  const losses = Number(estimatedLossesLiters) || 0;

  if (Ai < 0 || P < 0 || A < 0 || otherIn < 0 || out < 0 || losses < 0) {
    throw new ValidationError('Todos los volúmenes, áreas y precipitaciones del balance deben ser valores mayores o iguales a cero.');
  }

  const harvestedInflowLiters = (P > 0 && A > 0) ? Number((P * A * C).toFixed(1)) : 0;
  if (P > 0 && A === 0) {
    warnings.push('Se ingresó precipitación en mm pero no se indicó área de captación (m²); la entrada por captación pluvial es 0 L.');
  }

  const totalInflowsLiters = Number((harvestedInflowLiters + otherIn).toFixed(1));
  const totalOutflowsAndLossesLiters = Number((out + losses).toFixed(1));

  // Balance: Almacenamiento final = Almacenamiento inicial + Entradas - Salidas - Pérdidas
  const rawFinalStorageLiters = Number((Ai + totalInflowsLiters - out - losses).toFixed(1));

  let effectiveFinalStorageLiters = Math.max(0, rawFinalStorageLiters);
  let overflowSpillLiters = 0;
  let unfulfilledDemandLiters = rawFinalStorageLiters < 0 ? Math.abs(rawFinalStorageLiters) : 0;

  if (maxStorageCapacityLiters !== null && maxStorageCapacityLiters !== '' && Number(maxStorageCapacityLiters) > 0) {
    const cap = Number(maxStorageCapacityLiters);
    if (effectiveFinalStorageLiters > cap) {
      overflowSpillLiters = Number((effectiveFinalStorageLiters - cap).toFixed(1));
      effectiveFinalStorageLiters = cap;
      warnings.push(`El volumen final supera la capacidad máxima del depósito (${cap} L); se produciría un rebose estimado de ${overflowSpillLiters} L.`);
    }
  }

  const netVariationLiters = Number((totalInflowsLiters - totalOutflowsAndLossesLiters).toFixed(1));

  return {
    initialStorageLiters: Ai,
    harvestedInflowLiters,
    otherInflowsLiters: otherIn,
    totalInflowsLiters,
    estimatedConsumptionLiters: out,
    estimatedLossesLiters: losses,
    totalOutflowsAndLossesLiters,
    rawFinalStorageLiters,
    effectiveFinalStorageLiters,
    effectiveFinalStorageM3: Number((effectiveFinalStorageLiters / 1000).toFixed(3)),
    netVariationLiters,
    overflowSpillLiters,
    unfulfilledDemandLiters,
    isDeficit: rawFinalStorageLiters < 0,
    hasInsufficientData: warnings.length > 0,
    warnings,
    methodologyDisclaimer: 'Nota técnica: Este balance hídrico simplificado es una herramienta operativa de apoyo comunitario y predial. No reemplaza un estudio hidrológico de cuenca ni modela infiltración profunda o tránsito de crecientes.'
  };
}

/**
 * 5.4 Calculadora de Autonomía Hídrica
 * Estima cuántos días puede mantenerse una reserva de agua según volumen disponible y demanda.
 */
export function calculateWaterAutonomy({
  availableVolumeLiters,
  usersOrUnitsCount = 1,
  dailyConsumptionPerUnitLiters = null,
  directTotalDailyDemandLiters = null,
  safetyMarginPct = 10,
  unitTypeLabel = 'personas'
}) {
  const V = Number(availableVolumeLiters);
  if (!Number.isFinite(V) || V < 0) {
    throw new ValidationError('El volumen disponible debe ser un número mayor o igual a 0 litros.');
  }

  let dailyDemandLiters = 0;
  const count = Number(usersOrUnitsCount) || 0;
  const perUnit = Number(dailyConsumptionPerUnitLiters) || 0;
  const directDemand = Number(directTotalDailyDemandLiters) || 0;

  if (directDemand > 0) {
    dailyDemandLiters = directDemand;
  } else if (count > 0 && perUnit > 0) {
    dailyDemandLiters = Number((count * perUnit).toFixed(1));
  } else {
    throw new ValidationError('Debe ingresar una demanda diaria total mayor a 0 L/día o el número de usuarios/unidades junto con su consumo unitario.');
  }

  const margin = Number.isFinite(Number(safetyMarginPct))
    ? Math.min(50, Math.max(0, Number(safetyMarginPct)))
    : 0;

  const usableVolumeLiters = Number((V * (1 - margin / 100)).toFixed(1));
  const theoreticalAutonomyDays = Number((V / dailyDemandLiters).toFixed(1));
  const safeAutonomyDays = Number((usableVolumeLiters / dailyDemandLiters).toFixed(1));

  let autonomyClassification = 'critica';
  if (safeAutonomyDays >= 30) autonomyClassification = 'alta';
  else if (safeAutonomyDays >= 15) autonomyClassification = 'moderada';
  else if (safeAutonomyDays >= 7) autonomyClassification = 'baja';

  return {
    availableVolumeLiters: V,
    availableVolumeM3: Number((V / 1000).toFixed(3)),
    usableVolumeLiters,
    safetyMarginPct: margin,
    usersOrUnitsCount: count,
    dailyConsumptionPerUnitLiters: perUnit,
    unitTypeLabel,
    totalDailyDemandLiters: dailyDemandLiters,
    theoreticalAutonomyDays,
    safeAutonomyDays,
    autonomyClassification,
    conditionsSummary: `Volumen disponible: ${V.toLocaleString('es-CO')} L (${(V / 1000).toFixed(2)} m³) | Demanda diaria total: ${dailyDemandLiters.toLocaleString('es-CO')} L/día${count > 0 && perUnit > 0 ? ` (${count} ${unitTypeLabel} × ${perUnit} L/día)` : ''} | Margen de reserva no bombeable/sedimento: ${margin}%.`
  };
}

