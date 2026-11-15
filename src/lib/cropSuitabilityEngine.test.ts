import test from 'node:test';
import assert from 'node:assert/strict';
import { CROP_KNOWLEDGE_DATABASE } from '../data/cropKnowledgeDb';
import { DEMO_FARMS } from '../data/demoData';
import type { Farm, NasaPowerClimateDataset } from '../types/rotatewise';
import {
  buildCropComparison,
  evaluateCropsForFarm,
  evaluateCropSuitability,
  getTopRecommendedCrops,
  MAX_COMPARISON_CROPS,
} from './cropSuitabilityEngine';

function makeNasaDataset(overrides?: Partial<NasaPowerClimateDataset['summary']> & {
  startDate?: string;
  endDate?: string;
  latitude?: number;
  longitude?: number;
}): NasaPowerClimateDataset {
  return {
    source: 'NASA POWER',
    community: 'AG',
    classification: 'HISTORICAL',
    latitude: overrides?.latitude ?? 42.0308,
    longitude: overrides?.longitude ?? -93.6319,
    elevationM: 310.2,
    startDate: overrides?.startDate ?? '2026-06-01',
    endDate: overrides?.endDate ?? '2026-08-31',
    retrievedAt: '2026-11-13T12:00:00Z',
    units: { T2M: 'C', PRECTOTCORR: 'mm/day' },
    observations: [],
    summary: {
      meanTempC: 24.0,
      maxTempC: 30.2,
      minTempC: 16.5,
      totalRainfallMm: 360,
      avgHumidityPct: 72,
      avgWindSpeedMs: 3.4,
      avgSolarRadiationMj: 19.5,
      validDayCount: 92,
      missingValueCount: 0,
      ...overrides,
    },
  };
}

test('database contains all 10 required crops with credible sources', () => {
  const names = CROP_KNOWLEDGE_DATABASE.map((c) => c.name);
  for (const required of [
    'Rice',
    'Wheat',
    'Maize',
    'Cotton',
    'Soybean',
    'Groundnut',
    'Chickpea',
    'Sorghum',
    'Pearl Millet',
    'Mustard',
  ]) {
    assert.ok(names.includes(required), `Missing required crop: ${required}`);
  }
  for (const crop of CROP_KNOWLEDGE_DATABASE) {
    assert.ok(crop.sources.length > 0, `${crop.name} must cite agronomic sources`);
  }
});

test('suitability scoring computes transparent 0-100 category sum and Top 5 ranking', () => {
  const farm = DEMO_FARMS[0]; // Willow Creek: Silty Clay Loam, pH 6.5, Supplemental Rainfed, Dent Corn
  const nasa = makeNasaDataset();
  const evaluations = evaluateCropsForFarm(farm, nasa);

  assert.equal(evaluations.length, 10);
  const top5 = getTopRecommendedCrops(evaluations, 5);
  assert.equal(top5.length, 5);

  for (const item of evaluations) {
    assert.ok(item.overallScore >= 0 && item.overallScore <= 100);
    const categorySum = item.categories.reduce((acc, c) => acc + c.contribution, 0);
    assert.equal(item.overallScore, categorySum);
    assert.equal(item.dataCompletenessPct, 100);
    assert.ok(['High', 'Moderate', 'Low'].includes(item.suitabilityCategory));
  }

  // After Dent Corn (Poaceae) in warm Silty Clay Loam, Soybean (Fabaceae) should rank near top
  assert.equal(top5[0].crop.id, 'soybean');
  assert.equal(top5[0].suitabilityCategory, 'High');
  assert.equal(top5[0].confidenceLevel, 'High');
});

test('missing climate data never scores 100, marks climate unavailable, and lowers confidence', () => {
  const farm = DEMO_FARMS[0];
  const withClimate = evaluateCropsForFarm(farm, makeNasaDataset());
  const withoutClimate = evaluateCropsForFarm(farm, null);

  const soyWith = withClimate.find((e) => e.crop.id === 'soybean')!;
  const soyWithout = withoutClimate.find((e) => e.crop.id === 'soybean')!;

  assert.ok(soyWithout.overallScore < soyWith.overallScore);
  assert.ok(soyWithout.overallScore < 55);
  assert.equal(soyWithout.confidenceLevel, 'Low');
  assert.ok(soyWithout.dataCompletenessPct < 60);

  const climateCat = soyWithout.categories.find((c) => c.id === 'climate')!;
  assert.equal(climateCat.status, 'unavailable');
  assert.equal(climateCat.score, null);
  assert.equal(climateCat.contribution, 0);

  const waterCat = soyWithout.categories.find((c) => c.id === 'water')!;
  assert.equal(waterCat.status, 'partial');
});

test('soil compatibility responds accurately to texture and pH extremes', () => {
  const groundnut = CROP_KNOWLEDGE_DATABASE.find((c) => c.id === 'groundnut')!;
  const sandyFarm: Farm = {
    ...DEMO_FARMS[2],
    soilType: 'Sandy Loam',
    health: { ...DEMO_FARMS[2].health, phLevel: 6.3 },
  };
  const acidicClayFarm: Farm = {
    ...DEMO_FARMS[2],
    soilType: 'Peat Loam',
    health: { ...DEMO_FARMS[2].health, phLevel: 4.4 },
  };
  const nasa = makeNasaDataset();

  const sandyScore = evaluateCropSuitability(groundnut, sandyFarm, nasa)
    .categories.find((c) => c.id === 'soil')!.contribution;
  const acidicScore = evaluateCropSuitability(groundnut, acidicClayFarm, nasa)
    .categories.find((c) => c.id === 'soil')!.contribution;

  assert.equal(sandyScore, 20);
  assert.ok(acidicScore < 6, `Expected low soil score on acidic Peat Loam, got ${acidicScore}`);
});

test('rotation compatibility penalizes same-family cereals and rewards legume break', () => {
  const maize = CROP_KNOWLEDGE_DATABASE.find((c) => c.id === 'maize')!;
  const soybean = CROP_KNOWLEDGE_DATABASE.find((c) => c.id === 'soybean')!;
  const nasa = makeNasaDataset();

  const cornFarm = DEMO_FARMS[0]; // currentCropId = 'corn' (alias for maize)
  const maizeAfterCorn = evaluateCropSuitability(maize, cornFarm, nasa)
    .categories.find((c) => c.id === 'rotation')!;
  const soyAfterCorn = evaluateCropSuitability(soybean, cornFarm, nasa)
    .categories.find((c) => c.id === 'rotation')!;

  assert.equal(maizeAfterCorn.contribution, 2);
  assert.equal(soyAfterCorn.contribution, 10);
});

test('invalid inputs (null farm, invalid coordinates, NaN pH) fail safely without NaN', () => {
  assert.deepEqual(evaluateCropsForFarm(null, null), []);

  const badCoordFarm: Farm = {
    ...DEMO_FARMS[0],
    coordinates: { lat: 140, lng: -93.6 },
  };
  assert.deepEqual(evaluateCropsForFarm(badCoordFarm, makeNasaDataset()), []);

  const nanPhFarm: Farm = {
    ...DEMO_FARMS[0],
    health: { ...DEMO_FARMS[0].health, phLevel: Number.NaN },
  };
  const res = evaluateCropsForFarm(nanPhFarm, makeNasaDataset());
  assert.equal(res.length, 10);
  for (const item of res) {
    assert.ok(Number.isFinite(item.overallScore));
    const soilCat = item.categories.find((c) => c.id === 'soil')!;
    assert.equal(soilCat.status, 'partial');
  }
});

test('farm switching produces distinct rankings across arid vs cool/moist farms', () => {
  const willows = DEMO_FARMS[0]; // Ames, IA Silty Clay Loam, Supplemental Rainfed
  const prairieDryland = DEMO_FARMS[2]; // Hays, KS Clay Loam, Dryland

  const warmMoistNasa = makeNasaDataset({ meanTempC: 24, totalRainfallMm: 360, validDayCount: 92 });
  const hotAridNasa = makeNasaDataset({
    meanTempC: 29.5,
    maxTempC: 37.0,
    totalRainfallMm: 95,
    validDayCount: 92,
    latitude: 38.8977,
    longitude: -99.3268,
  });

  const evalWillows = evaluateCropsForFarm(willows, warmMoistNasa);
  const evalPrairie = evaluateCropsForFarm(prairieDryland, hotAridNasa);

  const riceWillows = evalWillows.find((e) => e.crop.id === 'rice')!;
  const milletPrairie = evalPrairie.find((e) => e.crop.id === 'pearl_millet')!;
  const ricePrairie = evalPrairie.find((e) => e.crop.id === 'rice')!;

  assert.ok(
    milletPrairie.overallScore > ricePrairie.overallScore,
    'Pearl Millet should outscore Rice on hot dryland Hays, KS parcel'
  );
  assert.notEqual(riceWillows.overallScore, ricePrairie.overallScore);
});

test('interactive crop comparison supports up to 4 crops and excludes fabricated yields/prices', () => {
  const evaluations = evaluateCropsForFarm(DEMO_FARMS[0], makeNasaDataset());
  const comparison = buildCropComparison(evaluations, [
    'soybean',
    'maize',
    'wheat',
    'mustard',
    'rice', // 5th crop should be truncated cleanly
  ]);

  assert.equal(comparison.crops.length, MAX_COMPARISON_CROPS);
  assert.equal(comparison.truncatedFromCount, 1);
  assert.equal(comparison.chartData.length, 6); // Overall + 5 categories
  assert.ok(!('Profit' in comparison.chartData[0]));
  assert.ok(!('Market Price' in comparison.chartData[0]));
});

test('supports 1, 2, 3, and 4-crop comparisons with deterministic recommendation winners', () => {
  const evaluations = evaluateCropsForFarm(DEMO_FARMS[0], makeNasaDataset());

  // 1-crop comparison: insufficient to declare relative winner
  const oneCrop = buildCropComparison(evaluations, ['soybean']);
  assert.equal(oneCrop.crops.length, 1);
  assert.equal(oneCrop.recommendations.overall.status, 'insufficient');
  assert.equal(oneCrop.recommendations.waterLimited.status, 'insufficient');
  assert.equal(oneCrop.recommendations.soil.status, 'insufficient');
  assert.equal(oneCrop.recommendations.rotation.status, 'insufficient');

  // 2-crop comparison: Soybean vs Rice after Dent Corn on Silty Clay Loam
  const twoCrop = buildCropComparison(evaluations, ['rice', 'soybean']);
  assert.equal(twoCrop.crops.length, 2);
  assert.equal(twoCrop.recommendations.overall.status, 'determined');
  assert.equal(twoCrop.recommendations.overall.winnerCropId, 'soybean');
  assert.equal(twoCrop.recommendations.waterLimited.status, 'determined');
  assert.equal(twoCrop.recommendations.waterLimited.winnerCropId, 'soybean');
  assert.equal(twoCrop.recommendations.rotation.status, 'determined');
  assert.equal(twoCrop.recommendations.rotation.winnerCropId, 'soybean');

  // 3-crop comparison: Chickpea/Pearl Millet/Maize
  const threeCrop = buildCropComparison(evaluations, ['maize', 'chickpea', 'pearl_millet']);
  assert.equal(threeCrop.crops.length, 3);
  assert.equal(threeCrop.recommendations.waterLimited.status, 'determined');
  assert.notEqual(threeCrop.recommendations.waterLimited.winnerCropId, 'maize');

  // 4-crop comparison preserves exact deterministic ranking consistency
  const fourCrop = buildCropComparison(evaluations, ['soybean', 'mustard', 'chickpea', 'rice']);
  assert.equal(fourCrop.crops.length, 4);
  const topInSubset = [...fourCrop.crops].sort((a, b) => b.overallScore - a.overallScore)[0];
  assert.equal(fourCrop.recommendations.overall.winnerCropId, topInSubset.crop.id);
});

test('marks comparison recommendations insufficient when NASA climate, soil pH, or crop history is missing', () => {
  // 1. Missing NASA POWER climate
  const noClimateEvals = evaluateCropsForFarm(DEMO_FARMS[0], null);
  const noClimateComp = buildCropComparison(noClimateEvals, ['soybean', 'maize']);
  assert.equal(noClimateComp.recommendations.overall.status, 'insufficient');
  assert.equal(noClimateComp.recommendations.waterLimited.status, 'insufficient');
  assert.equal(noClimateComp.recommendations.soil.status, 'determined');
  assert.equal(noClimateComp.recommendations.rotation.status, 'determined');

  // 2. Missing/invalid farm soil pH
  const missingPhFarm: Farm = {
    ...DEMO_FARMS[0],
    health: { ...DEMO_FARMS[0].health, phLevel: Number.NaN },
  };
  const missingPhEvals = evaluateCropsForFarm(missingPhFarm, makeNasaDataset());
  const missingPhComp = buildCropComparison(missingPhEvals, ['soybean', 'groundnut']);
  assert.equal(missingPhComp.recommendations.soil.status, 'insufficient');

  // 3. Missing farm crop history
  const noHistoryFarm: Farm = {
    ...DEMO_FARMS[0],
    currentCropId: '',
    currentCropName: '',
    rotationPlan: [],
  };
  const noHistoryEvals = evaluateCropsForFarm(noHistoryFarm, makeNasaDataset());
  const noHistoryComp = buildCropComparison(noHistoryEvals, ['soybean', 'maize']);
  assert.equal(noHistoryComp.recommendations.rotation.status, 'insufficient');
});

test('switching farms dynamically changes comparison winners across humid vs dryland parcels', () => {
  const humidFarm = DEMO_FARMS[0]; // Silty Clay Loam, Supplemental Rainfed, Dent Corn
  const dryFarm = DEMO_FARMS[2]; // Clay Loam, Dryland (Rainfed Only), Grain Sorghum

  const humidNasa = makeNasaDataset({ meanTempC: 23.5, totalRainfallMm: 380, validDayCount: 92 });
  const dryNasa = makeNasaDataset({ meanTempC: 28.5, maxTempC: 36.5, totalRainfallMm: 110, validDayCount: 92 });

  const humidComp = buildCropComparison(
    evaluateCropsForFarm(humidFarm, humidNasa),
    ['rice', 'pearl_millet', 'chickpea']
  );
  const dryComp = buildCropComparison(
    evaluateCropsForFarm(dryFarm, dryNasa),
    ['rice', 'pearl_millet', 'chickpea']
  );

  assert.equal(dryComp.recommendations.waterLimited.winnerCropId, 'pearl_millet');
  const riceHumid = humidComp.crops.find((c) => c.crop.id === 'rice')!.overallScore;
  const riceDry = dryComp.crops.find((c) => c.crop.id === 'rice')!.overallScore;
  assert.ok(riceHumid > riceDry);
});

