import { CROP_KNOWLEDGE_DATABASE } from '../data/cropKnowledgeDb';
import type {
  ClimateScenarioConfig,
  CropKnowledgeEntry,
  CropSuitabilityEvaluation,
  Farm,
  IrrigationType,
  NasaPowerClimateDataset,
  RotationStep,
  SavedClimateScenario,
  ScenarioClimateSnapshot,
  ScenarioComparisonEntry,
  ScenarioComparisonSummary,
  ScenarioCropDelta,
  ScenarioIrrigationMode,
  ScenarioRiskItem,
  ScenarioRiskLevel,
  ScenarioSimulationResult,
} from '../types/rotatewise';
import {
  evaluateCropSuitability,
  normalizeCropReferenceId,
} from './cropSuitabilityEngine';
import {
  evaluateRotationPlan,
  resolveRotationCropMeta,
} from './rotationPlannerEngine';

export const MAX_COMPARISON_SCENARIOS = 3;

export const RAINFALL_ADJUSTMENT_OPTIONS = [
  -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50,
] as const;

export const TEMPERATURE_SHIFT_OPTIONS = [-2, -1, 0, 1, 2, 3, 4] as const;

export const IRRIGATION_MODE_LABELS: Record<ScenarioIrrigationMode, string> = {
  current: 'Current Irrigation Availability',
  reduced: 'Reduced Irrigation Availability',
  improved: 'Improved Irrigation Availability',
  rainwater_harvesting: 'Rainwater Harvesting (Hypothetical)',
};

const RISK_SEVERITY_ORDER: Record<ScenarioRiskLevel, number> = {
  Low: 0,
  Moderate: 1,
  High: 2,
  Critical: 3,
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

export function resolveKnowledgeCropId(
  cropId: string | null | undefined,
  database: CropKnowledgeEntry[] = CROP_KNOWLEDGE_DATABASE
): string {
  const norm = normalizeCropReferenceId(cropId);
  if (norm && database.some((c) => c.id === norm)) {
    return norm;
  }
  if (cropId && database.some((c) => c.id === cropId)) {
    return cropId;
  }
  return database[0]?.id ?? 'maize';
}

export function createBaselineConfigForFarm(
  farm: Farm | null,
  database: CropKnowledgeEntry[] = CROP_KNOWLEDGE_DATABASE
): ClimateScenarioConfig {
  const primaryCropId = resolveKnowledgeCropId(farm?.currentCropId, database);
  const altDefaults = database
    .filter((c) => c.id !== primaryCropId)
    .slice(0, 3)
    .map((c) => c.id);

  return {
    rainfallDeltaPct: 0,
    temperatureShiftC: 0,
    irrigationMode: 'current',
    primaryCropId,
    comparedAlternativeCropIds: altDefaults,
  };
}

export function resolveEffectiveIrrigation(
  baseIrrigation: IrrigationType,
  mode: ScenarioIrrigationMode
): IrrigationType {
  if (mode === 'current') return baseIrrigation;
  if (mode === 'reduced') {
    if (
      baseIrrigation === 'Full Center-Pivot' ||
      baseIrrigation === 'Drip Irrigation'
    ) {
      return 'Supplemental Rainfed';
    }
    return 'Dryland (Rainfed Only)';
  }
  if (mode === 'improved') {
    if (baseIrrigation === 'Dryland (Rainfed Only)') {
      return 'Supplemental Rainfed';
    }
    if (baseIrrigation === 'Supplemental Rainfed') {
      return 'Full Center-Pivot';
    }
    return baseIrrigation;
  }
  // rainwater_harvesting
  if (baseIrrigation === 'Dryland (Rainfed Only)') {
    return 'Supplemental Rainfed';
  }
  return baseIrrigation;
}

function estimateIrrigationBufferMm(
  irrigation: IrrigationType,
  cropWindowDays: number,
  avgCropWaterNeedMm: number
): number {
  const dailyDemand = avgCropWaterNeedMm / Math.max(60, cropWindowDays);
  const periodFactor = cropWindowDays;
  if (irrigation === 'Full Center-Pivot' || irrigation === 'Drip Irrigation') {
    return Math.round(dailyDemand * periodFactor * 0.65);
  }
  if (irrigation === 'Supplemental Rainfed') {
    return Math.round(dailyDemand * periodFactor * 0.25);
  }
  return 0;
}

function computeRiskEvaluation(params: {
  farm: Farm;
  config: ClimateScenarioConfig;
  baselineClimate: ScenarioClimateSnapshot;
  simulatedClimate: ScenarioClimateSnapshot;
  primaryEval: CropSuitabilityEvaluation;
  rotationConflictWarning: string | null;
}): ScenarioRiskItem[] {
  const {
    farm,
    config,
    simulatedClimate,
    primaryEval,
    rotationConflictWarning,
  } = params;
  const crop = primaryEval.crop;
  const avgNeedMm = (crop.waterNeedMm[0] + crop.waterNeedMm[1]) / 2;
  const avgDays = (crop.growingDurationDays[0] + crop.growingDurationDays[1]) / 2;
  const dailyDemandMm = avgNeedMm / Math.max(60, avgDays);
  const effectiveDailyWater =
    simulatedClimate.effectiveAvailableWaterMm / Math.max(1, simulatedClimate.validDayCount);
  const waterSupplyRatio = effectiveDailyWater / Math.max(0.5, dailyDemandMm);

  // 1. Rainfall Stress
  let rainfallLevel: ScenarioRiskLevel = 'Low';
  let rainfallRule = '';
  let rainfallExpl = '';
  if (
    config.rainfallDeltaPct <= -40 ||
    (simulatedClimate.dailyRainfallMm < dailyDemandMm * 0.4 &&
      simulatedClimate.effectiveIrrigation === 'Dryland (Rainfed Only)')
  ) {
    rainfallLevel = 'Critical';
    rainfallRule =
      'Rule: Rainfall reduction ≥ 40% or simulated rain < 40% of daily crop demand under Dryland.';
    rainfallExpl = `Simulated rainfall (${simulatedClimate.dailyRainfallMm.toFixed(
      2
    )} mm/day; ${config.rainfallDeltaPct}%) creates acute moisture deficit against ${crop.name}'s ~${dailyDemandMm.toFixed(
      1
    )} mm/day requirement.`;
  } else if (config.rainfallDeltaPct <= -20 || waterSupplyRatio < 0.7) {
    rainfallLevel = 'High';
    rainfallRule =
      'Rule: Rainfall drop ≥ 20% or effective daily supply < 70% of crop demand.';
    rainfallExpl = `Adjusted rainfall (${simulatedClimate.totalRainfallMm.toFixed(
      1
    )} mm over ${simulatedClimate.validDayCount} days) reduces root-zone moisture reserve below target levels.`;
  } else if (config.rainfallDeltaPct <= -10 || (config.rainfallDeltaPct >= 30 && crop.id !== 'rice')) {
    rainfallLevel = 'Moderate';
    rainfallRule =
      config.rainfallDeltaPct >= 30
        ? 'Rule: Rainfall surplus ≥ +30% elevates waterlogging risk for upland crops.'
        : 'Rule: Mild rainfall reduction (-10%) increases sensitivity during flowering.';
    rainfallExpl =
      config.rainfallDeltaPct >= 30
        ? `+${config.rainfallDeltaPct}% rainfall (${simulatedClimate.totalRainfallMm.toFixed(
            1
          )} mm) can saturate ${farm.soilType} and impair aeration.`
        : `${config.rainfallDeltaPct}% rainfall shift narrows moisture margin.`;
  } else {
    rainfallLevel = 'Low';
    rainfallRule = 'Rule: Adjusted rainfall within normal tolerance for parcel conditions.';
    rainfallExpl = `Simulated rainfall (${simulatedClimate.dailyRainfallMm.toFixed(
      2
    )} mm/day) stays balanced relative to ${crop.name}.`;
  }

  // 2. Heat & Thermal Stress
  let heatLevel: ScenarioRiskLevel = 'Low';
  let heatRule = '';
  let heatExpl = '';
  const maxT = simulatedClimate.maxTempC;
  const minT = simulatedClimate.minTempC;
  const [optLow, optHigh] = crop.idealTempC;

  if (
    (maxT !== null &&
      crop.heatStressThresholdC !== null &&
      maxT > crop.heatStressThresholdC + 2) ||
    (minT !== null &&
      crop.frostSensitivityC !== null &&
      minT < crop.frostSensitivityC - 2)
  ) {
    heatLevel = 'Critical';
    heatRule =
      'Rule: Simulated temperature exceeds crop heat/frost threshold by > 2.0°C.';
    heatExpl =
      maxT !== null && crop.heatStressThresholdC !== null && maxT > crop.heatStressThresholdC + 2
        ? `Simulated peak (${maxT.toFixed(1)}°C) exceeds ${crop.name}'s critical heat threshold (${crop.heatStressThresholdC}°C) by ${(maxT - crop.heatStressThresholdC).toFixed(1)}°C.`
        : `Simulated low (${minT?.toFixed(1)}°C) drops well below frost limit (${crop.frostSensitivityC}°C).`;
  } else if (
    (maxT !== null &&
      crop.heatStressThresholdC !== null &&
      maxT > crop.heatStressThresholdC) ||
    (minT !== null &&
      crop.frostSensitivityC !== null &&
      minT < crop.frostSensitivityC)
  ) {
    heatLevel = 'High';
    heatRule =
      'Rule: Simulated extreme crosses crop frost or heat-stress threshold.';
    heatExpl =
      maxT !== null && crop.heatStressThresholdC !== null && maxT > crop.heatStressThresholdC
        ? `Peak temperature (${maxT.toFixed(1)}°C) crosses ${crop.name}'s ${crop.heatStressThresholdC}°C heat-stress limit.`
        : `Overnight low (${minT?.toFixed(1)}°C) drops below ${crop.frostSensitivityC}°C frost limit.`;
  } else if (
    simulatedClimate.meanTempC < optLow ||
    simulatedClimate.meanTempC > optHigh
  ) {
    heatLevel = 'Moderate';
    heatRule = 'Rule: Mean simulated temperature lies outside crop optimal range.';
    heatExpl = `Adjusted mean (${simulatedClimate.meanTempC.toFixed(
      1
    )}°C) falls outside ${crop.name}'s ideal ${optLow}–${optHigh}°C envelope.`;
  } else {
    heatLevel = 'Low';
    heatRule = 'Rule: Simulated mean and extremes stay within optimal crop thresholds.';
    heatExpl = `Adjusted mean (${simulatedClimate.meanTempC.toFixed(
      1
    )}°C) sits inside ${crop.name}'s ${optLow}–${optHigh}°C optimal envelope.`;
  }

  // 3. Water Shortage
  const waterCat = primaryEval.categories.find((c) => c.id === 'water');
  const waterScore = waterCat?.score ?? 0;
  let waterLevel: ScenarioRiskLevel = 'Low';
  let waterRule = '';
  let waterExpl = '';
  if (
    simulatedClimate.effectiveIrrigation === 'Dryland (Rainfed Only)' &&
    crop.irrigationDependency === 'High' &&
    waterSupplyRatio < 0.85
  ) {
    waterLevel = 'Critical';
    waterRule =
      'Rule: High-irrigation-dependency crop paired with Dryland mode and supply ratio < 0.85.';
    waterExpl = `${crop.name} (${crop.waterNeedMm[0]}–${crop.waterNeedMm[1]} mm) faces severe water shortage under ${simulatedClimate.effectiveIrrigation}.`;
  } else if (waterScore < 45 || waterSupplyRatio < 0.65) {
    waterLevel = 'High';
    waterRule = 'Rule: Simulated water category score < 45/100 or supply ratio < 0.65.';
    waterExpl = `Water suitability drops to ${waterScore}/100 under ${IRRIGATION_MODE_LABELS[config.irrigationMode]} (${waterSupplyRatio.toFixed(2)}× daily demand coverage).`;
  } else if (waterScore < 72 || config.irrigationMode === 'reduced') {
    waterLevel = 'Moderate';
    waterRule =
      'Rule: Water score < 72/100 or irrigation availability manually reduced.';
    waterExpl = `Water suitability is ${waterScore}/100; supplemental scheduling required during peak vegetative/reproductive stages.`;
  } else {
    waterLevel = 'Low';
    waterRule = 'Rule: Water suitability ≥ 72/100 with adequate effective moisture.';
    waterExpl = `Effective water delivery (${waterScore}/100) covers ${crop.name}'s demand under ${simulatedClimate.effectiveIrrigation}.`;
  }

  // 4. Soil Compatibility
  const soilCat = primaryEval.categories.find((c) => c.id === 'soil');
  const soilScore = soilCat?.score ?? 0;
  let soilLevel: ScenarioRiskLevel = 'Low';
  let soilRule = '';
  if (soilCat?.status === 'partial') {
    soilLevel = 'Moderate';
    soilRule = 'Rule: Soil pH unavailable or out of valid range (3.5–9.5); texture-only check.';
  } else if (soilScore < 45) {
    soilLevel = 'High';
    soilRule = 'Rule: Soil & pH category score < 45/100.';
  } else if (soilScore < 75) {
    soilLevel = 'Moderate';
    soilRule = 'Rule: Soil & pH category score between 45 and 74/100.';
  } else {
    soilLevel = 'Low';
    soilRule = 'Rule: Soil & pH category score ≥ 75/100.';
  }

  // 5. Seasonal Mismatch
  const seasonCat = primaryEval.categories.find((c) => c.id === 'season');
  const seasonScore = seasonCat?.score ?? 0;
  let seasonLevel: ScenarioRiskLevel = 'Low';
  let seasonRule = '';
  if (seasonScore < 45) {
    seasonLevel = 'High';
    seasonRule = 'Rule: Growing-season compatibility score < 45/100.';
  } else if (seasonScore < 75) {
    seasonLevel = 'Moderate';
    seasonRule = 'Rule: Growing-season compatibility score between 45 and 74/100.';
  } else {
    seasonLevel = 'Low';
    seasonRule = 'Rule: Growing-season compatibility score ≥ 75/100.';
  }

  // 6. Rotation Conflict
  const rotCat = primaryEval.categories.find((c) => c.id === 'rotation');
  const rotScore = rotCat?.score ?? 0;
  let rotLevel: ScenarioRiskLevel = 'Low';
  let rotRule = '';
  let rotExpl = '';
  if (rotCat?.status === 'unavailable') {
    rotLevel = 'Moderate';
    rotRule = 'Rule: No parcel crop history recorded to confirm rotational break.';
    rotExpl = 'Add current or previous crop history to verify pest/disease break.';
  } else if (rotationConflictWarning || rotScore <= 35) {
    rotLevel = 'High';
    rotRule = 'Rule: Same botanical family or discouraged preceding-crop match with parcel crop history.';
    rotExpl =
      rotationConflictWarning ??
      `Rotational conflict (${rotScore}/100) after ${primaryEval.previousCropUsed}.`;
  } else if (rotScore < 70) {
    rotLevel = 'Moderate';
    rotRule = 'Rule: Moderate rotation compatibility score (36–69/100).';
    rotExpl = rotCat?.detail ?? 'Moderate rotation break value.';
  } else {
    rotLevel = 'Low';
    rotRule = 'Rule: Clean botanical family break (rotation score ≥ 70/100).';
    rotExpl = rotCat?.detail ?? 'Rotates cleanly from prior parcel crop.';
  }

  return [
    {
      id: 'rainfall_stress',
      label: 'Rainfall Stress',
      level: rainfallLevel,
      ruleApplied: rainfallRule,
      explanation: rainfallExpl,
    },
    {
      id: 'heat_stress',
      label: 'Heat & Thermal Stress',
      level: heatLevel,
      ruleApplied: heatRule,
      explanation: heatExpl,
    },
    {
      id: 'water_shortage',
      label: 'Water Shortage Risk',
      level: waterLevel,
      ruleApplied: waterRule,
      explanation: waterExpl,
    },
    {
      id: 'soil_compatibility',
      label: 'Soil Compatibility Risk',
      level: soilLevel,
      ruleApplied: soilRule,
      explanation: soilCat?.detail ?? 'Evaluated against farm texture and pH.',
    },
    {
      id: 'seasonal_mismatch',
      label: 'Seasonal Mismatch Risk',
      level: seasonLevel,
      ruleApplied: seasonRule,
      explanation: seasonCat?.detail ?? 'Evaluated against observed NASA POWER season.',
    },
    {
      id: 'rotation_conflict',
      label: 'Crop Rotation Conflict',
      level: rotLevel,
      ruleApplied: rotRule,
      explanation: rotExpl,
    },
  ];
}

export function simulateClimateScenario(
  farm: Farm | null,
  nasaData: NasaPowerClimateDataset | null,
  rawConfig: ClimateScenarioConfig,
  database: CropKnowledgeEntry[] = CROP_KNOWLEDGE_DATABASE
): ScenarioSimulationResult {
  const primaryCropId = resolveKnowledgeCropId(rawConfig.primaryCropId, database);
  const config: ClimateScenarioConfig = {
    ...rawConfig,
    rainfallDeltaPct: clamp(Math.round(rawConfig.rainfallDeltaPct), -50, 50),
    temperatureShiftC: clamp(round1(rawConfig.temperatureShiftC), -2, 4),
    primaryCropId,
    comparedAlternativeCropIds: Array.from(
      new Set(rawConfig.comparedAlternativeCropIds)
    ).slice(0, 4),
  };

  const emptyMissing = (reason: string): ScenarioSimulationResult => ({
    status: 'missing_baseline_climate',
    limitationReason: reason,
    farm,
    config,
    baselineClimate: null,
    simulatedClimate: null,
    primaryBaselineEval: null,
    primarySimulatedEval: null,
    allCropDeltas: [],
    risks: [
      {
        id: 'rainfall_stress',
        label: 'Baseline Climate Unavailable',
        level: 'Moderate',
        ruleApplied:
          'Rule: Simulation requires real historical NASA POWER baseline observations.',
        explanation: reason,
      },
    ],
    highestRiskLevel: 'Moderate',
    recommendations: {
      remainsSuitable: [],
      becomesLessSuitable: [],
      betterAlternatives: [],
      irrigationGuidance: [
        'Retrieve NASA POWER historical climate observations before modeling rainfall or temperature shifts.',
      ],
      priorityRisks: [],
      assumptionsAndLimitations: [
        'No demonstration weather was substituted for missing NASA POWER observations.',
      ],
    },
  });

  if (!farm) {
    return emptyMissing('No active farm parcel is selected.');
  }

  if (
    !nasaData ||
    nasaData.summary.validDayCount === 0 ||
    nasaData.summary.meanTempC === null ||
    nasaData.summary.totalRainfallMm === null
  ) {
    return emptyMissing(
      'NASA POWER historical baseline climate observations are unavailable for the selected farm and date window. Hypothetical simulation cannot compute baseline vs. adjusted metrics without real observed data.'
    );
  }

  const validDays = nasaData.summary.validDayCount;
  const baseMeanTempC = round1(nasaData.summary.meanTempC);
  const baseMinTempC =
    nasaData.summary.minTempC !== null ? round1(nasaData.summary.minTempC) : null;
  const baseMaxTempC =
    nasaData.summary.maxTempC !== null ? round1(nasaData.summary.maxTempC) : null;
  const baseTotalRainMm = round1(nasaData.summary.totalRainfallMm);
  const baseDailyRainMm = round2(baseTotalRainMm / validDays);

  const primaryEntry =
    database.find((c) => c.id === primaryCropId) ?? database[0];
  const primaryAvgNeed =
    (primaryEntry.waterNeedMm[0] + primaryEntry.waterNeedMm[1]) / 2;

  const baseIrrigationBufferMm = estimateIrrigationBufferMm(
    farm.irrigation,
    validDays,
    primaryAvgNeed
  );

  const baselineClimate: ScenarioClimateSnapshot = {
    isSimulated: false,
    classification: 'HISTORICAL_BASELINE',
    meanTempC: baseMeanTempC,
    minTempC: baseMinTempC,
    maxTempC: baseMaxTempC,
    totalRainfallMm: baseTotalRainMm,
    dailyRainfallMm: baseDailyRainMm,
    validDayCount: validDays,
    effectiveIrrigation: farm.irrigation,
    rainwaterHarvestingBonusMm: 0,
    effectiveAvailableWaterMm: round1(baseTotalRainMm + baseIrrigationBufferMm),
  };

  // Apply hypothetical adjustments mathematically
  const rainFactor = clamp(1 + config.rainfallDeltaPct / 100, 0.2, 2.0);
  const simTotalRainMm = round1(baseTotalRainMm * rainFactor);
  const simDailyRainMm = round2(simTotalRainMm / validDays);
  const simMeanTempC = round1(baseMeanTempC + config.temperatureShiftC);
  const simMinTempC =
    baseMinTempC !== null ? round1(baseMinTempC + config.temperatureShiftC) : null;
  const simMaxTempC =
    baseMaxTempC !== null ? round1(baseMaxTempC + config.temperatureShiftC) : null;

  const effectiveIrrigation = resolveEffectiveIrrigation(
    farm.irrigation,
    config.irrigationMode
  );
  const rainwaterHarvestingBonusMm =
    config.irrigationMode === 'rainwater_harvesting'
      ? Math.round(clamp(simTotalRainMm * 0.22, 20, 130))
      : 0;

  const simIrrigationBufferMm = estimateIrrigationBufferMm(
    effectiveIrrigation,
    validDays,
    primaryAvgNeed
  );

  const simulatedClimate: ScenarioClimateSnapshot = {
    isSimulated: true,
    classification: 'HYPOTHETICAL_SIMULATION',
    meanTempC: simMeanTempC,
    minTempC: simMinTempC,
    maxTempC: simMaxTempC,
    totalRainfallMm: simTotalRainMm,
    dailyRainfallMm: simDailyRainMm,
    validDayCount: validDays,
    effectiveIrrigation,
    rainwaterHarvestingBonusMm,
    effectiveAvailableWaterMm: round1(
      simTotalRainMm + rainwaterHarvestingBonusMm + simIrrigationBufferMm
    ),
  };

  const simulatedNasaData: NasaPowerClimateDataset = {
    ...nasaData,
    summary: {
      ...nasaData.summary,
      meanTempC: simMeanTempC,
      minTempC: simMinTempC,
      maxTempC: simMaxTempC,
      // Include harvested runoff capture in water balance evaluation when enabled
      totalRainfallMm: round1(simTotalRainMm + rainwaterHarvestingBonusMm),
    },
  };

  const simulatedFarm: Farm = {
    ...farm,
    irrigation: effectiveIrrigation,
  };

  const baseRotationHistory = farm.rotationPlan.filter(
    (s) => s.status === 'completed' || s.status === 'active'
  );

  const cropDeltas: ScenarioCropDelta[] = database.map((entry) => {
    const baseEval = evaluateCropSuitability(entry, farm, nasaData);
    const simEval = evaluateCropSuitability(
      entry,
      simulatedFarm,
      simulatedNasaData
    );
    const delta = simEval.overallScore - baseEval.overallScore;

    // Rotation continuity via rotationPlannerEngine
    const meta = resolveRotationCropMeta(entry.id);
    const nextStep: RotationStep = {
      id: `sim-rot-${entry.id}`,
      season: 'Simulated Season',
      cropId: meta.id,
      cropName: meta.name,
      family: meta.family,
      status: 'planned',
      expectedYieldIndex: 105,
      nitrogenImpactKgHa: meta.nitrogenDeltaKgHa,
    };
    const rotEval = evaluateRotationPlan(
      [...baseRotationHistory, nextStep],
      simulatedFarm,
      simulatedNasaData
    );
    const stepEval = rotEval.stepEvaluations[rotEval.stepEvaluations.length - 1];
    const rotConflict = stepEval?.warnings.find(
      (w) => w.type === 'avoid_after' || w.type === 'same_family'
    );

    const getCatScore = (id: 'climate' | 'water' | 'soil' | 'season' | 'rotation') =>
      simEval.categories.find((c) => c.id === id)?.score ?? null;

    let statusTag: ScenarioCropDelta['statusTag'] = 'Marginally Suitable';
    if (
      delta <= -8 ||
      (baseEval.suitabilityCategory === 'High' &&
        simEval.suitabilityCategory !== 'High') ||
      (baseEval.suitabilityCategory === 'Moderate' &&
        simEval.suitabilityCategory === 'Low')
    ) {
      statusTag = 'Becomes Less Suitable';
    } else if (simEval.overallScore >= 70) {
      statusTag = 'Remains Suitable';
    }

    return {
      cropId: entry.id,
      cropName: entry.name,
      family: entry.family,
      baselineScore: baseEval.overallScore,
      simulatedScore: simEval.overallScore,
      scoreDelta: delta,
      baselineSuitability: baseEval.suitabilityCategory,
      simulatedSuitability: simEval.suitabilityCategory,
      climateScore: getCatScore('climate'),
      waterScore: getCatScore('water'),
      soilScore: getCatScore('soil'),
      seasonScore: getCatScore('season'),
      rotationScore: getCatScore('rotation'),
      rotationStatus: rotConflict ? 'conflict' : 'clean',
      rotationWarning: rotConflict ? rotConflict.explanation : null,
      statusTag,
      waterNeedMm: entry.waterNeedMm,
      irrigationDependency: entry.irrigationDependency,
    };
  });

  const primaryBaselineEval = evaluateCropSuitability(primaryEntry, farm, nasaData);
  const primarySimulatedEval = evaluateCropSuitability(
    primaryEntry,
    simulatedFarm,
    simulatedNasaData
  );
  const primaryDelta = cropDeltas.find((c) => c.cropId === primaryCropId)!;

  // Tag better alternatives
  const enrichedDeltas = cropDeltas.map((d) => {
    if (
      d.cropId !== primaryCropId &&
      d.simulatedScore > primaryDelta.simulatedScore &&
      d.simulatedScore >= 65 &&
      d.statusTag !== 'Becomes Less Suitable'
    ) {
      return { ...d, statusTag: 'More Compatible Alternative' as const };
    }
    return d;
  });

  const sortedBySim = [...enrichedDeltas].sort(
    (a, b) => b.simulatedScore - a.simulatedScore
  );

  const risks = computeRiskEvaluation({
    farm: simulatedFarm,
    config,
    baselineClimate,
    simulatedClimate,
    primaryEval: primarySimulatedEval,
    rotationConflictWarning: primaryDelta.rotationWarning,
  });

  const highestRiskLevel = risks.reduce<ScenarioRiskLevel>(
    (worst, item) =>
      RISK_SEVERITY_ORDER[item.level] > RISK_SEVERITY_ORDER[worst]
        ? item.level
        : worst,
    'Low'
  );

  // Recommendations
  const remainsSuitable = sortedBySim.filter((c) => c.simulatedScore >= 70);
  const becomesLessSuitable = [...enrichedDeltas]
    .filter((c) => c.statusTag === 'Becomes Less Suitable')
    .sort((a, b) => a.scoreDelta - b.scoreDelta);
  const betterAlternatives = sortedBySim
    .filter(
      (c) =>
        c.cropId !== primaryCropId &&
        c.simulatedScore >= primaryDelta.simulatedScore &&
        c.simulatedScore >= 60
    )
    .slice(0, 4);

  // Compute counterfactual irrigation improvement guidance using evaluateCropSuitability
  const irrigationGuidance: string[] = [];
  if (config.irrigationMode !== 'improved') {
    const improvedFarm: Farm = {
      ...farm,
      irrigation: resolveEffectiveIrrigation(farm.irrigation, 'improved'),
    };
    const improvedEval = evaluateCropSuitability(
      primaryEntry,
      improvedFarm,
      simulatedNasaData
    );
    const gain = improvedEval.overallScore - primarySimulatedEval.overallScore;
    if (gain > 0) {
      irrigationGuidance.push(
        `Upgrading to ${improvedFarm.irrigation} raises ${primaryEntry.name}'s simulated suitability from ${primarySimulatedEval.overallScore}/100 to ${improvedEval.overallScore}/100 (+${gain} pts).`
      );
    }
  }
  if (config.irrigationMode !== 'rainwater_harvesting' && config.rainfallDeltaPct < 0) {
    const rwhBonus = Math.round(clamp(simTotalRainMm * 0.22, 20, 130));
    const rwhFarm: Farm = {
      ...farm,
      irrigation: resolveEffectiveIrrigation(farm.irrigation, 'rainwater_harvesting'),
    };
    const rwhData: NasaPowerClimateDataset = {
      ...nasaData,
      summary: {
        ...nasaData.summary,
        meanTempC: simMeanTempC,
        minTempC: simMinTempC,
        maxTempC: simMaxTempC,
        totalRainfallMm: round1(simTotalRainMm + rwhBonus),
      },
    };
    const rwhEval = evaluateCropSuitability(primaryEntry, rwhFarm, rwhData);
    const gain = rwhEval.overallScore - primarySimulatedEval.overallScore;
    if (gain > 0) {
      irrigationGuidance.push(
        `Hypothetical rainwater harvesting (+${rwhBonus} mm runoff capture) improves ${primaryEntry.name}'s simulated score to ${rwhEval.overallScore}/100 (+${gain} pts).`
      );
    }
  }
  if (irrigationGuidance.length === 0) {
    irrigationGuidance.push(
      `Current ${effectiveIrrigation} configuration maintains stable water coverage (${primarySimulatedEval.categories.find((c) => c.id === 'water')?.score ?? 0}/100 water fit) under this scenario.`
    );
  }

  const priorityRisks = risks
    .filter((r) => r.level === 'Critical' || r.level === 'High' || r.level === 'Moderate')
    .sort((a, b) => RISK_SEVERITY_ORDER[b.level] - RISK_SEVERITY_ORDER[a.level]);

  const assumptionsAndLimitations = [
    `Baseline anchored strictly to historical NASA POWER (AG) observations (${nasaData.startDate} to ${nasaData.endDate}; ${validDays} valid days).`,
    'Hypothetical scenario applies uniform rainfall percentage scaling and constant temperature offsets across the observed window — actual future weather variability and sub-daily extremes are uncertain.',
    config.irrigationMode === 'rainwater_harvesting'
      ? `Rainwater harvesting assumes capturing +${rainwaterHarvestingBonusMm} mm (~22% of simulated rainfall) into farm storage for supplemental irrigation.`
      : `Irrigation mode modeled deterministically by shifting parcel water delivery tier (${effectiveIrrigation}).`,
    'Suitability deltas come directly from evaluateCropSuitability and rotationPlannerEngine; no yields, revenues, or market prices are fabricated.',
  ];

  return {
    status: 'ready',
    limitationReason: null,
    farm,
    config,
    baselineClimate,
    simulatedClimate,
    primaryBaselineEval,
    primarySimulatedEval,
    allCropDeltas: sortedBySim,
    risks,
    highestRiskLevel,
    recommendations: {
      remainsSuitable,
      becomesLessSuitable,
      betterAlternatives,
      irrigationGuidance,
      priorityRisks,
      assumptionsAndLimitations,
    },
  };
}

// Scenario Management & Persistence Helpers
export function buildDefaultScenariosForFarm(farm: Farm): SavedClimateScenario[] {
  const baseCropId = resolveKnowledgeCropId(farm.currentCropId);
  const now = new Date().toISOString();
  const baseAlts = CROP_KNOWLEDGE_DATABASE.filter((c) => c.id !== baseCropId)
    .slice(0, 3)
    .map((c) => c.id);

  return [
    {
      id: `scen-drought-${farm.id}`,
      farmId: farm.id,
      name: 'Hot & Dry Stress (-30% Rain, +2°C)',
      config: {
        rainfallDeltaPct: -30,
        temperatureShiftC: 2,
        irrigationMode: 'current',
        primaryCropId: baseCropId,
        comparedAlternativeCropIds: baseAlts,
      },
      notes: 'Baseline drought-heat stress test against historical NASA POWER window.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function loadScenariosForFarm(
  allScenarios: SavedClimateScenario[],
  farm: Farm | null
): SavedClimateScenario[] {
  if (!farm) return [];
  const existing = allScenarios.filter((s) => s.farmId === farm.id);
  if (existing.length > 0) return existing;
  return buildDefaultScenariosForFarm(farm);
}

export function createSavedScenario(params: {
  farmId: string;
  name: string;
  config: ClimateScenarioConfig;
  notes?: string;
}): SavedClimateScenario {
  const now = new Date().toISOString();
  return {
    id: `scen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    farmId: params.farmId,
    name: params.name.trim() || 'Untitled Climate Scenario',
    config: { ...params.config },
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export function saveOrUpdateScenario(
  allScenarios: SavedClimateScenario[],
  scenario: SavedClimateScenario
): SavedClimateScenario[] {
  const stamped: SavedClimateScenario = {
    ...scenario,
    updatedAt: new Date().toISOString(),
  };
  const exists = allScenarios.some((s) => s.id === scenario.id);
  return exists
    ? allScenarios.map((s) => (s.id === scenario.id ? stamped : s))
    : [stamped, ...allScenarios];
}

export function renameScenario(
  allScenarios: SavedClimateScenario[],
  scenarioId: string,
  newName: string
): SavedClimateScenario[] {
  const trimmed = newName.trim();
  if (!trimmed) return allScenarios;
  const now = new Date().toISOString();
  return allScenarios.map((s) =>
    s.id === scenarioId ? { ...s, name: trimmed, updatedAt: now } : s
  );
}

export function duplicateScenario(
  allScenarios: SavedClimateScenario[],
  scenarioId: string,
  customName?: string
): { scenarios: SavedClimateScenario[]; duplicated: SavedClimateScenario | null } {
  const source = allScenarios.find((s) => s.id === scenarioId);
  if (!source) return { scenarios: allScenarios, duplicated: null };
  const now = new Date().toISOString();
  const copy: SavedClimateScenario = {
    ...source,
    id: `scen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: customName?.trim() || `${source.name} (Copy)`,
    config: {
      ...source.config,
      comparedAlternativeCropIds: [...source.config.comparedAlternativeCropIds],
    },
    createdAt: now,
    updatedAt: now,
  };
  return {
    scenarios: [...allScenarios, copy],
    duplicated: copy,
  };
}

export function deleteScenario(
  allScenarios: SavedClimateScenario[],
  scenarioId: string
): SavedClimateScenario[] {
  return allScenarios.filter((s) => s.id !== scenarioId);
}

export function compareSavedScenarios(
  scenarios: SavedClimateScenario[],
  selectedScenarioIds: string[],
  farm: Farm | null,
  nasaData: NasaPowerClimateDataset | null
): ScenarioComparisonSummary {
  const uniqueIds = Array.from(new Set(selectedScenarioIds));
  const truncatedFromCount = Math.max(0, uniqueIds.length - MAX_COMPARISON_SCENARIOS);
  const limitedIds = uniqueIds.slice(0, MAX_COMPARISON_SCENARIOS);
  const byId = new Map(scenarios.map((s) => [s.id, s]));

  const entries: ScenarioComparisonEntry[] = limitedIds
    .map((id) => byId.get(id))
    .filter((s): s is SavedClimateScenario => Boolean(s))
    .map((scenario) => ({
      scenario,
      result: simulateClimateScenario(farm, nasaData, scenario.config),
    }));

  const metricDefs = [
    { id: 'climate', label: 'Climate' },
    { id: 'water', label: 'Water' },
    { id: 'soil', label: 'Soil' },
    { id: 'season', label: 'Season' },
    { id: 'rotation', label: 'Rotation' },
  ] as const;

  const chartData = [
    {
      metric: 'Overall Score',
      ...Object.fromEntries(
        entries.map((e) => [
          e.scenario.id,
          e.result.primarySimulatedEval?.overallScore ?? 0,
        ])
      ),
    },
    ...metricDefs.map((m) => ({
      metric: m.label,
      ...Object.fromEntries(
        entries.map((e) => {
          const cat = e.result.primarySimulatedEval?.categories.find(
            (c) => c.id === m.id
          );
          return [e.scenario.id, cat?.score ?? 0];
        })
      ),
    })),
  ];

  return {
    entries,
    chartData,
    truncatedFromCount,
  };
}
