/**
 * Pruebas unitarias: Reglas de negocio de lluvia y acumulados
 */

import {
  calculateDailyAccumulations,
  calculateMonthlyAccumulations,
  calculatePeriodTotal,
  findPotentialDuplicate
} from '../src/domain/rules/rainfall.rules.js';

export function runRainfallTests(suite) {
  const sampleRecords = [
    { id: 'r1', pluviometerId: 'p1', measuredAt: '2026-10-01T07:00:00.000Z', precipitationMm: 10.5 },
    { id: 'r2', pluviometerId: 'p1', measuredAt: '2026-10-01T18:00:00.000Z', precipitationMm: 5.5 },
    { id: 'r3', pluviometerId: 'p1', measuredAt: '2026-10-02T07:00:00.000Z', precipitationMm: 20.0 },
    { id: 'r4', pluviometerId: 'p2', measuredAt: '2026-10-02T07:00:00.000Z', precipitationMm: 15.0 },
    { id: 'r5', pluviometerId: 'p1', measuredAt: '2026-11-01T07:00:00.000Z', precipitationMm: 30.0 }
  ];

  suite.test('Acumulado Diario: Agrupa correctamente por fecha YYYY-MM-DD sin sumar días ajenos', (assert) => {
    const daily = calculateDailyAccumulations(sampleRecords);

    assert.ok(daily['2026-10-01'], 'Existe entrada para 2026-10-01');
    assert.strictEqual(daily['2026-10-01'].totalMm, 16.0, 'Suma exacta 10.5 + 5.5 = 16.0 mm');
    assert.strictEqual(daily['2026-10-01'].count, 2, '2 registros en el día');

    assert.ok(daily['2026-10-02'], 'Existe entrada para 2026-10-02');
    assert.strictEqual(daily['2026-10-02'].totalMm, 35.0, 'Suma exacta 20 + 15 = 35.0 mm');
  });

  suite.test('Acumulado Mensual: Agrupa por meses YYYY-MM y cuenta días medidos con lluvia', (assert) => {
    const monthly = calculateMonthlyAccumulations(sampleRecords);

    assert.ok(monthly['2026-10'], 'Existe mes 2026-10');
    assert.strictEqual(monthly['2026-10'].totalMm, 51.0, 'Total mensual 10.5 + 5.5 + 20 + 15 = 51.0 mm');
    assert.strictEqual(monthly['2026-10'].count, 4, '4 mediciones en octubre');
    assert.strictEqual(monthly['2026-10'].totalDaysMeasured, 2, '2 días distintos medidos');

    assert.ok(monthly['2026-11'], 'Existe mes 2026-11');
    assert.strictEqual(monthly['2026-11'].totalMm, 30.0, 'Total mes noviembre');
  });

  suite.test('Acumulado Total del Periodo: Calcula totales, promedio diario y lectura máxima', (assert) => {
    const totals = calculatePeriodTotal(sampleRecords);

    assert.strictEqual(totals.totalMm, 81.0, 'Total general 81 mm');
    assert.strictEqual(totals.count, 5, '5 registros en total');
    assert.strictEqual(totals.measuredDaysCount, 3, '3 días con mediciones');
    assert.strictEqual(totals.maxDailyMm, 35.0, 'Día con mayor lluvia diaria acumulada');
  });

  suite.test('Detección preventiva de duplicados: Alerta si el mismo pluviómetro tiene medición en menos de 60 min', (assert) => {
    const existing = [
      { id: 'ex-1', pluviometerId: 'pluv-a', measuredAt: '2026-10-15T07:00:00.000Z', precipitationMm: 12.0 }
    ];

    // Mismo pluviómetro 20 minutos después -> debe detectarse como posible duplicado
    const dup = findPotentialDuplicate(existing, 'pluv-a', '2026-10-15T07:20:00.000Z', null, 60);
    assert.ok(dup !== null, 'Duplicado detectado dentro de la ventana de 60 minutos');
    assert.strictEqual(dup.id, 'ex-1');

    // Mismo pluviómetro 3 horas después -> NO es duplicado
    const notDup = findPotentialDuplicate(existing, 'pluv-a', '2026-10-15T10:30:00.000Z', null, 60);
    assert.strictEqual(notDup, null, 'No alerta cuando la separación excede el umbral');

    // Otro pluviómetro al mismo tiempo -> NO es duplicado
    const otherPluv = findPotentialDuplicate(existing, 'pluv-b', '2026-10-15T07:10:00.000Z', null, 60);
    assert.strictEqual(otherPluv, null, 'No alerta si el pluviómetro es diferente');
  });

  suite.test('Diferenciación entre ausencia de medición y lluvia cero (0 mm)', (assert) => {
    // Si no hay mediciones para un día, calculateDailyAccumulations NO genera una entrada ficticia de 0 mm
    const recordsOnlyDay1 = [
      { id: 'r1', pluviometerId: 'p1', measuredAt: '2026-10-01T07:00:00.000Z', precipitationMm: 0 }
    ];
    const daily = calculateDailyAccumulations(recordsOnlyDay1);

    assert.ok(daily['2026-10-01'], 'El día medido con 0 mm sí existe explícitamente');
    assert.strictEqual(daily['2026-10-01'].totalMm, 0, 'Lluvia registrada es 0 mm');
    assert.strictEqual(daily['2026-10-02'], undefined, 'El día sin medición no se inventa como 0 mm');
  });
}
