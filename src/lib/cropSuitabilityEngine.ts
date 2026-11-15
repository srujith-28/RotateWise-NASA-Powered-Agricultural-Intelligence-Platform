import { CROP_KNOWLEDGE_DATABASE } from '../data/cropKnowledgeDb';
import type {
  ConfidenceLevel,
  CropKnowledgeEntry,
  CropProfile,
  CropSuitabilityEvaluation,
  Farm,
  GrowingSeasonTag,
  IrrigationType,
  NasaPowerClimateDataset,
  SuitabilityCategoryLabel,
  SuitabilityCategoryScore,
} from '../types/rotatewise';

export const MAX_COMPARISON_CROPS = 4;

const CROP_ID_ALIASES: Record<string, string> = {
  corn: 'maize',
  dent_corn: 'maize',
  soybeans: 'soybean',
  winter_wheat: 'wheat',
};

const KNOWN_CROP_FAMILIES: Record<string, string> = {
  rice: 'Poaceae (Grass)',
  wheat: 'Poaceae (Grass)',
  winter_wheat: 'Poaceae (Grass)',
  maize: 'Poaceae (Grass)',
  corn: 'Poaceae (Grass)',
  sorghum: 'Poaceae (Grass)',
  pearl_millet: 'Poaceae (Grass)',
  oats: 'Poaceae (Grass)',
  soybean: 'Fabaceae (Legume)',
  soybeans: 'Fabaceae (Legume)',
  groundnut: 'Fabaceae (Legume)',
  chickpea: 'Fabaceae (Legume)',
  crimson_clover: 'Fabaceae (Legume)',
  alfalfa: 'Fabaceae (Legume)',
  cotton: 'Malvaceae (Mallow)',
  mustard: 'Brassicaceae (Brassica)',
  oilseed_radish: 'Brassicaceae (Brassica)',
};

const LEGUME_IDS = new Set([
  'soybean',
  'soybeans',
  'groundnut',
  'chickpea',
  'crimson_clover',
  'alfalfa',
]);

export function normalizeCropReferenceId(cropId: string | null | undefined): string | null {
  if (!cropId || typeof cropId !== 'string') return null;
  const cleaned = cropId.trim().toLowerCase();
  if (!cleaned) return null;
  return CROP_ID_ALIASES[cleaned] ?? cleaned;
}

export function resolveCropFamily(cropId: string | null | undefined, fallbackFamily?: string): string | null {
  const norm = normalizeCropReferenceId(cropId);
  if (norm && KNOWN_CROP_FAMILIES[norm]) {
    return KNOWN_CROP_FAMILIES[norm];
  }
  if (cropId && KNOWN_CROP_FAMILIES[cropId.toLowerCase()]) {
    return KNOWN_CROP_FAMILIES[cropId.toLowerCase()];
  }
  return fallbackFamily ?? null;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getPreviousCropContext(farm: Farm): {
  cropId: string | null;
  cropName: string | null;
  family: string | null;
} {
  // Prefer active crop on farm, or latest completed/active step in rotation history
  if (farm.currentCropId) {
    return {
      cropId: normalizeCropReferenceId(farm.currentCropId),
      cropName: farm.currentCropName || farm.currentCropId,
      family: resolveCropFamily(farm.currentCropId),
    };
  }
  const latestStep = [...farm.rotationPlan]
    .reverse()
    .find((s) => s.status === 'active' || s.status === 'completed');
  if (latestStep) {
    return {
      cropId: normalizeCropReferenceId(latestStep.cropId),
      cropName: latestStep.cropName,
      family: resolveCropFamily(latestStep.cropId, latestStep.family),
    };
  }
  return { cropId: null, cropName: null, family: null };
}

function scoreClimateCategory(
  crop: CropKnowledgeEntry,
  nasaData: NasaPowerClimateDataset | null
): { category: SuitabilityCategoryScore; evaluatedWeight: number; reasons: string[]; challenges: string[]; missing: string[] } {
  const weight = 30;
  if (!nasaData || nasaData.summary.validDayCount === 0 || nasaData.summary.meanTempC === null) {
    return {
      category: {
        id: 'climate',
        label: 'Climate (NASA POWER)',
        weight,
        score: null,
        contribution: 0,
        status: 'unavailable',
        detail: 'NASA POWER temperature observations are unavailable for the selected farm/date range.',
        missingInputs: ['NASA POWER daily temperature (T2M, T2M_MIN, T2M_MAX)'],
      },
      evaluatedWeight: 0,
      reasons: [],
      challenges: ['Climate suitability could not be verified without NASA POWER observations.'],
      missing: ['NASA POWER historical temperature & solar irradiance'],
    };
  }

  const { meanTempC, minTempC, maxTempC, avgSolarRadiationMj } = nasaData.summary;
  const [optLow, optHigh] = crop.idealTempC;
  const missingInputs: string[] = [];

  // 1. Mean thermal alignment (max 18 pts)
  let tempPoints = 18;
  if (meanTempC < optLow) {
    tempPoints = Math.round(clamp(18 - (optLow - meanTempC) * 1.8, 0, 18));
  } else if (meanTempC > optHigh) {
    tempPoints = Math.round(clamp(18 - (meanTempC - optHigh) * 1.9, 0, 18));
  }

  // 2. Frost & heat extremes (max 8 pts)
  let extremePoints = 8;
  const challenges: string[] = [];
  if (minTempC !== null && crop.frostSensitivityC !== null && minTempC < crop.frostSensitivityC) {
    const gap = crop.frostSensitivityC - minTempC;
    const penalty = clamp(Math.round(gap * 1.2), 1, 5);
    extremePoints -= penalty;
    challenges.push(
      `Observed overnight low (${minTempC.toFixed(1)}°C) dipped below frost threshold (${crop.frostSensitivityC}°C).`
    );
  }
  if (maxTempC !== null && crop.heatStressThresholdC !== null && maxTempC > crop.heatStressThresholdC) {
    const gap = maxTempC - crop.heatStressThresholdC;
    const penalty = clamp(Math.round(gap * 1.2), 1, 5);
    extremePoints -= penalty;
    challenges.push(
      `Observed peak temperature (${maxTempC.toFixed(1)}°C) exceeded heat-stress threshold (${crop.heatStressThresholdC}°C).`
    );
  }
  extremePoints = clamp(extremePoints, 0, 8);

  // 3. Solar radiation (max 4 pts)
  let solarPoints = 0;
  let evaluatedSubWeight = 26;
  if (avgSolarRadiationMj !== null) {
    evaluatedSubWeight = 30;
    solarPoints = avgSolarRadiationMj >= 14 ? 4 : avgSolarRadiationMj >= 10 ? 3 : 2;
  } else {
    missingInputs.push('Solar radiation (ALLSKY_SFC_SW_DWN)');
  }

  const rawContribution = clamp(tempPoints + extremePoints + solarPoints, 0, evaluatedSubWeight);
  const categoryScore = Math.round((rawContribution / evaluatedSubWeight) * 100);
  const reasons: string[] = [];

  if (meanTempC >= optLow && meanTempC <= optHigh) {
    reasons.push(
      `Observed mean temperature (${meanTempC.toFixed(1)}°C) sits squarely inside ${crop.name}'s optimal ${optLow}–${optHigh}°C range.`
    );
  } else if (meanTempC < optLow) {
    challenges.push(
      `Observed period (${meanTempC.toFixed(1)}°C) is cooler than ${crop.name}'s optimal ${optLow}–${optHigh}°C growing envelope.`
    );
  } else {
    challenges.push(
      `Observed period (${meanTempC.toFixed(1)}°C) runs warmer than ${crop.name}'s optimal ${optLow}–${optHigh}°C range.`
    );
  }

  return {
    category: {
      id: 'climate',
      label: 'Climate (NASA POWER)',
      weight,
      score: categoryScore,
      contribution: rawContribution,
      status: missingInputs.length > 0 ? 'partial' : 'evaluated',
      detail: `Mean ${meanTempC.toFixed(1)}°C (${minTempC !== null ? `${minTempC.toFixed(1)}°C` : '—'} to ${
        maxTempC !== null ? `${maxTempC.toFixed(1)}°C` : '—'
      }) vs optimal ${optLow}–${optHigh}°C`,
      missingInputs,
    },
    evaluatedWeight: evaluatedSubWeight,
    reasons,
    challenges,
    missing: missingInputs,
  };
}

function scoreIrrigationCompatibility(
  irrigation: IrrigationType,
  crop: CropKnowledgeEntry,
  dailyRainMm: number | null,
  dailyCropDemandMm: number
): number {
  const deficitRatio =
    dailyRainMm !== null ? clamp((dailyCropDemandMm - dailyRainMm) / Math.max(1, dailyCropDemandMm), 0, 1) : 0.4;

  if (irrigation === 'Full Center-Pivot' || irrigation === 'Drip Irrigation') {
    if (crop.id === 'rice' && irrigation === 'Drip Irrigation') return 7;
    return 10;
  }
  if (irrigation === 'Supplemental Rainfed') {
    if (crop.irrigationDependency === 'High') {
      return deficitRatio > 0.35 ? 6 : 8;
    }
    if (crop.irrigationDependency === 'Moderate') return 9;
    return 10;
  }
  // Dryland (Rainfed Only)
  if (crop.irrigationDependency === 'Optional (Rainfed-Resilient)') return 10;
  if (crop.irrigationDependency === 'Low') return 8;
  if (crop.irrigationDependency === 'Moderate') {
    return deficitRatio > 0.4 ? 4 : 7;
  }
  // High irrigation dependency under dryland
  return deficitRatio > 0.25 ? 1 : 4;
}

function scoreWaterCategory(
  crop: CropKnowledgeEntry,
  farm: Farm,
  nasaData: NasaPowerClimateDataset | null
): {
  category: SuitabilityCategoryScore;
  evaluatedWeight: number;
  reasons: string[];
  challenges: string[];
  consideration: string;
  missing: string[];
} {
  const weight = 25;
  const avgWaterNeedMm = (crop.waterNeedMm[0] + crop.waterNeedMm[1]) / 2;
  const avgDays = (crop.growingDurationDays[0] + crop.growingDurationDays[1]) / 2;
  const dailyCropDemandMm = avgWaterNeedMm / avgDays;

  const hasRainfall =
    nasaData !== null &&
    nasaData.summary.validDayCount > 0 &&
    nasaData.summary.totalRainfallMm !== null;

  const dailyRainMm = hasRainfall
    ? (nasaData.summary.totalRainfallMm as number) / nasaData.summary.validDayCount
    : null;

  const irrPoints = scoreIrrigationCompatibility(
    farm.irrigation,
    crop,
    dailyRainMm,
    dailyCropDemandMm
  );

  const reasons: string[] = [];
  const challenges: string[] = [];

  if (!hasRainfall || dailyRainMm === null) {
    const score = Math.round((irrPoints / 10) * 100);
    const missing = ['NASA POWER daily rainfall (PRECTOTCORR)'];
    if (farm.irrigation === 'Dryland (Rainfed Only)' && crop.irrigationDependency === 'High') {
      challenges.push(
        `${crop.name} has high irrigation dependency (${crop.waterNeedMm[0]}–${crop.waterNeedMm[1]} mm) while this parcel is Dryland.`
      );
    }
    return {
      category: {
        id: 'water',
        label: 'Water & Rainfall Fit',
        weight,
        score,
        contribution: irrPoints,
        status: 'partial',
        detail: `Irrigation evaluated (${farm.irrigation}); NASA POWER rainfall unavailable.`,
        missingInputs: missing,
      },
      evaluatedWeight: 10,
      reasons,
      challenges,
      consideration: `${crop.name} requires ${crop.waterNeedMm[0]}–${crop.waterNeedMm[1]} mm/season (${crop.irrigationDependency} irrigation dependency). Parcel irrigation: ${farm.irrigation}; historical rainfall unverified.`,
      missing,
    };
  }

  // Compare observed daily precipitation + effective irrigation buffering against crop daily demand
  const irrigationSupplyBoostMm =
    farm.irrigation === 'Full Center-Pivot' || farm.irrigation === 'Drip Irrigation'
      ? dailyCropDemandMm * 0.65
      : farm.irrigation === 'Supplemental Rainfed'
        ? dailyCropDemandMm * 0.25
        : 0;

  const effectiveDailySupplyMm = dailyRainMm + irrigationSupplyBoostMm;
  const supplyRatio = effectiveDailySupplyMm / Math.max(0.5, dailyCropDemandMm);

  let rainPoints = 15;
  if (supplyRatio < 0.85) {
    rainPoints = Math.round(clamp((supplyRatio / 0.85) * 15, 2, 15));
    challenges.push(
      `Observed rainfall (${dailyRainMm.toFixed(1)} mm/day) trails ${crop.name}'s ~${dailyCropDemandMm.toFixed(
        1
      )} mm/day demand under ${farm.irrigation}.`
    );
  } else if (supplyRatio > 2.4 && crop.id !== 'rice') {
    rainPoints = Math.round(clamp(15 - (supplyRatio - 2.4) * 3, 7, 15));
    challenges.push(
      `Wet period (${dailyRainMm.toFixed(1)} mm/day) raises root-zone waterlogging and foliar disease pressure.`
    );
  } else {
    reasons.push(
      `Water balance aligns well: ${dailyRainMm.toFixed(1)} mm/day observed rain paired with ${farm.irrigation}.`
    );
  }

  const totalContribution = clamp(rainPoints + irrPoints, 0, weight);
  const score = Math.round((totalContribution / weight) * 100);

  return {
    category: {
      id: 'water',
      label: 'Water & Rainfall Fit',
      weight,
      score,
      contribution: totalContribution,
      status: 'evaluated',
      detail: `Observed ${dailyRainMm.toFixed(1)} mm/day vs ~${dailyCropDemandMm.toFixed(1)} mm/day demand · ${farm.irrigation}`,
      missingInputs: [],
    },
    evaluatedWeight: weight,
    reasons,
    challenges,
    consideration: `Seasonal demand: ${crop.waterNeedMm[0]}–${crop.waterNeedMm[1]} mm (${crop.irrigationDependency} irrigation dependency). Observed NASA POWER rainfall averaged ${dailyRainMm.toFixed(1)} mm/day across ${nasaData.summary.validDayCount} days.`,
    missing: [],
  };
}

function scoreSoilCategory(
  crop: CropKnowledgeEntry,
  farm: Farm
): {
  category: SuitabilityCategoryScore;
  evaluatedWeight: number;
  reasons: string[];
  challenges: string[];
  consideration: string;
  missing: string[];
} {
  const weight = 20;
  const reasons: string[] = [];
  const challenges: string[] = [];
  const missingInputs: string[] = [];

  let texturePoints = 2;
  if (crop.suitableSoilTypes.includes(farm.soilType)) {
    texturePoints = 12;
    reasons.push(`${farm.soilType} is a primary suitable soil texture for ${crop.name}.`);
  } else if (crop.secondarySoilTypes.includes(farm.soilType)) {
    texturePoints = 8;
    reasons.push(`${farm.soilType} is moderately workable for ${crop.name} with drainage care.`);
  } else {
    texturePoints = 2;
    challenges.push(
      `${farm.soilType} is outside ${crop.name}'s preferred textures (${crop.suitableSoilTypes.join(', ')}).`
    );
  }

  const ph = farm.health?.phLevel;
  const validPh = typeof ph === 'number' && Number.isFinite(ph) && ph >= 3.5 && ph <= 9.5;
  const [phMin, phMax] = crop.soilPhRange;

  if (!validPh) {
    missingInputs.push('Valid farm soil pH (3.5–9.5)');
    const score = Math.round((texturePoints / 12) * 100);
    return {
      category: {
        id: 'soil',
        label: 'Soil & pH Compatibility',
        weight,
        score,
        contribution: texturePoints,
        status: 'partial',
        detail: `${farm.soilType} evaluated; soil pH unavailable or out of valid range.`,
        missingInputs,
      },
      evaluatedWeight: 12,
      reasons,
      challenges,
      consideration: `${farm.soilType} soil (${crop.soilDrainagePreference}). Target pH ${phMin.toFixed(1)}–${phMax.toFixed(1)}; parcel pH missing. ${crop.nutrientRequirements.npkGuidanceKgHa}.`,
      missing: missingInputs,
    };
  }

  let phPoints = 8;
  if (ph < phMin) {
    phPoints = Math.round(clamp(8 - (phMin - ph) * 6, 0, 8));
    challenges.push(`Parcel pH (${ph.toFixed(1)}) is more acidic than ideal ${phMin.toFixed(1)}–${phMax.toFixed(1)}.`);
  } else if (ph > phMax) {
    phPoints = Math.round(clamp(8 - (ph - phMax) * 6, 0, 8));
    challenges.push(`Parcel pH (${ph.toFixed(1)}) is more alkaline than ideal ${phMin.toFixed(1)}–${phMax.toFixed(1)}.`);
  } else {
    reasons.push(`Parcel pH (${ph.toFixed(1)}) falls within ${crop.name}'s optimal ${phMin.toFixed(1)}–${phMax.toFixed(1)} range.`);
  }

  const contribution = clamp(texturePoints + phPoints, 0, weight);
  const score = Math.round((contribution / weight) * 100);

  return {
    category: {
      id: 'soil',
      label: 'Soil & pH Compatibility',
      weight,
      score,
      contribution,
      status: 'evaluated',
      detail: `${farm.soilType} · pH ${ph.toFixed(1)} (target ${phMin.toFixed(1)}–${phMax.toFixed(1)})`,
      missingInputs: [],
    },
    evaluatedWeight: weight,
    reasons,
    challenges,
    consideration: `${crop.nutrientRequirements.nitrogenRole} (${crop.nutrientRequirements.nitrogenDeltaKgHa >= 0 ? `+${crop.nutrientRequirements.nitrogenDeltaKgHa}` : crop.nutrientRequirements.nitrogenDeltaKgHa} kg/ha N balance). Guidance: ${crop.nutrientRequirements.npkGuidanceKgHa}. Key micronutrients: ${crop.nutrientRequirements.keyMicronutrients.join(', ')}.`,
    missing: [],
  };
}

function getMeteorologicalSeasonTag(
  startIso: string,
  endIso: string,
  latitude: number
): 'warm_season' | 'cool_season' | 'transition' {
  const startMonth = Number(startIso.slice(5, 7));
  const endMonth = Number(endIso.slice(5, 7));
  const midMonth = Math.round((startMonth + endMonth) / 2);
  const isNorth = latitude >= 0;

  const warmMonths = isNorth ? [5, 6, 7, 8, 9] : [11, 12, 1, 2, 3];
  const coolMonths = isNorth ? [11, 12, 1, 2, 3] : [5, 6, 7, 8, 9];

  if (warmMonths.includes(midMonth)) return 'warm_season';
  if (coolMonths.includes(midMonth)) return 'cool_season';
  return 'transition';
}

function hasWarmPreferredSeason(seasons: GrowingSeasonTag[]): boolean {
  return seasons.some(
    (s) =>
      s.startsWith('Kharif') ||
      s.startsWith('Zaid') ||
      s.startsWith('Spring–Summer')
  );
}

function hasCoolPreferredSeason(seasons: GrowingSeasonTag[]): boolean {
  return seasons.some(
    (s) => s.startsWith('Rabi') || s.startsWith('Autumn–Spring')
  );
}

function scoreSeasonCategory(
  crop: CropKnowledgeEntry,
  farm: Farm,
  nasaData: NasaPowerClimateDataset | null
): {
  category: SuitabilityCategoryScore;
  evaluatedWeight: number;
  reasons: string[];
  challenges: string[];
  missing: string[];
} {
  const weight = 15;
  if (!nasaData || nasaData.summary.validDayCount === 0 || nasaData.summary.meanTempC === null) {
    return {
      category: {
        id: 'season',
        label: 'Growing-Season Fit',
        weight,
        score: null,
        contribution: 0,
        status: 'unavailable',
        detail: 'Growing-season thermal compatibility requires NASA POWER window observations.',
        missingInputs: ['NASA POWER observation window & temperature'],
      },
      evaluatedWeight: 0,
      reasons: [],
      challenges: [],
      missing: ['NASA POWER growing-season verification'],
    };
  }

  const seasonKind = getMeteorologicalSeasonTag(
    nasaData.startDate,
    nasaData.endDate,
    farm.coordinates.lat
  );
  const prefersWarm = hasWarmPreferredSeason(crop.preferredSeasons);
  const prefersCool = hasCoolPreferredSeason(crop.preferredSeasons);
  const meanTempC = nasaData.summary.meanTempC;
  const reasons: string[] = [];
  const challenges: string[] = [];

  let seasonPoints = 11;
  if (seasonKind === 'warm_season') {
    if (prefersWarm) {
      seasonPoints = 15;
      reasons.push(`Observed warm-season window matches ${crop.name}'s preferred ${crop.preferredSeasons[0]} cycle.`);
    } else {
      seasonPoints = 5;
      challenges.push(`${crop.name} prefers cooler ${crop.preferredSeasons.join(' / ')} conditions rather than peak warm season.`);
    }
  } else if (seasonKind === 'cool_season') {
    if (prefersCool) {
      seasonPoints = 15;
      reasons.push(`Cooler observation window aligns with ${crop.name}'s preferred ${crop.preferredSeasons[0]} cycle.`);
    } else if (meanTempC >= crop.idealTempC[0] - 2) {
      seasonPoints = 10;
    } else {
      seasonPoints = 4;
      challenges.push(`Cool observation window (${meanTempC.toFixed(1)}°C) is marginal for warm-season ${crop.name} (${crop.growingDurationDays[0]}–${crop.growingDurationDays[1]} days).`);
    }
  } else {
    // Spring / Autumn transition window (e.g. Oct–Nov or Mar–Apr): check thermal closeness
    const [optLow, optHigh] = crop.idealTempC;
    if (meanTempC >= optLow - 2 && meanTempC <= optHigh + 2) {
      seasonPoints = 14;
      reasons.push(`Transitional window (${meanTempC.toFixed(1)}°C) aligns cleanly with ${crop.name} (${crop.growingDurationDays[0]}–${crop.growingDurationDays[1]} days).`);
    } else if (prefersCool && meanTempC <= optHigh + 3) {
      seasonPoints = 13;
      reasons.push(`Autumn/spring transition matches cool-season establishment for ${crop.name}.`);
    } else {
      seasonPoints = 7;
    }
  }

  const contribution = clamp(seasonPoints, 0, weight);
  const score = Math.round((contribution / weight) * 100);

  return {
    category: {
      id: 'season',
      label: 'Growing-Season Fit',
      weight,
      score,
      contribution,
      status: 'evaluated',
      detail: `${crop.preferredSeasons[0]} · ${crop.growingDurationDays[0]}–${crop.growingDurationDays[1]} days maturity`,
      missingInputs: [],
    },
    evaluatedWeight: weight,
    reasons,
    challenges,
    missing: [],
  };
}

function scoreRotationCategory(
  crop: CropKnowledgeEntry,
  farm: Farm
): {
  category: SuitabilityCategoryScore;
  evaluatedWeight: number;
  reasons: string[];
  challenges: string[];
  previousCropUsed: string | null;
  missing: string[];
} {
  const weight = 10;
  const prev = getPreviousCropContext(farm);

  if (!prev.cropId) {
    return {
      category: {
        id: 'rotation',
        label: 'Rotation Compatibility',
        weight,
        score: null,
        contribution: 0,
        status: 'unavailable',
        detail: 'No active or prior crop recorded on this farm parcel.',
        missingInputs: ['Previous or current crop history'],
      },
      evaluatedWeight: 0,
      reasons: [],
      challenges: ['No crop history recorded to verify rotational disease break.'],
      previousCropUsed: null,
      missing: ['Farm crop history'],
    };
  }

  const reasons: string[] = [];
  const challenges: string[] = [];
  let points = 6;

  if (crop.rotationCompatibility.bestPrecededBy.includes(prev.cropId)) {
    points = 10;
    reasons.push(
      `Strong rotational sequence following ${prev.cropName}: ${crop.rotationCompatibility.notes}`
    );
  } else if (crop.rotationCompatibility.avoidAfter.includes(prev.cropId)) {
    points = 2;
    challenges.push(
      `Rotational conflict after ${prev.cropName} (same host family risk: ${crop.family}).`
    );
  } else if (prev.family && prev.family === crop.family) {
    points = 3;
    challenges.push(
      `Shares ${crop.family} botanical family with ${prev.cropName}, raising pest and disease carryover.`
    );
  } else {
    points = 8;
    if (LEGUME_IDS.has(prev.cropId) && crop.nutrientRequirements.nitrogenDemandLevel === 'High') {
      points = 9;
      reasons.push(`Captures residual biological nitrogen left by preceding legume (${prev.cropName}).`);
    } else {
      reasons.push(`Rotates cleanly from ${prev.cropName} (${prev.family ?? 'prior crop'}) into ${crop.family}.`);
    }
  }

  const score = Math.round((points / weight) * 100);
  return {
    category: {
      id: 'rotation',
      label: 'Rotation Compatibility',
      weight,
      score,
      contribution: points,
      status: 'evaluated',
      detail: `After ${prev.cropName} · ${crop.family}`,
      missingInputs: [],
    },
    evaluatedWeight: weight,
    reasons,
    challenges,
    previousCropUsed: prev.cropName,
    missing: [],
  };
}

export function evaluateCropSuitability(
  crop: CropKnowledgeEntry,
  farm: Farm,
  nasaData: NasaPowerClimateDataset | null
): CropSuitabilityEvaluation {
  const climateRes = scoreClimateCategory(crop, nasaData);
  const waterRes = scoreWaterCategory(crop, farm, nasaData);
  const soilRes = scoreSoilCategory(crop, farm);
  const seasonRes = scoreSeasonCategory(crop, farm, nasaData);
  const rotationRes = scoreRotationCategory(crop, farm);

  const categories = [
    climateRes.category,
    waterRes.category,
    soilRes.category,
    seasonRes.category,
    rotationRes.category,
  ];

  const totalEvaluatedWeight =
    climateRes.evaluatedWeight +
    waterRes.evaluatedWeight +
    soilRes.evaluatedWeight +
    seasonRes.evaluatedWeight +
    rotationRes.evaluatedWeight;

  const dataCompletenessPct = Math.round(clamp(totalEvaluatedWeight, 0, 100));
  const overallScore = clamp(
    categories.reduce((sum, c) => sum + c.contribution, 0),
    0,
    100
  );

  let suitabilityCategory: SuitabilityCategoryLabel = 'Low';
  if (overallScore >= 75 && dataCompletenessPct >= 70) {
    suitabilityCategory = 'High';
  } else if (overallScore >= 50) {
    suitabilityCategory = 'Moderate';
  }

  let confidenceLevel: ConfidenceLevel = 'Low';
  if (dataCompletenessPct >= 90 && crop.confidenceLevel === 'High') {
    confidenceLevel = 'High';
  } else if (dataCompletenessPct >= 65) {
    confidenceLevel = 'Moderate';
  }

  const dataLimitations = Array.from(
    new Set([
      ...climateRes.missing,
      ...waterRes.missing,
      ...soilRes.missing,
      ...seasonRes.missing,
      ...rotationRes.missing,
      ...crop.unknownFields,
    ])
  );

  const supportingReasons = Array.from(
    new Set([
      ...climateRes.reasons,
      ...waterRes.reasons,
      ...soilRes.reasons,
      ...seasonRes.reasons,
      ...rotationRes.reasons,
    ])
  );

  const cultivationChallenges = Array.from(
    new Set([
      ...climateRes.challenges,
      ...waterRes.challenges,
      ...soilRes.challenges,
      ...seasonRes.challenges,
      ...rotationRes.challenges,
      ...crop.cultivationRisks.commonDiseases.slice(0, 2).map((d) => `Disease watch: ${d}`),
    ])
  );

  return {
    crop,
    overallScore,
    suitabilityCategory,
    confidenceLevel,
    dataCompletenessPct,
    categories,
    supportingReasons:
      supportingReasons.length > 0
        ? supportingReasons
        : [`Evaluated using ${dataCompletenessPct}% available agronomic and parcel inputs.`],
    cultivationChallenges,
    waterConsiderations: waterRes.consideration,
    soilAndNutrientConsiderations: soilRes.consideration,
    dataLimitations,
    previousCropUsed: rotationRes.previousCropUsed,
  };
}

export function evaluateCropsForFarm(
  farm: Farm | null,
  nasaData: NasaPowerClimateDataset | null,
  database: CropKnowledgeEntry[] = CROP_KNOWLEDGE_DATABASE
): CropSuitabilityEvaluation[] {
  if (!farm || !Array.isArray(database) || database.length === 0) {
    return [];
  }
  if (
    !farm.coordinates ||
    !Number.isFinite(farm.coordinates.lat) ||
    !Number.isFinite(farm.coordinates.lng) ||
    farm.coordinates.lat < -90 ||
    farm.coordinates.lat > 90 ||
    farm.coordinates.lng < -180 ||
    farm.coordinates.lng > 180
  ) {
    return [];
  }

  return database
    .map((crop) => evaluateCropSuitability(crop, farm, nasaData))
    .sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      return b.crop.rotationCompatibility.breakCropValue - a.crop.rotationCompatibility.breakCropValue;
    });
}

export function getTopRecommendedCrops(
  evaluations: CropSuitabilityEvaluation[],
  limit = 5
): CropSuitabilityEvaluation[] {
  return evaluations.slice(0, Math.max(0, limit));
}

export interface ComparisonWinnerInsight {
  status: 'determined' | 'insufficient';
  winnerCropId: string | null;
  winnerCropName: string | null;
  tiedCropNames: string[];
  scoreLabel: string | null;
  explanation: string;
}

export interface CropComparisonRecommendations {
  overall: ComparisonWinnerInsight;
  waterLimited: ComparisonWinnerInsight;
  soil: ComparisonWinnerInsight;
  rotation: ComparisonWinnerInsight;
}

export interface CropComparisonSummary {
  crops: CropSuitabilityEvaluation[];
  chartData: Array<{
    metric: string;
    [cropName: string]: string | number;
  }>;
  truncatedFromCount: number;
  recommendations: CropComparisonRecommendations;
}

function getCategory(
  item: CropSuitabilityEvaluation,
  id: 'climate' | 'water' | 'soil' | 'season' | 'rotation'
): SuitabilityCategoryScore | undefined {
  return item.categories.find((c) => c.id === id);
}

const IRRIGATION_DEPENDENCY_ORDER: Record<string, number> = {
  'Optional (Rainfed-Resilient)': 0,
  Low: 1,
  Moderate: 2,
  High: 3,
};

function deriveComparisonRecommendations(
  crops: CropSuitabilityEvaluation[]
): CropComparisonRecommendations {
  if (crops.length < 2) {
    const msg =
      crops.length === 0
        ? 'Select at least 2 crops to compare suitability and identify recommendations.'
        : `Only 1 crop (${crops[0].crop.name}) is selected. Add at least 1 more crop to compare relative suitability.`;
    const emptyInsight: ComparisonWinnerInsight = {
      status: 'insufficient',
      winnerCropId: null,
      winnerCropName: null,
      tiedCropNames: [],
      scoreLabel: null,
      explanation: msg,
    };
    return {
      overall: emptyInsight,
      waterLimited: emptyInsight,
      soil: emptyInsight,
      rotation: emptyInsight,
    };
  }

  // 1. Best Overall Suitable Crop
  const hasClimateForAll = crops.every(
    (c) => getCategory(c, 'climate')?.status !== 'unavailable'
  );
  const minCompleteness = Math.min(...crops.map((c) => c.dataCompletenessPct));

  let overall: ComparisonWinnerInsight;
  if (!hasClimateForAll || minCompleteness < 65) {
    overall = {
      status: 'insufficient',
      winnerCropId: null,
      winnerCropName: null,
      tiedCropNames: [],
      scoreLabel: null,
      explanation:
        'Available data is insufficient to verify an overall winner because NASA POWER historical climate observations are unavailable or parcel inputs are incomplete.',
    };
  } else {
    const sortedOverall = [...crops].sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      return b.dataCompletenessPct - a.dataCompletenessPct;
    });
    const best = sortedOverall[0];
    const tied = sortedOverall
      .filter((c) => c.overallScore === best.overallScore)
      .map((c) => c.crop.name);
    const soilPartialNote = crops.some((c) => getCategory(c, 'soil')?.status !== 'evaluated')
      ? ' Note: parcel soil pH is missing, so soil scores reflect texture only.'
      : '';
    overall = {
      status: 'determined',
      winnerCropId: best.crop.id,
      winnerCropName: best.crop.name,
      tiedCropNames: tied,
      scoreLabel: `${best.overallScore}/100 (${best.suitabilityCategory})`,
      explanation: `${tied.length > 1 ? `${tied.join(' & ')} tie` : `${best.crop.name} leads`} at ${best.overallScore}/100 (${best.confidenceLevel} confidence, ${best.dataCompletenessPct}% inputs verified): ${best.supportingReasons[0] ?? best.crop.summary}${soilPartialNote}`,
    };
  }

  // 2. Best Crop for Water-Limited Conditions
  const hasWaterEvalForAll = crops.every(
    (c) => getCategory(c, 'water')?.status === 'evaluated'
  );
  let waterLimited: ComparisonWinnerInsight;
  if (!hasWaterEvalForAll) {
    waterLimited = {
      status: 'insufficient',
      winnerCropId: null,
      winnerCropName: null,
      tiedCropNames: [],
      scoreLabel: null,
      explanation:
        'Available data is insufficient to rank field water-limited performance because NASA POWER rainfall observations are unavailable. Reference seasonal water ranges (mm) remain shown below.',
    };
  } else {
    const sortedWater = [...crops].sort((a, b) => {
      const aWater = getCategory(a, 'water')?.contribution ?? 0;
      const bWater = getCategory(b, 'water')?.contribution ?? 0;
      if (bWater !== aWater) return bWater - aWater;
      const aAvgNeed = (a.crop.waterNeedMm[0] + a.crop.waterNeedMm[1]) / 2;
      const bAvgNeed = (b.crop.waterNeedMm[0] + b.crop.waterNeedMm[1]) / 2;
      if (aAvgNeed !== bAvgNeed) return aAvgNeed - bAvgNeed;
      return (
        (IRRIGATION_DEPENDENCY_ORDER[a.crop.irrigationDependency] ?? 2) -
        (IRRIGATION_DEPENDENCY_ORDER[b.crop.irrigationDependency] ?? 2)
      );
    });
    const bestWater = sortedWater[0];
    const bestWaterCat = getCategory(bestWater, 'water')!;
    const tiedWater = sortedWater
      .filter((c) => {
        const w = getCategory(c, 'water')?.contribution ?? 0;
        const avgA = (c.crop.waterNeedMm[0] + c.crop.waterNeedMm[1]) / 2;
        const avgB = (bestWater.crop.waterNeedMm[0] + bestWater.crop.waterNeedMm[1]) / 2;
        return w === bestWaterCat.contribution && avgA === avgB;
      })
      .map((c) => c.crop.name);
    waterLimited = {
      status: 'determined',
      winnerCropId: bestWater.crop.id,
      winnerCropName: bestWater.crop.name,
      tiedCropNames: tiedWater,
      scoreLabel: `${bestWaterCat.score ?? 0}/100 water fit`,
      explanation: `${bestWater.crop.name} scores ${bestWaterCat.score}/100 (+${bestWaterCat.contribution}/${bestWaterCat.weight} pts) with ${bestWater.crop.waterNeedMm[0]}–${bestWater.crop.waterNeedMm[1]} mm seasonal water demand (${bestWater.crop.irrigationDependency} dependency).`,
    };
  }

  // 3. Best Crop for Soil Compatibility
  const hasSoilEvalForAll = crops.every(
    (c) => getCategory(c, 'soil')?.status === 'evaluated'
  );
  let soil: ComparisonWinnerInsight;
  if (!hasSoilEvalForAll) {
    soil = {
      status: 'insufficient',
      winnerCropId: null,
      winnerCropName: null,
      tiedCropNames: [],
      scoreLabel: null,
      explanation:
        'Available data is insufficient to confirm a soil compatibility winner because parcel soil pH is unavailable or outside valid range (3.5–9.5).',
    };
  } else {
    const sortedSoil = [...crops].sort((a, b) => {
      const aSoil = getCategory(a, 'soil')?.contribution ?? 0;
      const bSoil = getCategory(b, 'soil')?.contribution ?? 0;
      if (bSoil !== aSoil) return bSoil - aSoil;
      return b.overallScore - a.overallScore;
    });
    const bestSoil = sortedSoil[0];
    const bestSoilCat = getCategory(bestSoil, 'soil')!;
    const tiedSoil = sortedSoil
      .filter((c) => (getCategory(c, 'soil')?.contribution ?? 0) === bestSoilCat.contribution)
      .map((c) => c.crop.name);
    soil = {
      status: 'determined',
      winnerCropId: bestSoil.crop.id,
      winnerCropName: bestSoil.crop.name,
      tiedCropNames: tiedSoil,
      scoreLabel: `${bestSoilCat.score ?? 0}/100 soil fit`,
      explanation: `${tiedSoil.length > 1 ? `${tiedSoil.join(' & ')} tie` : `${bestSoil.crop.name} leads`} at ${bestSoilCat.score}/100 (+${bestSoilCat.contribution}/${bestSoilCat.weight} pts) on ${bestSoilCat.detail}.`,
    };
  }

  // 4. Best Crop for Rotation Compatibility
  const hasRotationEvalForAll = crops.every(
    (c) => getCategory(c, 'rotation')?.status === 'evaluated'
  );
  let rotation: ComparisonWinnerInsight;
  if (!hasRotationEvalForAll) {
    rotation = {
      status: 'insufficient',
      winnerCropId: null,
      winnerCropName: null,
      tiedCropNames: [],
      scoreLabel: null,
      explanation:
        'Available data is insufficient to identify a rotation winner because no active or prior crop history is recorded on this farm parcel.',
    };
  } else {
    const sortedRot = [...crops].sort((a, b) => {
      const aRot = getCategory(a, 'rotation')?.contribution ?? 0;
      const bRot = getCategory(b, 'rotation')?.contribution ?? 0;
      if (bRot !== aRot) return bRot - aRot;
      if (
        b.crop.rotationCompatibility.breakCropValue !==
        a.crop.rotationCompatibility.breakCropValue
      ) {
        return (
          b.crop.rotationCompatibility.breakCropValue -
          a.crop.rotationCompatibility.breakCropValue
        );
      }
      return b.overallScore - a.overallScore;
    });
    const bestRot = sortedRot[0];
    const bestRotCat = getCategory(bestRot, 'rotation')!;
    const tiedRot = sortedRot
      .filter((c) => (getCategory(c, 'rotation')?.contribution ?? 0) === bestRotCat.contribution)
      .map((c) => c.crop.name);
    const nEffect =
      bestRot.crop.nutrientRequirements.nitrogenDeltaKgHa >= 0
        ? `+${bestRot.crop.nutrientRequirements.nitrogenDeltaKgHa} kg/ha N credit`
        : `${bestRot.crop.nutrientRequirements.nitrogenDeltaKgHa} kg/ha N uptake`;
    rotation = {
      status: 'determined',
      winnerCropId: bestRot.crop.id,
      winnerCropName: bestRot.crop.name,
      tiedCropNames: tiedRot,
      scoreLabel: `${bestRotCat.score ?? 0}/100 rotation fit`,
      explanation: `${tiedRot.length > 1 ? `${tiedRot.join(' & ')} tie` : `${bestRot.crop.name} leads`} at ${bestRotCat.score}/100 (${bestRotCat.detail}; ${nEffect}, break value ${bestRot.crop.rotationCompatibility.breakCropValue}/100).`,
    };
  }

  return { overall, waterLimited, soil, rotation };
}

export function buildCropComparison(
  evaluations: CropSuitabilityEvaluation[],
  selectedCropIds: string[]
): CropComparisonSummary {
  const uniqueIds = Array.from(new Set(selectedCropIds));
  const truncatedFromCount = Math.max(0, uniqueIds.length - MAX_COMPARISON_CROPS);
  const limitedIds = uniqueIds.slice(0, MAX_COMPARISON_CROPS);

  const byId = new Map(evaluations.map((e) => [e.crop.id, e]));
  const crops = limitedIds
    .map((id) => byId.get(id))
    .filter((item): item is CropSuitabilityEvaluation => Boolean(item));

  const categoryDefs = [
    { id: 'climate', label: 'Climate' },
    { id: 'water', label: 'Water & Rain' },
    { id: 'soil', label: 'Soil & pH' },
    { id: 'season', label: 'Season' },
    { id: 'rotation', label: 'Rotation' },
  ] as const;

  const chartData = [
    {
      metric: 'Overall',
      ...Object.fromEntries(crops.map((c) => [c.crop.name, c.overallScore])),
    },
    ...categoryDefs.map((cat) => ({
      metric: cat.label,
      ...Object.fromEntries(
        crops.map((c) => {
          const found = c.categories.find((entry) => entry.id === cat.id);
          return [c.crop.name, found?.score ?? 0];
        })
      ),
    })),
  ];

  const recommendations = deriveComparisonRecommendations(crops);

  return {
    crops,
    chartData,
    truncatedFromCount,
    recommendations,
  };
}

export function knowledgeEntryToCropProfile(entry: CropKnowledgeEntry): CropProfile {
  return {
    id: entry.id,
    name: entry.name,
    scientificName: entry.scientificName,
    family: entry.family,
    category:
      entry.category === 'Pulse'
        ? 'Legume'
        : entry.category === 'Oilseed' || entry.category === 'Fiber & Cash Crop'
          ? 'Oilseed & Forage'
          : entry.category,
    nitrogenRole: entry.nutrientRequirements.nitrogenRole,
    nitrogenDeltaKgHa: entry.nutrientRequirements.nitrogenDeltaKgHa,
    rootDepth: entry.rootDepth,
    waterNeedMm: Math.round((entry.waterNeedMm[0] + entry.waterNeedMm[1]) / 2),
    optimalTempC: entry.idealTempC,
    preferredSoils: entry.suitableSoilTypes,
    daysToMaturity: Math.round(
      (entry.growingDurationDays[0] + entry.growingDurationDays[1]) / 2
    ),
    pestBreakValue: entry.rotationCompatibility.breakCropValue,
    summary: entry.summary,
    bestPrecededBy: entry.rotationCompatibility.bestPrecededBy,
    avoidAfter: entry.rotationCompatibility.avoidAfter,
  };
}
