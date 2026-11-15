import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_FARMS } from '../data/demoData';
import type { NasaPowerClimateDataset } from '../types/rotatewise';
import {
  compareSavedScenarios,
  createBaselineConfigForFarm,
  createSavedScenario,
  deleteScenario,
  duplicateScenario,
  loadScenariosForFarm,
  MAX_COMPARISON_SCENARIOS,
  renameScenario,
  saveOrUpdateScenario,
  simulateClimateScenario,
} from './scenarioSimulationEngine';

const SAMPLE_NASA: NasaPowerClimateDataset = {
  source: 'NASA POWER',
  community: 'AG',
  classification: 'HISTORICAL',
  latitude: 42.0308,
  longitude: -93.6319,
  elevationM: 290,
  startDate: '2025-06-01',
  endDate: '2025-08-31',
  retrievedAt: '2026-01-01T00:00:00Z',
  units: { T2M: 'C', PRECTOTCORR: 'mm/day' },
  observations: [],
  summary: {
    meanTempC: 23.0,
    maxTempC: 31.5,
    minTempC: 14.0,
    totalRainfallMm: 320,
    avgHumidityPct: 68,
    avgWindSpeedMs: 3.4,
    avgSolarRadiationMj: 19.2,
    validDayCount: 92,
    missingValueCount: 0,
  },
};

test('baseline scenario produces zero score deltas and matches historical NASA POWER values', () => {
  const farm = DEMO_FARMS[0]; // Willow Creek, currentCropId = 'corn' -> 'maize'
  const baseConfig = createBaselineConfigForFarm(farm);
  const res = simulateClimateScenario(farm, SAMPLE_NASA, baseConfig);

  assert.equal(res.status, 'ready');
  assert.ok(res.baselineClimate && res.simulatedClimate);
  assert.equal(res.baselineClimate.classification, 'HISTORICAL_BASELINE');
  assert.equal(res.simulatedClimate.classification, 'HYPOTHETICAL_SIMULATION');
  assert.equal(res.simulatedClimate.meanTempC, res.baselineClimate.meanTempC);
  assert.equal(res.simulatedClimate.totalRainfallMm, res.baselineClimate.totalRainfallMm);

  assert.equal(res.allCropDeltas.length, 10);
  for (const crop of res.allCropDeltas) {
    assert.equal(crop.scoreDelta, 0);
    assert.equal(crop.baselineScore, crop.simulatedScore);
  }
});

test('rainfall reduction and increase scale simulated rainfall mathematically and shift crop suitability', () => {
  const drylandFarm = DEMO_FARMS[2]; // Prairie Ridge: Dryland (Rainfed Only)
  const droughtRes = simulateClimateScenario(drylandFarm, SAMPLE_NASA, {
    rainfallDeltaPct: -50,
    temperatureShiftC: 0,
    irrigationMode: 'current',
    primaryCropId: 'maize',
    comparedAlternativeCropIds: ['pearl_millet', 'sorghum'],
  });
  const wetRes = simulateClimateScenario(drylandFarm, SAMPLE_NASA, {
    rainfallDeltaPct: 40,
    temperatureShiftC: 0,
    irrigationMode: 'current',
    primaryCropId: 'maize',
    comparedAlternativeCropIds: ['pearl_millet', 'sorghum'],
  });

  assert.equal(droughtRes.status, 'ready');
  assert.equal(droughtRes.simulatedClimate!.totalRainfallMm, 160); // 320 * 0.5
  assert.equal(wetRes.simulatedClimate!.totalRainfallMm, 448); // 320 * 1.4

  const rainRiskDrought = droughtRes.risks.find((r) => r.id === 'rainfall_stress')!;
  assert.equal(rainRiskDrought.level, 'Critical');
  assert.ok(
    droughtRes.primarySimulatedEval!.overallScore <
      droughtRes.primaryBaselineEval!.overallScore
  );
});

test('temperature shifts adjust mean, min, max temperatures and trigger heat stress rules cleanly', () => {
  const farm = DEMO_FARMS[0];
  const hotRes = simulateClimateScenario(farm, SAMPLE_NASA, {
    rainfallDeltaPct: 0,
    temperatureShiftC: 4,
    irrigationMode: 'current',
    primaryCropId: 'wheat',
    comparedAlternativeCropIds: ['pearl_millet'],
  });

  assert.equal(hotRes.simulatedClimate!.meanTempC, 27);
  assert.equal(hotRes.simulatedClimate!.maxTempC, 35.5); // crosses wheat's 30C heat threshold by >2C
  const heatRisk = hotRes.risks.find((r) => r.id === 'heat_stress')!;
  assert.equal(heatRisk.level, 'Critical');
  assert.ok(heatRisk.explanation.includes('35.5'));

  const coolRes = simulateClimateScenario(farm, SAMPLE_NASA, {
    rainfallDeltaPct: 0,
    temperatureShiftC: -2,
    irrigationMode: 'current',
    primaryCropId: 'wheat',
    comparedAlternativeCropIds: [],
  });
  assert.equal(coolRes.simulatedClimate!.meanTempC, 21);
});

test('combined climate stress identifies crops that remain suitable vs become less suitable', () => {
  const drylandFarm = DEMO_FARMS[2];
  const combined = simulateClimateScenario(drylandFarm, SAMPLE_NASA, {
    rainfallDeltaPct: -40,
    temperatureShiftC: 3,
    irrigationMode: 'current',
    primaryCropId: 'rice',
    comparedAlternativeCropIds: ['pearl_millet', 'chickpea', 'maize'],
  });

  assert.ok(
    combined.highestRiskLevel === 'Critical' || combined.highestRiskLevel === 'High'
  );
  assert.ok(combined.recommendations.betterAlternatives.length > 0);
  const topAlt = combined.recommendations.betterAlternatives[0];
  assert.ok(topAlt.simulatedScore > combined.primarySimulatedEval!.overallScore);
});

test('irrigation adjustments (reduced, improved, rainwater harvesting) deterministically affect water suitability', () => {
  const drylandFarm = DEMO_FARMS[2];
  const baseCfg = {
    rainfallDeltaPct: -20,
    temperatureShiftC: 1,
    primaryCropId: 'soybean',
    comparedAlternativeCropIds: ['pearl_millet'],
  };

  const currentRes = simulateClimateScenario(drylandFarm, SAMPLE_NASA, {
    ...baseCfg,
    irrigationMode: 'current',
  });
  const improvedRes = simulateClimateScenario(drylandFarm, SAMPLE_NASA, {
    ...baseCfg,
    irrigationMode: 'improved',
  });
  const rwhRes = simulateClimateScenario(drylandFarm, SAMPLE_NASA, {
    ...baseCfg,
    irrigationMode: 'rainwater_harvesting',
  });

  assert.equal(improvedRes.simulatedClimate!.effectiveIrrigation, 'Supplemental Rainfed');
  assert.ok(rwhRes.simulatedClimate!.rainwaterHarvestingBonusMm > 0);
  assert.ok(
    rwhRes.primarySimulatedEval!.overallScore >=
      currentRes.primarySimulatedEval!.overallScore
  );
  assert.ok(
    improvedRes.primarySimulatedEval!.overallScore >=
      currentRes.primarySimulatedEval!.overallScore
  );
});

test('missing NASA POWER observations return explicit missing_baseline_climate limitation without demo substitution', () => {
  const farm = DEMO_FARMS[0];
  const res = simulateClimateScenario(farm, null, createBaselineConfigForFarm(farm));

  assert.equal(res.status, 'missing_baseline_climate');
  assert.equal(res.baselineClimate, null);
  assert.equal(res.simulatedClimate, null);
  assert.ok(res.limitationReason && res.limitationReason.includes('NASA POWER'));
});

test('evaluates rotation compatibility via rotationPlannerEngine for primary crop and alternatives', () => {
  const cornFarm = DEMO_FARMS[0]; // currentCropId = 'corn' (Maize, Poaceae)
  const maizeOnCorn = simulateClimateScenario(cornFarm, SAMPLE_NASA, {
    rainfallDeltaPct: 0,
    temperatureShiftC: 0,
    irrigationMode: 'current',
    primaryCropId: 'maize',
    comparedAlternativeCropIds: ['soybean'],
  });

  const rotRisk = maizeOnCorn.risks.find((r) => r.id === 'rotation_conflict')!;
  assert.equal(rotRisk.level, 'High');

  const soyDelta = maizeOnCorn.allCropDeltas.find((c) => c.cropId === 'soybean')!;
  assert.equal(soyDelta.rotationStatus, 'clean');
  assert.equal(soyDelta.rotationWarning, null);
});

test('supports saving, loading, renaming, duplicating, deleting, and comparing up to 3 scenarios', () => {
  const farm = DEMO_FARMS[0];
  const initialLoaded = loadScenariosForFarm([], farm);
  assert.equal(initialLoaded.length, 1);

  const s1 = createSavedScenario({
    farmId: farm.id,
    name: 'Moderate Drought',
    config: {
      rainfallDeltaPct: -20,
      temperatureShiftC: 1,
      irrigationMode: 'current',
      primaryCropId: 'soybean',
      comparedAlternativeCropIds: ['maize'],
    },
  });
  const s2 = createSavedScenario({
    farmId: farm.id,
    name: 'Severe Drought + RWH',
    config: {
      rainfallDeltaPct: -40,
      temperatureShiftC: 3,
      irrigationMode: 'rainwater_harvesting',
      primaryCropId: 'soybean',
      comparedAlternativeCropIds: ['pearl_millet'],
    },
  });
  const s3 = createSavedScenario({
    farmId: farm.id,
    name: 'Cool Wet Year',
    config: {
      rainfallDeltaPct: 30,
      temperatureShiftC: -1,
      irrigationMode: 'current',
      primaryCropId: 'wheat',
      comparedAlternativeCropIds: ['mustard'],
    },
  });
  const s4 = createSavedScenario({
    farmId: farm.id,
    name: 'Fourth Scenario',
    config: createBaselineConfigForFarm(farm),
  });

  let store = saveOrUpdateScenario([], s1);
  store = saveOrUpdateScenario(store, s2);
  store = saveOrUpdateScenario(store, s3);
  store = saveOrUpdateScenario(store, s4);

  assert.equal(loadScenariosForFarm(store, farm).length, 4);

  store = renameScenario(store, s1.id, 'Mild Dry Spell');
  assert.equal(store.find((s) => s.id === s1.id)?.name, 'Mild Dry Spell');

  const dup = duplicateScenario(store, s2.id, 'Severe Drought Copy');
  store = dup.scenarios;
  assert.ok(dup.duplicated);
  assert.equal(store.length, 5);

  // Compare up to 3 scenarios (4 passed -> truncated to 3)
  const cmp = compareSavedScenarios(
    store,
    [s1.id, s2.id, s3.id, s4.id],
    farm,
    SAMPLE_NASA
  );
  assert.equal(cmp.entries.length, MAX_COMPARISON_SCENARIOS);
  assert.equal(cmp.truncatedFromCount, 1);
  assert.equal(cmp.chartData.length, 6); // Overall + 5 categories

  store = deleteScenario(store, s4.id);
  assert.equal(store.some((s) => s.id === s4.id), false);
});

test('switching farms changes simulated scores and irrigation/soil outcomes', () => {
  const humidFarm = DEMO_FARMS[0]; // Supplemental Rainfed, Silty Clay Loam
  const dryFarm = DEMO_FARMS[2]; // Dryland, Clay Loam

  const cfg = {
    rainfallDeltaPct: -30,
    temperatureShiftC: 2,
    irrigationMode: 'current' as const,
    primaryCropId: 'rice',
    comparedAlternativeCropIds: ['pearl_millet'],
  };

  const humidRes = simulateClimateScenario(humidFarm, SAMPLE_NASA, cfg);
  const dryRes = simulateClimateScenario(dryFarm, SAMPLE_NASA, cfg);

  assert.notEqual(
    humidRes.primarySimulatedEval!.overallScore,
    dryRes.primarySimulatedEval!.overallScore
  );
  assert.ok(
    humidRes.primarySimulatedEval!.overallScore >
      dryRes.primarySimulatedEval!.overallScore
  );
});
