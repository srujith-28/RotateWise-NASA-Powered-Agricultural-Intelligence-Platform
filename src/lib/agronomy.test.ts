import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateClimateSuitability,
  calculateRotationEfficiency,
  filterClimateByRange,
  formatRangeLabel,
  getPresetMonthBounds,
  getRecommendedNextCrops,
  runScenarioSimulation,
  validateFarmInput,
} from './agronomy';
import { DEMO_CLIMATE_PROFILES, DEMO_CROPS, DEMO_FARMS } from '../data/demoData';

test('calculateRotationEfficiency rewards diverse legume-cereal sequences over monoculture', () => {
  const diverseSequence = DEMO_FARMS[0].rotationPlan;
  const monocultureSequence = [
    { ...diverseSequence[0], id: 'm1', cropId: 'corn', cropName: 'Dent Corn', family: 'Poaceae (Grass)' },
    { ...diverseSequence[1], id: 'm2', cropId: 'corn', cropName: 'Dent Corn', family: 'Poaceae (Grass)' },
    { ...diverseSequence[2], id: 'm3', cropId: 'corn', cropName: 'Dent Corn', family: 'Poaceae (Grass)' },
  ];

  const diverseEval = calculateRotationEfficiency(diverseSequence, DEMO_CROPS, DEMO_FARMS[0]);
  const monoEval = calculateRotationEfficiency(monocultureSequence, DEMO_CROPS, DEMO_FARMS[0]);

  assert.ok(diverseEval.efficiencyScore > monoEval.efficiencyScore + 20);
  assert.ok(monoEval.warnings.length > 0);
  assert.equal(diverseEval.warnings.length, 0);
});

test('getRecommendedNextCrops ranks nitrogen-fixing or pest-breaking crops above same-family crops after Corn', () => {
  const cornFarm = DEMO_FARMS[0];
  const climate = DEMO_CLIMATE_PROFILES[cornFarm.id];
  const recs = getRecommendedNextCrops(cornFarm, climate, DEMO_CROPS);

  assert.ok(recs.length >= 3);
  assert.notEqual(recs[0].crop.family, 'Poaceae (Grass)');
  assert.ok(recs[0].suitabilityScore >= recs[recs.length - 1].suitabilityScore);
});

test('calculateClimateSuitability accounts for irrigation buffering in dryland vs irrigated farms', () => {
  const corn = DEMO_CROPS.find((c) => c.id === 'corn')!;
  const dryClimate = DEMO_CLIMATE_PROFILES['farm-prairie-ridge'];

  const dryScore = calculateClimateSuitability(corn, dryClimate, 'Dryland (Rainfed Only)');
  const irrigatedScore = calculateClimateSuitability(corn, dryClimate, 'Full Center-Pivot');

  assert.ok(irrigatedScore > dryScore);
});

test('runScenarioSimulation models drought yield drop and cover crop resilience', () => {
  const farm = DEMO_FARMS[2];
  const climate = DEMO_CLIMATE_PROFILES[farm.id];

  const droughtNoCover = runScenarioSimulation(farm, climate, DEMO_CROPS, {
    rainfallDeltaPct: -30,
    tempShiftC: 2.5,
    nitrogenStrategy: 'balanced',
    useCoverCrop: false,
    targetCropId: 'sorghum',
  });

  const droughtWithCover = runScenarioSimulation(farm, climate, DEMO_CROPS, {
    rainfallDeltaPct: -30,
    tempShiftC: 2.5,
    nitrogenStrategy: 'balanced',
    useCoverCrop: true,
    targetCropId: 'sorghum',
  });

  assert.ok(droughtWithCover.projectedYieldChangePct > droughtNoCover.projectedYieldChangePct);
  assert.ok(droughtWithCover.moistureStressScore < droughtNoCover.moistureStressScore);
  assert.equal(droughtNoCover.timeline.length, 5);
});

test('validateFarmInput rejects empty and out-of-range inputs', () => {
  const invalid = validateFarmInput(
    {
      name: '',
      location: 'IA',
      lat: '95',
      lng: '-200',
      landArea: '-5',
      soilType: 'Loam',
      irrigation: 'Drip Irrigation',
      currentCropId: '',
    },
    'imperial'
  );

  assert.ok(invalid.name);
  assert.ok(invalid.lat);
  assert.ok(invalid.lng);
  assert.ok(invalid.landArea);
  assert.ok(invalid.currentCropId);

  const valid = validateFarmInput(
    {
      name: 'North 40 Plot',
      location: 'Boone, IA',
      lat: '42.06',
      lng: '-93.88',
      landArea: '120',
      soilType: 'Loam',
      irrigation: 'Supplemental Rainfed',
      currentCropId: 'soybeans',
    },
    'imperial'
  );
  assert.equal(Object.keys(valid).length, 0);
});

test('filterClimateByRange slices monthly points cleanly for presets and custom spans', () => {
  const monthly = DEMO_CLIMATE_PROFILES['farm-willow-creek'].monthly;

  const growingBounds = getPresetMonthBounds('growing');
  const growing = filterClimateByRange(monthly, { preset: 'growing', ...growingBounds });
  assert.equal(growing.length, 7);
  assert.equal(growing[0].month, 'Apr');
  assert.equal(growing[growing.length - 1].month, 'Oct');
  assert.equal(formatRangeLabel({ preset: 'growing', ...growingBounds }), 'Apr–Oct');

  const custom = filterClimateByRange(monthly, {
    preset: 'custom',
    startMonthIndex: 4,
    endMonthIndex: 7,
  });
  assert.equal(custom.length, 4);
  assert.equal(custom[0].month, 'May');
  assert.equal(custom[3].month, 'Aug');
});

