import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_FARMS } from '../data/demoData';
import type { NasaPowerClimateDataset, RotationStep } from '../types/rotatewise';
import {
  compareRotationPlans,
  createRotationPlan,
  deleteRotationPlan,
  duplicateRotationPlan,
  evaluateRotationPlan,
  generateSeasonLabels,
  loadPlansForFarm,
  renameRotationPlan,
  saveOrUpdateRotationPlan,
  setPrimaryRotationPlan,
} from './rotationPlannerEngine';

const SAMPLE_FARM = DEMO_FARMS[0]; // Willow Creek Farm: Silty Clay Loam, pH 6.5, Supplemental Rainfed, Dent Corn

const SAMPLE_NASA_DATA: NasaPowerClimateDataset = {
  source: 'NASA POWER',
  community: 'AG',
  classification: 'HISTORICAL',
  latitude: 42.0308,
  longitude: -93.6319,
  elevationM: 290,
  startDate: '2025-06-01',
  endDate: '2025-08-30',
  retrievedAt: '2026-01-01T00:00:00Z',
  units: { T2M: 'C', PRECTOTCORR: 'mm/day' },
  observations: [],
  summary: {
    meanTempC: 23.4,
    maxTempC: 30.2,
    minTempC: 14.5,
    totalRainfallMm: 315,
    avgHumidityPct: 68,
    avgWindSpeedMs: 3.4,
    avgSolarRadiationMj: 19.6,
    validDayCount: 90,
    missingValueCount: 0,
  },
};

function makeStep(
  id: string,
  season: string,
  cropId: string,
  cropName: string,
  family: string,
  nitrogenImpactKgHa: number,
  status: RotationStep['status'] = 'planned'
): RotationStep {
  return {
    id,
    season,
    cropId,
    cropName,
    family,
    status,
    expectedYieldIndex: 105,
    nitrogenImpactKgHa,
  };
}

test('does not reward distinct crop names when all belong to the same botanical family (Poaceae)', () => {
  const allGrassesSameFamily: RotationStep[] = [
    makeStep('s1', 'Kharif 2026', 'maize', 'Maize', 'Poaceae (Grass)', -95, 'active'),
    makeStep('s2', 'Rabi 2026-27', 'wheat', 'Wheat', 'Poaceae (Grass)', -60),
    makeStep('s3', 'Kharif 2027', 'sorghum', 'Sorghum', 'Poaceae (Grass)', -55),
  ];

  const multiFamily: RotationStep[] = [
    makeStep('m1', 'Kharif 2026', 'maize', 'Maize', 'Poaceae (Grass)', -95, 'active'),
    makeStep('m2', 'Rabi 2026-27', 'chickpea', 'Chickpea', 'Fabaceae (Legume)', 48),
    makeStep('m3', 'Rabi 2027-28', 'mustard', 'Mustard', 'Brassicaceae (Brassica)', -42),
  ];

  const grassEval = evaluateRotationPlan(allGrassesSameFamily, SAMPLE_FARM, SAMPLE_NASA_DATA);
  const diverseEval = evaluateRotationPlan(multiFamily, SAMPLE_FARM, SAMPLE_NASA_DATA);

  const grassFamScore = grassEval.categories.find((c) => c.id === 'family_diversity')!.score!;
  const diverseFamScore = diverseEval.categories.find((c) => c.id === 'family_diversity')!.score!;

  assert.equal(grassEval.uniqueFamilies.length, 1);
  assert.equal(diverseEval.uniqueFamilies.length, 3);
  assert.ok(grassFamScore <= 25, `Expected same-family score <= 25, got ${grassFamScore}`);
  assert.ok(diverseFamScore >= 85, `Expected multi-family score >= 85, got ${diverseFamScore}`);
  assert.ok(diverseEval.overallScore > grassEval.overallScore + 25);
});

test('rewards legume nitrogen fixation ahead of heavy feeders vs continuous cereals', () => {
  const legumeSupported: RotationStep[] = [
    makeStep('l1', 'Spring 2026', 'soybean', 'Soybean', 'Fabaceae (Legume)', 52, 'active'),
    makeStep('l2', 'Spring 2027', 'maize', 'Maize', 'Poaceae (Grass)', -95),
    makeStep('l3', 'Autumn 2027', 'mustard', 'Mustard', 'Brassicaceae (Brassica)', -42),
  ];

  const continuousHeavy: RotationStep[] = [
    makeStep('h1', 'Spring 2026', 'maize', 'Maize', 'Poaceae (Grass)', -95, 'active'),
    makeStep('h2', 'Spring 2027', 'rice', 'Rice', 'Poaceae (Grass)', -105),
    makeStep('h3', 'Spring 2028', 'cotton', 'Cotton', 'Malvaceae (Mallow)', -80),
  ];

  const legumeEval = evaluateRotationPlan(legumeSupported, SAMPLE_FARM, SAMPLE_NASA_DATA);
  const heavyEval = evaluateRotationPlan(continuousHeavy, SAMPLE_FARM, SAMPLE_NASA_DATA);

  const legumeNut = legumeEval.categories.find((c) => c.id === 'nutrient_management')!.score!;
  const heavyNut = heavyEval.categories.find((c) => c.id === 'nutrient_management')!.score!;

  assert.ok(legumeNut > heavyNut + 30);
  assert.ok(legumeEval.netNitrogenKgHa > heavyEval.netNitrogenKgHa);
  assert.ok(
    heavyEval.stepEvaluations[1].warnings.some((w) => w.type === 'nutrient_depletion')
  );
});

test('detects pest/disease carryover warnings and identifies responsible previous crop', () => {
  const steps: RotationStep[] = [
    makeStep('p1', 'Spring 2026', 'soybean', 'Soybean', 'Fabaceae (Legume)', 52, 'active'),
    makeStep('p2', 'Spring 2027', 'groundnut', 'Groundnut', 'Fabaceae (Legume)', 45),
  ];

  const evalRes = evaluateRotationPlan(steps, SAMPLE_FARM, SAMPLE_NASA_DATA);
  const secondStep = evalRes.stepEvaluations[1];

  assert.equal(secondStep.hasConflict, true);
  const avoidWarn = secondStep.warnings.find((w) => w.type === 'avoid_after');
  assert.ok(avoidWarn, 'Expected avoid_after warning when Groundnut follows Soybean');
  assert.equal(avoidWarn.responsiblePreviousCrop, 'Soybean');
  assert.ok(secondStep.warnings.some((w) => w.explanation.includes('Soybean')));
});

test('evaluates seasonal compatibility for Kharif vs Rabi plantings', () => {
  const mismatchedPlan: RotationStep[] = [
    makeStep('s1', 'Kharif 2026', 'wheat', 'Wheat', 'Poaceae (Grass)', -60, 'active'),
    makeStep('s2', 'Rabi 2026-27', 'rice', 'Rice', 'Poaceae (Grass)', -105),
  ];
  const alignedPlan: RotationStep[] = [
    makeStep('a1', 'Kharif 2026', 'rice', 'Rice', 'Poaceae (Grass)', -105, 'active'),
    makeStep('a2', 'Rabi 2026-27', 'chickpea', 'Chickpea', 'Fabaceae (Legume)', 48),
  ];

  const mismatchEval = evaluateRotationPlan(mismatchedPlan, SAMPLE_FARM, SAMPLE_NASA_DATA);
  const alignedEval = evaluateRotationPlan(alignedPlan, SAMPLE_FARM, SAMPLE_NASA_DATA);

  assert.equal(mismatchEval.stepEvaluations[0].seasonFit, 'mismatch');
  assert.equal(mismatchEval.stepEvaluations[1].seasonFit, 'mismatch');
  assert.ok(
    mismatchEval.stepEvaluations[0].warnings.some((w) => w.type === 'seasonal_mismatch')
  );
  assert.equal(alignedEval.stepEvaluations[0].seasonFit, 'aligned');
  assert.equal(alignedEval.stepEvaluations[1].seasonFit, 'aligned');
});

test('scoring is deterministic, sums category contributions cleanly, and reduces confidence when NASA POWER is missing', () => {
  const plan: RotationStep[] = [
    makeStep('s1', 'Kharif 2026', 'maize', 'Maize', 'Poaceae (Grass)', -95, 'active'),
    makeStep('s2', 'Rabi 2026-27', 'chickpea', 'Chickpea', 'Fabaceae (Legume)', 48),
    makeStep('s3', 'Rabi 2027-28', 'mustard', 'Mustard', 'Brassicaceae (Brassica)', -42),
  ];

  const withNasa1 = evaluateRotationPlan(plan, SAMPLE_FARM, SAMPLE_NASA_DATA);
  const withNasa2 = evaluateRotationPlan(plan, SAMPLE_FARM, SAMPLE_NASA_DATA);
  const withoutNasa = evaluateRotationPlan(plan, SAMPLE_FARM, null);

  assert.equal(withNasa1.overallScore, withNasa2.overallScore);
  const sumContrib = withNasa1.categories.reduce((acc, c) => acc + c.contribution, 0);
  assert.equal(withNasa1.overallScore, sumContrib);

  assert.equal(withoutNasa.confidenceLevel, 'Low');
  assert.ok(withoutNasa.dataCompletenessPct < withNasa1.dataCompletenessPct);
  const climateCatNoNasa = withoutNasa.categories.find((c) => c.id === 'seasonal_climate')!;
  const climateCatWithNasa = withNasa1.categories.find((c) => c.id === 'seasonal_climate')!;
  assert.ok(climateCatNoNasa.contribution < climateCatWithNasa.contribution);
  assert.ok(climateCatNoNasa.missingInputs.length > 0);
});

test('suggests up to 3 compatible alternatives when a step has a rotation conflict without mutating the user crop', () => {
  const conflictedSteps: RotationStep[] = [
    makeStep('c1', 'Spring 2026', 'maize', 'Maize', 'Poaceae (Grass)', -95, 'active'),
    makeStep('c2', 'Spring 2027', 'sorghum', 'Sorghum', 'Poaceae (Grass)', -55),
    makeStep('c3', 'Autumn 2027', 'mustard', 'Mustard', 'Brassicaceae (Brassica)', -42),
  ];

  const evalRes = evaluateRotationPlan(conflictedSteps, SAMPLE_FARM, SAMPLE_NASA_DATA);
  const stepTwo = evalRes.stepEvaluations[1];

  assert.equal(stepTwo.cropId, 'sorghum'); // User selection never silently overwritten
  assert.equal(stepTwo.hasConflict, true);
  assert.ok(stepTwo.alternatives.length >= 1 && stepTwo.alternatives.length <= 3);
  for (const alt of stepTwo.alternatives) {
    assert.notEqual(alt.cropId, 'sorghum');
    assert.notEqual(alt.family, 'Poaceae (Grass)');
    assert.ok(alt.whyBetter.length > 0);
  }
});

test('supports 3-season, 6-season, and custom multi-year plan creation, saving, and loading', () => {
  const labels3 = generateSeasonLabels('3-season', 2026, 'temperate-2');
  const labels6 = generateSeasonLabels('6-season', 2026, 'monsoon-3');
  const labelsCustom = generateSeasonLabels('custom', 2026, 'temperate-2', 5);

  assert.equal(labels3.length, 3);
  assert.equal(labels6.length, 6);
  assert.equal(labelsCustom.length, 5);
  assert.deepEqual(labels6.slice(0, 3), ['Kharif 2026', 'Rabi 2026-27', 'Zaid 2027']);

  const created = createRotationPlan({
    farm: SAMPLE_FARM,
    name: '3-Year Legume Break Plan',
    periodMode: '6-season',
    startYear: 2026,
    seasonSystem: 'temperate-2',
    nasaData: SAMPLE_NASA_DATA,
  });
  assert.equal(created.steps.length, 6);
  assert.equal(created.farmId, SAMPLE_FARM.id);

  let store = saveOrUpdateRotationPlan([], created);
  const loaded = loadPlansForFarm(store, SAMPLE_FARM);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, '3-Year Legume Break Plan');

  // When no plans saved for farm, loadPlansForFarm initializes one from farm.rotationPlan
  const defaultLoaded = loadPlansForFarm([], SAMPLE_FARM);
  assert.equal(defaultLoaded.length, 1);
  assert.equal(defaultLoaded[0].steps.length, SAMPLE_FARM.rotationPlan.length);
});

test('supports editing, renaming, duplicating, deleting, primary switching, and comparing up to 3 plans', () => {
  const planA = createRotationPlan({
    farm: SAMPLE_FARM,
    name: 'Plan Alpha',
    periodMode: '3-season',
    startYear: 2026,
    seasonSystem: 'monsoon-3',
    initialCropIds: ['maize', 'chickpea', 'pearl_millet'],
    nasaData: SAMPLE_NASA_DATA,
    isPrimary: true,
  });
  const planB = createRotationPlan({
    farm: SAMPLE_FARM,
    name: 'Plan Beta',
    periodMode: '3-season',
    startYear: 2026,
    seasonSystem: 'monsoon-3',
    initialCropIds: ['maize', 'wheat', 'sorghum'],
    nasaData: SAMPLE_NASA_DATA,
  });
  const planC = createRotationPlan({
    farm: SAMPLE_FARM,
    name: 'Plan Gamma',
    periodMode: '3-season',
    startYear: 2026,
    seasonSystem: 'monsoon-3',
    initialCropIds: ['soybean', 'wheat', 'mustard'],
    nasaData: SAMPLE_NASA_DATA,
  });
  const planD = createRotationPlan({
    farm: SAMPLE_FARM,
    name: 'Plan Delta',
    periodMode: '3-season',
    startYear: 2026,
    seasonSystem: 'monsoon-3',
    initialCropIds: ['rice', 'chickpea', 'maize'],
    nasaData: SAMPLE_NASA_DATA,
  });

  let store = [planA, planB, planC, planD];

  // Rename
  store = renameRotationPlan(store, planB.id, 'Continuous Grass Test');
  assert.equal(store.find((p) => p.id === planB.id)?.name, 'Continuous Grass Test');

  // Duplicate
  const dupRes = duplicateRotationPlan(store, planA.id, 'Plan Alpha v2');
  store = dupRes.plans;
  assert.ok(dupRes.duplicated);
  assert.equal(store.length, 5);
  assert.equal(dupRes.duplicated!.steps.length, planA.steps.length);

  // Set Primary
  store = setPrimaryRotationPlan(store, SAMPLE_FARM.id, planC.id);
  assert.equal(store.find((p) => p.id === planC.id)?.isPrimary, true);
  assert.equal(store.find((p) => p.id === planA.id)?.isPrimary, false);

  // Compare up to 3 plans (4 passed -> truncated to 3)
  const comparison = compareRotationPlans(
    store,
    [planA.id, planB.id, planC.id, planD.id],
    SAMPLE_FARM,
    SAMPLE_NASA_DATA
  );
  assert.equal(comparison.entries.length, 3);
  assert.equal(comparison.truncatedFromCount, 1);
  assert.ok(comparison.chartData.length >= 5);

  // Delete primary -> promotes next available plan for farm
  store = deleteRotationPlan(store, planC.id);
  assert.equal(store.some((p) => p.id === planC.id), false);
  assert.equal(store.some((p) => p.isPrimary), true);
});
