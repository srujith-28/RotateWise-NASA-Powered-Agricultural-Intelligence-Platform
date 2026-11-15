import type {
  ClimateMonthPoint,
  CropProfile,
  CropRecommendation,
  Farm,
  FarmClimateProfile,
  FarmFormInput,
  RotationStep,
  SimulationParams,
  SimulationResult,
} from '../types/rotatewise';

export interface RotationEvaluation {
  efficiencyScore: number;
  familyDiversityScore: number;
  nitrogenBalanceScore: number;
  rootAlternationScore: number;
  pestBreakScore: number;
  warnings: string[];
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function formatArea(acres: number, unitSystem: 'imperial' | 'metric'): string {
  if (unitSystem === 'metric') {
    const hectares = acres * 0.404686;
    return `${hectares.toFixed(1)} ha`;
  }
  return `${acres.toFixed(1)} ac`;
}

export function formatTemp(celsius: number, unitSystem: 'imperial' | 'metric'): string {
  if (unitSystem === 'imperial') {
    const f = (celsius * 9) / 5 + 32;
    return `${f.toFixed(1)}°F`;
  }
  return `${celsius.toFixed(1)}°C`;
}

export function convertTempValue(celsius: number, unitSystem: 'imperial' | 'metric'): number {
  if (unitSystem === 'imperial') {
    return Number(((celsius * 9) / 5 + 32).toFixed(1));
  }
  return Number(celsius.toFixed(1));
}

export function formatRainfall(mm: number, unitSystem: 'imperial' | 'metric'): string {
  if (unitSystem === 'imperial') {
    const inches = mm / 25.4;
    return `${inches.toFixed(2)} in`;
  }
  return `${Math.round(mm)} mm`;
}

export function convertRainfallValue(mm: number, unitSystem: 'imperial' | 'metric'): number {
  if (unitSystem === 'imperial') {
    return Number((mm / 25.4).toFixed(2));
  }
  return Math.round(mm);
}

export function calculateRotationEfficiency(
  sequence: RotationStep[],
  cropCatalog: CropProfile[],
  farm?: Pick<Farm, 'soilType' | 'irrigation'>
): RotationEvaluation {
  if (sequence.length === 0) {
    return {
      efficiencyScore: 0,
      familyDiversityScore: 0,
      nitrogenBalanceScore: 0,
      rootAlternationScore: 0,
      pestBreakScore: 0,
      warnings: ['Add at least two seasonal crops to evaluate rotation efficiency.'],
    };
  }

  const cropMap = new Map(cropCatalog.map((c) => [c.id, c]));
  const crops = sequence
    .map((s) => cropMap.get(s.cropId))
    .filter((c): c is CropProfile => Boolean(c));

  if (crops.length === 0) {
    return {
      efficiencyScore: 45,
      familyDiversityScore: 40,
      nitrogenBalanceScore: 45,
      rootAlternationScore: 45,
      pestBreakScore: 45,
      warnings: ['Unrecognized crop entries in sequence.'],
    };
  }

  const uniqueFamilies = new Set(crops.map((c) => c.family));
  const familyDiversityScore = clamp(
    Math.round((uniqueFamilies.size / Math.min(crops.length, 4)) * 100),
    25,
    100
  );

  const warnings: string[] = [];
  let consecutiveFamilyPenalty = 0;
  let rootTransitions = 0;
  let possibleTransitions = Math.max(1, crops.length - 1);

  for (let i = 1; i < crops.length; i++) {
    const prev = crops[i - 1];
    const curr = crops[i];
    if (prev.family === curr.family) {
      consecutiveFamilyPenalty += 18;
      warnings.push(
        `Back-to-back ${curr.family} (${prev.name} -> ${curr.name}) elevates soil-borne pest carryover.`
      );
    }
    if (prev.rootDepth !== curr.rootDepth) {
      rootTransitions += 1;
    }
    if (curr.avoidAfter.includes(prev.id)) {
      consecutiveFamilyPenalty += 10;
      warnings.push(`${curr.name} following ${prev.name} reduces early vigor.`);
    }
  }

  const rootAlternationScore =
    crops.length === 1
      ? 60
      : clamp(Math.round((rootTransitions / possibleTransitions) * 100), 30, 100);

  const hasFixer = crops.some((c) => c.nitrogenRole === 'Nitrogen Fixer');
  const hasScavenger = crops.some((c) => c.nitrogenRole === 'Nitrogen Scavenger');
  const netNitrogen = crops.reduce((acc, c) => acc + c.nitrogenDeltaKgHa, 0);

  let nitrogenBalanceScore = 58;
  if (hasFixer) nitrogenBalanceScore += 22;
  if (hasScavenger) nitrogenBalanceScore += 12;
  if (netNitrogen >= -40) nitrogenBalanceScore += 8;
  if (!hasFixer && crops.every((c) => c.nitrogenRole === 'Heavy Feeder')) {
    nitrogenBalanceScore -= 24;
    warnings.push('Rotation relies exclusively on heavy nitrogen feeders without a legume phase.');
  }
  nitrogenBalanceScore = clamp(nitrogenBalanceScore, 20, 100);

  const avgPestBreak =
    crops.reduce((acc, c) => acc + c.pestBreakValue, 0) / crops.length;
  let soilFitBonus = 0;
  if (farm) {
    const soilMatches = crops.filter((c) => c.preferredSoils.includes(farm.soilType)).length;
    soilFitBonus = Math.round((soilMatches / crops.length) * 8);
  }

  const pestBreakScore = clamp(Math.round(avgPestBreak - consecutiveFamilyPenalty), 20, 100);

  const rawEfficiency =
    familyDiversityScore * 0.3 +
    nitrogenBalanceScore * 0.28 +
    rootAlternationScore * 0.2 +
    pestBreakScore * 0.22 +
    soilFitBonus -
    consecutiveFamilyPenalty * 0.35;

  return {
    efficiencyScore: clamp(Math.round(rawEfficiency), 15, 99),
    familyDiversityScore,
    nitrogenBalanceScore,
    rootAlternationScore,
    pestBreakScore,
    warnings,
  };
}

export function calculateClimateSuitability(
  crop: CropProfile,
  climate: FarmClimateProfile,
  irrigation: Farm['irrigation']
): number {
  const [minOpt, maxOpt] = crop.optimalTempC;
  const meanTemp = climate.meanGrowingTempC;
  let tempScore = 95;
  if (meanTemp < minOpt) {
    tempScore -= (minOpt - meanTemp) * 8;
  } else if (meanTemp > maxOpt) {
    tempScore -= (meanTemp - maxOpt) * 9;
  }

  const growingSeasonRain = climate.annualRainfallMm * 0.68;
  const effectiveMoisture =
    irrigation === 'Full Center-Pivot' || irrigation === 'Drip Irrigation'
      ? Math.max(growingSeasonRain, crop.waterNeedMm * 0.96)
      : irrigation === 'Supplemental Rainfed'
        ? growingSeasonRain * 1.15
        : growingSeasonRain;

  const waterRatio = effectiveMoisture / Math.max(150, crop.waterNeedMm);
  let moistureScore = 95;
  if (waterRatio < 0.85) {
    moistureScore -= (0.85 - waterRatio) * 85;
  } else if (waterRatio > 1.45) {
    moistureScore -= (waterRatio - 1.45) * 35;
  }

  const frostBonus = climate.frostFreeDays >= crop.daysToMaturity + 20 ? 5 : -10;
  return clamp(Math.round(tempScore * 0.48 + moistureScore * 0.47 + frostBonus), 22, 99);
}

export function getRecommendedNextCrops(
  farm: Farm,
  climate: FarmClimateProfile,
  cropCatalog: CropProfile[]
): CropRecommendation[] {
  const currentCrop = cropCatalog.find((c) => c.id === farm.currentCropId);
  const candidates = cropCatalog.filter((c) => c.id !== farm.currentCropId);

  const ranked = candidates.map((crop) => {
    const climateScore = calculateClimateSuitability(crop, climate, farm.irrigation);
    const soilMatch = crop.preferredSoils.includes(farm.soilType) ? 10 : -6;

    let sequenceScore = 70;
    const reasons: string[] = [];

    if (currentCrop) {
      if (crop.family !== currentCrop.family) {
        sequenceScore += 14;
        reasons.push(`breaks ${currentCrop.family} pest cycle`);
      } else {
        sequenceScore -= 22;
        reasons.push(`shares ${currentCrop.family} family with current crop`);
      }

      if (
        currentCrop.nitrogenRole === 'Heavy Feeder' &&
        crop.nitrogenRole === 'Nitrogen Fixer'
      ) {
        sequenceScore += 15;
        reasons.push(`restores +${crop.nitrogenDeltaKgHa} kg/ha nitrogen`);
      } else if (crop.nitrogenRole === 'Nitrogen Scavenger') {
        sequenceScore += 10;
        reasons.push('captures residual nitrate and prevents leaching');
      }

      if (crop.rootDepth !== currentCrop.rootDepth) {
        sequenceScore += 6;
        reasons.push(`alternates to ${crop.rootDepth.toLowerCase()} rooting profile`);
      }

      if (crop.bestPrecededBy.includes(currentCrop.id)) {
        sequenceScore += 8;
      }
      if (crop.avoidAfter.includes(currentCrop.id)) {
        sequenceScore -= 18;
      }
    }

    if (soilMatch > 0) {
      reasons.push(`well suited to ${farm.soilType}`);
    }

    const suitabilityScore = clamp(
      Math.round(climateScore * 0.48 + sequenceScore * 0.42 + soilMatch),
      25,
      98
    );

    const yieldOutlookDeltaPct = Number(
      (((suitabilityScore - 68) / 32) * 14 + (crop.nitrogenDeltaKgHa > 0 ? 2.5 : 0)).toFixed(1)
    );

    const fitLabel: CropRecommendation['fitLabel'] =
      suitabilityScore >= 84
        ? 'Optimal Fit'
        : suitabilityScore >= 70
          ? 'Strong Fit'
          : 'Moderate Fit';

    const rationaleText =
      reasons.length > 0
        ? `${reasons[0].charAt(0).toUpperCase() + reasons[0].slice(1)}${reasons.slice(1).length ? `, ${reasons.slice(1).join(', ')}` : ''}.`
        : crop.summary;

    return {
      crop,
      suitabilityScore,
      yieldOutlookDeltaPct,
      nitrogenGainKgHa: crop.nitrogenDeltaKgHa,
      rationale: rationaleText,
      fitLabel,
    };
  });

  return ranked.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

export function runScenarioSimulation(
  farm: Farm,
  climate: FarmClimateProfile,
  cropCatalog: CropProfile[],
  params: SimulationParams
): SimulationResult {
  const targetCrop =
    cropCatalog.find((c) => c.id === params.targetCropId) ??
    cropCatalog.find((c) => c.id === farm.currentCropId) ??
    cropCatalog[0];

  const baseSuitability = calculateClimateSuitability(targetCrop, climate, farm.irrigation);
  const adjustedClimate: FarmClimateProfile = {
    ...climate,
    annualRainfallMm: Math.max(150, climate.annualRainfallMm * (1 + params.rainfallDeltaPct / 100)),
    meanGrowingTempC: climate.meanGrowingTempC + params.tempShiftC,
  };
  const simSuitability = calculateClimateSuitability(
    targetCrop,
    adjustedClimate,
    farm.irrigation
  );

  const nitrogenYieldBonus =
    params.nitrogenStrategy === 'intensive'
      ? 4.2
      : params.nitrogenStrategy === 'balanced'
        ? 2.0
        : -3.5;

  const coverCropResilience = params.useCoverCrop ? 4.8 : 0;
  const irrigationBuffer =
    farm.irrigation === 'Full Center-Pivot' || farm.irrigation === 'Drip Irrigation'
      ? 0.45
      : 1.0;

  const rainfallPenalty =
    params.rainfallDeltaPct < -15
      ? (params.rainfallDeltaPct + 15) * 0.42 * irrigationBuffer
      : params.rainfallDeltaPct > 25
        ? -(params.rainfallDeltaPct - 25) * 0.28
        : 0;

  const heatPenalty =
    params.tempShiftC > 1.5 ? -(params.tempShiftC - 1.5) * 3.8 : 0;

  const projectedYieldChangePct = Number(
    clamp(
      (simSuitability - baseSuitability) * 0.45 +
        nitrogenYieldBonus +
        coverCropResilience +
        rainfallPenalty +
        heatPenalty,
      -38,
      24
    ).toFixed(1)
  );

  const moistureStressScore = clamp(
    Math.round(
      34 -
        params.rainfallDeltaPct * 0.65 * irrigationBuffer +
        params.tempShiftC * 7.5 -
        (params.useCoverCrop ? 10 : 0)
    ),
    8,
    95
  );

  const soilCarbonDeltaPct = Number(
    (
      (params.useCoverCrop ? 0.34 : -0.08) +
      (params.nitrogenStrategy === 'balanced' ? 0.09 : params.nitrogenStrategy === 'reduced' ? 0.04 : -0.05) -
      Math.max(0, params.tempShiftC * 0.04)
    ).toFixed(2)
  );

  const nitrogenLeachingRisk: SimulationResult['nitrogenLeachingRisk'] =
    params.nitrogenStrategy === 'intensive' && params.rainfallDeltaPct > 10 && !params.useCoverCrop
      ? 'High'
      : params.nitrogenStrategy === 'intensive' || (!params.useCoverCrop && params.rainfallDeltaPct > 15)
        ? 'Moderate'
        : 'Low';

  const years = ['2026', '2027', '2028', '2029', '2030'];
  const timeline = years.map((year, idx) => {
    const baselineYield = Number((100 + idx * 0.6).toFixed(1));
    const compounding = idx * (params.useCoverCrop ? 1.4 : -0.7);
    const simulatedYield = Number(
      clamp(100 + projectedYieldChangePct + compounding, 55, 135).toFixed(1)
    );
    const soilCarbonIndex = Number(
      clamp(
        farm.health.organicMatterPct * 20 + idx * soilCarbonDeltaPct * 6,
        35,
        98
      ).toFixed(1)
    );
    const moistureStressRisk = clamp(
      Math.round(moistureStressScore + idx * (params.useCoverCrop ? -1.5 : 1.8)),
      5,
      96
    );
    return {
      year,
      baselineYield,
      simulatedYield,
      soilCarbonIndex,
      moistureStressRisk,
    };
  });

  const advisorySummary =
    projectedYieldChangePct >= 0
      ? `${targetCrop.name} maintains stable productivity (+${projectedYieldChangePct}%) under ${params.rainfallDeltaPct >= 0 ? `+${params.rainfallDeltaPct}%` : `${params.rainfallDeltaPct}%`} rainfall and ${params.tempShiftC >= 0 ? `+${params.tempShiftC}°C` : `${params.tempShiftC}°C`} temperature shift${params.useCoverCrop ? ' aided by cover crop moisture retention' : ''}.`
      : `Projected yield softens by ${projectedYieldChangePct}% due to ${moistureStressScore > 60 ? 'elevated moisture deficit' : 'thermal stress'}; adding a winter cover crop and balancing nitrogen can recover 4–7%.`;

  return {
    projectedYieldChangePct,
    moistureStressScore,
    soilCarbonDeltaPct,
    nitrogenLeachingRisk,
    advisorySummary,
    timeline,
  };
}

export function validateFarmInput(
  input: FarmFormInput,
  unitSystem: 'imperial' | 'metric'
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.name.trim() || input.name.trim().length < 2) {
    errors.name = 'Enter a farm name (at least 2 characters).';
  }
  if (!input.location.trim() || input.location.trim().length < 2) {
    errors.location = 'Enter a city, county, or agricultural region.';
  }

  const lat = Number(input.lat);
  if (input.lat.trim() === '' || Number.isNaN(lat) || lat < -90 || lat > 90) {
    errors.lat = 'Latitude must be between -90 and 90.';
  }

  const lng = Number(input.lng);
  if (input.lng.trim() === '' || Number.isNaN(lng) || lng < -180 || lng > 180) {
    errors.lng = 'Longitude must be between -180 and 180.';
  }

  const area = Number(input.landArea);
  if (input.landArea.trim() === '' || Number.isNaN(area) || area <= 0 || area > 500000) {
    errors.landArea = `Enter a valid area greater than 0 (${unitSystem === 'metric' ? 'hectares' : 'acres'}).`;
  }

  if (typeof input.phLevel === 'string' && input.phLevel.trim() !== '') {
    const ph = Number(input.phLevel);
    if (Number.isNaN(ph) || ph < 3.5 || ph > 9.5) {
      errors.phLevel = 'Soil pH must be between 3.5 and 9.5.';
    }
  }

  if (!input.currentCropId) {
    errors.currentCropId = 'Select the current active crop.';
  }

  return errors;
}

export function summarizeClimate(monthly: ClimateMonthPoint[]): {
  totalRainfallMm: number;
  meanTempC: number;
} {
  if (monthly.length === 0) return { totalRainfallMm: 0, meanTempC: 0 };
  const totalRainfallMm = monthly.reduce((sum, m) => sum + m.rainfallMm, 0);
  const meanTempC = Number(
    (monthly.reduce((sum, m) => sum + m.tempAvgC, 0) / monthly.length).toFixed(1)
  );
  return { totalRainfallMm, meanTempC };
}

export type ClimateRangePreset = '12m' | 'growing' | '6m' | 'spring' | 'custom';

export interface ClimateDateRange {
  preset: ClimateRangePreset;
  startMonthIndex: number; // 0 = Jan, 11 = Dec
  endMonthIndex: number;
}

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function getPresetMonthBounds(preset: Exclude<ClimateRangePreset, 'custom'>): {
  startMonthIndex: number;
  endMonthIndex: number;
} {
  switch (preset) {
    case 'growing':
      return { startMonthIndex: 3, endMonthIndex: 9 }; // Apr - Oct
    case '6m':
      return { startMonthIndex: 6, endMonthIndex: 11 }; // Jul - Dec
    case 'spring':
      return { startMonthIndex: 0, endMonthIndex: 5 }; // Jan - Jun
    case '12m':
    default:
      return { startMonthIndex: 0, endMonthIndex: 11 }; // Jan - Dec
  }
}

export function filterClimateByRange(
  monthly: ClimateMonthPoint[],
  range: ClimateDateRange
): ClimateMonthPoint[] {
  const start = clamp(Math.min(range.startMonthIndex, range.endMonthIndex), 0, 11);
  const end = clamp(Math.max(range.startMonthIndex, range.endMonthIndex), 0, 11);
  return monthly.filter((_, index) => index >= start && index <= end);
}

export function formatRangeLabel(range: ClimateDateRange): string {
  const start = clamp(Math.min(range.startMonthIndex, range.endMonthIndex), 0, 11);
  const end = clamp(Math.max(range.startMonthIndex, range.endMonthIndex), 0, 11);
  return `${MONTH_LABELS[start]}–${MONTH_LABELS[end]}`;
}

