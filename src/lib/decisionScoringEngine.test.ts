import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_FARMS } from '../data/demoData';
import type {
  Farm,
  FarmDecisionPreferences,
  NasaPowerClimateDataset,
  SavedClimateScenario,
} from '../types/rotatewise';
import {
  analyzeDecisionSensitivity,
  BASELINE_REFERENCE_ID,
  DEFAULT_DECISION_WEIGHTS,
  evaluateMultiScenarioDecision,
  loadDecisionPreferencesForFarm,
  normalizeDecisionWeights,
  resetDecisionPreferencesForFarm,
  saveDecisionPreferencesForFarm,
} from './decisionScoringEngine';
import { createSavedScenario } from './scenarioSimulationEngine';

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

function makeScenarioPair(farm: Farm): SavedClimateScenario[] {
  const drought = createSavedScenario({
    farmId: farm.id,
    name: 'Dry Heat Stress (-40%, +3°C)',
    config: {
      rainfallDeltaPct: -40,
      temperatureShiftC: 3,
      irrigationMode: 'reduced',
      primaryCropId: 'maize',
      comparedAlternativeCropIds: ['pearl_millet', 'soybean'],
    },
  });
  const irrigated = createSavedScenario({
    farmId: farm.id,
    name: 'Improved Irrigation & Legume Break',
    config: {
      rainfallDeltaPct: -10,
      temperatureShiftC: 1,
      irrigationMode: 'improved',
      primaryCropId: 'soybean',
      comparedAlternativeCropIds: ['maize'],
    },
  });
  const rainwater = createSavedScenario({
    farmId: farm.id,
    name: 'Rainwater Harvesting + Sorghum',
    config: {
      rainfallDeltaPct: -20,
      temperatureShiftC: 2,
      irrigationMode: 'rainwater_harvesting',
      primaryCropId: 'sorghum',
      comparedAlternativeCropIds: ['soybean'],
    },
  });
  return [drought, irrigated, rainwater];
}

test('default weights equal 30/30/20/20 and normalize cleanly', () => {
  const norm = normalizeDecisionWeights(DEFAULT_DECISION_WEIGHTS);
  assert.equal(norm.allWeightsZero, false);
  assert.equal(norm.isDefault, true);
  assert.equal(norm.effectivePct.climate, 30);
  assert.equal(norm.effectivePct.water, 30);
  assert.equal(norm.effectivePct.soil, 20);
  assert.equal(norm.effectivePct.rotation, 20);
});

test('weight normalization scales arbitrary inputs to exact 100.0%', () => {
  const norm = normalizeDecisionWeights({
    climate: 15,
    water: 45,
    soil: 10,
    rotation: 5,
  });
  const sum =
    norm.effectivePct.climate +
    norm.effectivePct.water +
    norm.effectivePct.soil +
    norm.effectivePct.rotation;
  assert.equal(Math.round(sum * 10) / 10, 100);
  assert.equal(norm.effectivePct.water, 60);
  assert.equal(norm.effectivePct.climate, 20);
  assert.equal(norm.isDefault, false);
});

test('handles zero-weight categories and all-zero weights safely without NaN', () => {
  const partialZero = normalizeDecisionWeights({
    climate: 0,
    water: 60,
    soil: 40,
    rotation: 0,
  });
  assert.equal(partialZero.allWeightsZero, false);
  assert.equal(partialZero.effectivePct.climate, 0);
  assert.equal(partialZero.effectivePct.rotation, 0);
  assert.equal(partialZero.effectivePct.water, 60);
  assert.equal(partialZero.effectivePct.soil, 40);

  const allZero = normalizeDecisionWeights({
    climate: 0,
    water: 0,
    soil: 0,
    rotation: 0,
  });
  assert.equal(allZero.allWeightsZero, true);

  const farm = DEMO_FARMS[0];
  const scenarios = makeScenarioPair(farm);
  const report = evaluateMultiScenarioDecision({
    farm,
    nasaData: SAMPLE_NASA,
    scenarios,
    selectedScenarioIds: scenarios.map((s) => s.id),
    weights: { climate: 0, water: 0, soil: 0, rotation: 0 },
  });
  assert.equal(report.evaluatedAtStatus, 'zero_weights');
  assert.equal(report.recommendation.status, 'insufficient_data');
  assert.equal(report.rankedSavedScenarios[0].weightedScore, null);
});

test('missing category values (unavailable rotation history) are identified and not credited as 100%', () => {
  const farmNoHistory: Farm = {
    ...DEMO_FARMS[2],
    currentCropId: '',
    currentCropName: '',
    rotationPlan: [],
  };
  const scenarios = makeScenarioPair(farmNoHistory);
  const report = evaluateMultiScenarioDecision({
    farm: farmNoHistory,
    nasaData: SAMPLE_NASA,
    scenarios,
    selectedScenarioIds: [scenarios[1].id],
    weights: DEFAULT_DECISION_WEIGHTS,
    includeBaselineReference: false,
  });

  const evaluated = report.rankedSavedScenarios[0];
  assert.ok(evaluated.unavailableCategories.includes('rotation'));
  assert.equal(evaluated.missingWeightPct, 20);
  assert.equal(evaluated.evaluatedWeightPct, 80);
  const rotBreakdown = evaluated.categoryBreakdowns.find(
    (b) => b.id === 'rotation'
  );
  assert.equal(rotBreakdown?.status, 'unavailable');
  assert.equal(rotBreakdown?.rawScore, null);
  assert.equal(rotBreakdown?.contribution, 0);
  // Weighted score must be strictly <= 80 when 20% rotation weight is unavailable
  assert.ok((evaluated.weightedScore ?? 0) <= 80);
});

test('weighted score calculation matches sum(rawScore * effectiveWeight / 100)', () => {
  const farm = DEMO_FARMS[0];
  const scenarios = makeScenarioPair(farm);
  const weights = { climate: 40, water: 30, soil: 10, rotation: 20 };

  const report = evaluateMultiScenarioDecision({
    farm,
    nasaData: SAMPLE_NASA,
    scenarios,
    selectedScenarioIds: [scenarios[1].id],
    weights,
    includeBaselineReference: false,
  });

  const entry = report.rankedSavedScenarios[0];
  assert.equal(entry.status, 'evaluated');
  assert.ok(entry.weightedScore !== null);

  const manualTotal = entry.categoryBreakdowns.reduce((acc, b) => {
    if (b.rawScore === null) return acc;
    return acc + (b.rawScore * b.effectiveWeightPct) / 100;
  }, 0);
  assert.ok(Math.abs((entry.weightedScore ?? 0) - manualTotal) <= 0.2);
});

test('decision sensitivity detects ranking changes and identifies responsible categories', () => {
  const farm = DEMO_FARMS[0]; // Willow Creek, currentCropId = 'corn' (Poaceae)
  // Scenario A: High climate fit at +4°C (27°C inside Pearl Millet 25-35°C) but poor water & same-family rotation
  const heatAdaptedPoaceae = createSavedScenario({
    farmId: farm.id,
    name: 'Pearl Millet +4°C Dry Reduced Water',
    config: {
      rainfallDeltaPct: -50,
      temperatureShiftC: 4,
      irrigationMode: 'reduced',
      primaryCropId: 'pearl_millet',
      comparedAlternativeCropIds: [],
    },
  });
  // Scenario B: Chickpea at +4°C (above 15-25°C ideal -> lower climate) but improved water & strong legume break
  const legumeImprovedWater = createSavedScenario({
    farmId: farm.id,
    name: 'Chickpea +4°C Improved Water & Legume Break',
    config: {
      rainfallDeltaPct: 20,
      temperatureShiftC: 4,
      irrigationMode: 'improved',
      primaryCropId: 'chickpea',
      comparedAlternativeCropIds: [],
    },
  });

  const scenarios = [heatAdaptedPoaceae, legumeImprovedWater];
  const sensitivity = analyzeDecisionSensitivity({
    farm,
    nasaData: SAMPLE_NASA,
    scenarios,
    selectedScenarioIds: scenarios.map((s) => s.id),
    previousWeights: { climate: 100, water: 0, soil: 0, rotation: 0 },
    currentWeights: { climate: 0, water: 50, soil: 0, rotation: 50 },
  });

  assert.equal(sensitivity.hasWeightChanges, true);
  assert.equal(sensitivity.rankingChanged, true);
  const legumeDiff = sensitivity.scenarioDiffs.find(
    (d) => d.id === legumeImprovedWater.id
  );
  assert.ok(legumeDiff);
  assert.equal(legumeDiff.previousRank, 2);
  assert.equal(legumeDiff.currentRank, 1);
  assert.equal(legumeDiff.rankDelta, 1);
  assert.ok((legumeDiff.scoreDelta ?? 0) !== 0);
  assert.ok(legumeDiff.responsibleCategories.length > 0);
});

test('reports a tie rather than forcing a winner when top scenarios are effectively equal', () => {
  const farm = DEMO_FARMS[0];
  const s1 = createSavedScenario({
    farmId: farm.id,
    name: 'Scenario Alpha',
    config: {
      rainfallDeltaPct: -10,
      temperatureShiftC: 1,
      irrigationMode: 'current',
      primaryCropId: 'soybean',
      comparedAlternativeCropIds: [],
    },
  });
  const s2 = createSavedScenario({
    farmId: farm.id,
    name: 'Scenario Beta',
    config: {
      rainfallDeltaPct: -10,
      temperatureShiftC: 1,
      irrigationMode: 'current',
      primaryCropId: 'soybean',
      comparedAlternativeCropIds: [],
    },
  });

  const report = evaluateMultiScenarioDecision({
    farm,
    nasaData: SAMPLE_NASA,
    scenarios: [s1, s2],
    selectedScenarioIds: [s1.id, s2.id],
    weights: DEFAULT_DECISION_WEIGHTS,
    includeBaselineReference: false,
  });

  assert.equal(report.recommendation.status, 'tie');
  assert.equal(report.recommendation.winnerIds.length, 2);
});

test('reports insufficient_data when NASA POWER baseline climate data is missing', () => {
  const farm = DEMO_FARMS[0];
  const scenarios = makeScenarioPair(farm);
  const report = evaluateMultiScenarioDecision({
    farm,
    nasaData: null,
    scenarios,
    selectedScenarioIds: scenarios.map((s) => s.id),
    weights: DEFAULT_DECISION_WEIGHTS,
    includeBaselineReference: true,
  });

  assert.equal(report.evaluatedAtStatus, 'insufficient_data');
  assert.equal(report.recommendation.status, 'insufficient_data');
  assert.equal(report.recommendation.hasSufficientConfidence, false);
  assert.equal(report.rankedSavedScenarios[0].weightedScore, null);
});

test('farm-specific preference persistence loads, saves, prunes deleted scenarios, and resets per farm', () => {
  const farmA = DEMO_FARMS[0];
  const farmB = DEMO_FARMS[1];
  const scenA = makeScenarioPair(farmA);
  const scenB = makeScenarioPair(farmB);

  let store: Record<string, FarmDecisionPreferences> = {};
  const initA = loadDecisionPreferencesForFarm(store, farmA, scenA)!;
  assert.equal(initA.farmId, farmA.id);
  assert.deepEqual(initA.weights, DEFAULT_DECISION_WEIGHTS);

  store = saveDecisionPreferencesForFarm(store, {
    ...initA,
    weights: { climate: 10, water: 60, soil: 15, rotation: 15 },
    selectedScenarioIds: [scenA[0].id, scenA[2].id],
    includeBaselineReference: false,
    lastBaselinePreset: 'season2025',
  });

  // Farm B remains unaffected at defaults
  const loadedB = loadDecisionPreferencesForFarm(store, farmB, scenB)!;
  assert.deepEqual(loadedB.weights, DEFAULT_DECISION_WEIGHTS);
  assert.equal(loadedB.includeBaselineReference, true);

  // Deleting scenA[2] prunes it cleanly when loading Farm A
  const loadedAPruned = loadDecisionPreferencesForFarm(store, farmA, [scenA[0], scenA[1]])!;
  assert.deepEqual(loadedAPruned.selectedScenarioIds, [scenA[0].id]);
  assert.equal(loadedAPruned.lastBaselinePreset, 'season2025');

  // Reset Farm A preferences restores defaults
  store = resetDecisionPreferencesForFarm(store, farmA, scenA);
  const resetA = loadDecisionPreferencesForFarm(store, farmA, scenA)!;
  assert.deepEqual(resetA.weights, DEFAULT_DECISION_WEIGHTS);
  assert.equal(resetA.includeBaselineReference, true);
  assert.equal(resetA.lastBaselinePreset, '30d');
});

test('multi-scenario comparison caps at 3 scenarios, includes baseline reference, and exposes all 10 metrics', () => {
  const farm = DEMO_FARMS[0];
  const baseThree = makeScenarioPair(farm);
  const extraFourth = createSavedScenario({
    farmId: farm.id,
    name: 'Fourth Extra Scenario',
    config: {
      rainfallDeltaPct: 20,
      temperatureShiftC: 0,
      irrigationMode: 'current',
      primaryCropId: 'wheat',
      comparedAlternativeCropIds: [],
    },
  });

  const report = evaluateMultiScenarioDecision({
    farm,
    nasaData: SAMPLE_NASA,
    scenarios: [...baseThree, extraFourth],
    selectedScenarioIds: [...baseThree.map((s) => s.id), extraFourth.id],
    weights: DEFAULT_DECISION_WEIGHTS,
    includeBaselineReference: true,
  });

  assert.equal(report.truncatedFromCount, 1);
  assert.equal(report.rankedSavedScenarios.length, 3);
  assert.ok(report.baselineReference);
  assert.equal(report.baselineReference.id, BASELINE_REFERENCE_ID);
  assert.equal(report.candidates.length, 4); // 3 saved + 1 baseline reference

  for (const item of report.candidates) {
    assert.ok(item.overallCropSuitability !== null);
    assert.ok(item.seasonalSuitabilityScore !== null);
    assert.ok(item.effectiveAvailableWaterMm !== null);
    assert.ok(item.rainfallStressLevel !== null);
    assert.ok(item.heatStressLevel !== null);
    assert.ok(item.overallRiskLevel !== null);
    assert.equal(item.categoryBreakdowns.length, 4);
  }
});
