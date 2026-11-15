import type {
  BestSupportedRecommendation,
  DecisionCategoryBreakdown,
  DecisionCategoryId,
  DecisionSensitivityResult,
  DecisionSensitivityScenarioDiff,
  DecisionWeights,
  EvaluatedScenarioDecision,
  Farm,
  FarmDecisionPreferences,
  MultiScenarioDecisionReport,
  NasaPowerClimateDataset,
  NormalizedDecisionWeights,
  SavedClimateScenario,
  ScenarioRiskLevel,
  ScenarioSimulationResult,
} from '../types/rotatewise.ts';
import {
  createBaselineConfigForFarm,
  MAX_COMPARISON_SCENARIOS,
  simulateClimateScenario,
} from './scenarioSimulationEngine.ts';

export const DEFAULT_DECISION_WEIGHTS: DecisionWeights = {
  climate: 30,
  water: 30,
  soil: 20,
  rotation: 20,
};

export const DECISION_CATEGORY_ORDER: DecisionCategoryId[] = [
  'climate',
  'water',
  'soil',
  'rotation',
];

export const DECISION_CATEGORY_LABELS: Record<DecisionCategoryId, string> = {
  climate: 'Climate Suitability',
  water: 'Water Availability',
  soil: 'Soil Compatibility',
  rotation: 'Rotation Compatibility',
};

export const DECISION_CATEGORY_DESCRIPTIONS: Record<DecisionCategoryId, string> = {
  climate:
    'Thermal envelope alignment, heat/frost stress avoidance, and solar radiation fit from NASA POWER.',
  water:
    'Effective water delivery (adjusted rainfall + irrigation mode + rainwater capture) vs. seasonal crop demand.',
  soil:
    'Parcel soil texture match and pH tolerance against crop agronomic thresholds.',
  rotation:
    'Botanical family diversity, prior-crop break value, and pest/disease carryover risk.',
};

export const TIE_SCORE_THRESHOLD_PTS = 1.0;
export const BASELINE_REFERENCE_ID = '__baseline_reference__';
export const DECISION_PREFS_STORAGE_KEY = 'rotatewise_decision_prefs_v1';

const RISK_ORDER: Record<ScenarioRiskLevel, number> = {
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

function sanitizeWeight(val: unknown): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return 0;
  return clamp(round1(num), 0, 100);
}

export function normalizeDecisionWeights(
  rawInput: Partial<DecisionWeights> | DecisionWeights
): NormalizedDecisionWeights {
  const raw: DecisionWeights = {
    climate: sanitizeWeight(rawInput.climate),
    water: sanitizeWeight(rawInput.water),
    soil: sanitizeWeight(rawInput.soil),
    rotation: sanitizeWeight(rawInput.rotation),
  };

  const totalRaw = round1(raw.climate + raw.water + raw.soil + raw.rotation);
  if (totalRaw <= 0) {
    return {
      raw,
      effectivePct: { climate: 0, water: 0, soil: 0, rotation: 0 },
      totalRaw: 0,
      allWeightsZero: true,
      isDefault: false,
    };
  }

  // Largest-remainder rounding to 0.1% precision so effective percentages always sum to 100.0
  const exactTenths = DECISION_CATEGORY_ORDER.map((id) => {
    const exact = (raw[id] / totalRaw) * 1000;
    const floored = Math.floor(exact);
    return {
      id,
      floored,
      remainder: exact - floored,
    };
  });

  const sumFloored = exactTenths.reduce((acc, item) => acc + item.floored, 0);
  const remainingTenths = 1000 - sumFloored;

  const sortedForRemainder = [...exactTenths].sort(
    (a, b) => b.remainder - a.remainder
  );
  for (let i = 0; i < remainingTenths; i++) {
    sortedForRemainder[i % sortedForRemainder.length].floored += 1;
  }

  const effectivePct: DecisionWeights = {
    climate: 0,
    water: 0,
    soil: 0,
    rotation: 0,
  };
  for (const item of exactTenths) {
    effectivePct[item.id] = item.floored / 10;
  }

  const isDefault =
    Math.abs(effectivePct.climate - DEFAULT_DECISION_WEIGHTS.climate) < 0.15 &&
    Math.abs(effectivePct.water - DEFAULT_DECISION_WEIGHTS.water) < 0.15 &&
    Math.abs(effectivePct.soil - DEFAULT_DECISION_WEIGHTS.soil) < 0.15 &&
    Math.abs(effectivePct.rotation - DEFAULT_DECISION_WEIGHTS.rotation) < 0.15;

  return {
    raw,
    effectivePct,
    totalRaw,
    allWeightsZero: false,
    isDefault,
  };
}

export function calculateScenarioDecisionScore(params: {
  id: string;
  label: string;
  isBaselineReference: boolean;
  simulationResult: ScenarioSimulationResult;
  normalizedWeights: NormalizedDecisionWeights;
}): EvaluatedScenarioDecision {
  const {
    id,
    label,
    isBaselineReference,
    simulationResult,
    normalizedWeights,
  } = params;

  const simEval = simulationResult.primarySimulatedEval;
  const rainfallStress =
    simulationResult.risks.find((r) => r.id === 'rainfall_stress')?.level ??
    null;
  const heatStress =
    simulationResult.risks.find((r) => r.id === 'heat_stress')?.level ?? null;

  if (
    simulationResult.status !== 'ready' ||
    !simEval ||
    normalizedWeights.allWeightsZero
  ) {
    const unavailableBreakdowns: DecisionCategoryBreakdown[] =
      DECISION_CATEGORY_ORDER.map((catId) => ({
        id: catId,
        label: DECISION_CATEGORY_LABELS[catId],
        rawScore: null,
        status: 'unavailable',
        effectiveWeightPct: normalizedWeights.effectivePct[catId],
        contribution: 0,
        detail:
          simulationResult.limitationReason ??
          'Required baseline climate or weight inputs are unavailable.',
      }));

    return {
      id,
      label,
      isBaselineReference,
      rank: null,
      status: 'insufficient_data',
      weightedScore: null,
      evaluatedWeightPct: 0,
      missingWeightPct: normalizedWeights.allWeightsZero ? 0 : 100,
      unavailableCategories: [...DECISION_CATEGORY_ORDER],
      partialCategories: [],
      categoryBreakdowns: unavailableBreakdowns,
      overallCropSuitability: simEval?.overallScore ?? null,
      seasonalSuitabilityScore: null,
      effectiveAvailableWaterMm:
        simulationResult.simulatedClimate?.effectiveAvailableWaterMm ?? null,
      effectiveIrrigation:
        simulationResult.simulatedClimate?.effectiveIrrigation ?? null,
      rainfallStressLevel: rainfallStress,
      heatStressLevel: heatStress,
      overallRiskLevel:
        simulationResult.status === 'ready'
          ? simulationResult.highestRiskLevel
          : null,
      confidenceLevel: simEval?.confidenceLevel ?? 'Low',
      dataCompletenessPct: simEval?.dataCompletenessPct ?? 0,
      cropName: simEval?.crop.name ?? simulationResult.config.primaryCropId,
      rotationStatus: 'unknown',
      primaryEvaluatedResult: simulationResult,
    };
  }

  const unavailableCategories: DecisionCategoryId[] = [];
  const partialCategories: DecisionCategoryId[] = [];
  let evaluatedWeightPct = 0;
  let missingWeightPct = 0;
  let contributionSum = 0;

  const categoryBreakdowns: DecisionCategoryBreakdown[] =
    DECISION_CATEGORY_ORDER.map((catId) => {
      const cat = simEval.categories.find((c) => c.id === catId);
      const effectiveWeight = normalizedWeights.effectivePct[catId];

      if (!cat || cat.status === 'unavailable' || cat.score === null) {
        unavailableCategories.push(catId);
        if (effectiveWeight > 0) {
          missingWeightPct = round1(missingWeightPct + effectiveWeight);
        }
        return {
          id: catId,
          label: DECISION_CATEGORY_LABELS[catId],
          rawScore: null,
          status: 'unavailable',
          effectiveWeightPct: effectiveWeight,
          contribution: 0,
          detail:
            cat?.detail ??
            `${DECISION_CATEGORY_LABELS[catId]} data is unavailable; not counted as a perfect score.`,
        };
      }

      if (cat.status === 'partial') {
        partialCategories.push(catId);
      }

      const contribution = round1((cat.score * effectiveWeight) / 100);
      evaluatedWeightPct = round1(evaluatedWeightPct + effectiveWeight);
      contributionSum += (cat.score * effectiveWeight) / 100;

      return {
        id: catId,
        label: DECISION_CATEGORY_LABELS[catId],
        rawScore: cat.score,
        status: cat.status,
        effectiveWeightPct: effectiveWeight,
        contribution,
        detail: cat.detail,
      };
    });

  const allActiveCategoriesMissing = evaluatedWeightPct <= 0;
  const weightedScore = allActiveCategoriesMissing ? null : round1(contributionSum);

  const seasonCat = simEval.categories.find((c) => c.id === 'season');
  const primaryDelta = simulationResult.allCropDeltas.find(
    (d) => d.cropId === simulationResult.config.primaryCropId
  );

  const rotationBreakdown = categoryBreakdowns.find((b) => b.id === 'rotation');
  const rotationStatus: 'clean' | 'conflict' | 'unknown' =
    rotationBreakdown?.status === 'unavailable'
      ? 'unknown'
      : primaryDelta?.rotationStatus ?? 'clean';

  return {
    id,
    label,
    isBaselineReference,
    rank: null,
    status: allActiveCategoriesMissing ? 'insufficient_data' : 'evaluated',
    weightedScore,
    evaluatedWeightPct,
    missingWeightPct,
    unavailableCategories,
    partialCategories,
    categoryBreakdowns,
    overallCropSuitability: simEval.overallScore,
    seasonalSuitabilityScore:
      seasonCat && seasonCat.status !== 'unavailable' ? seasonCat.score : null,
    effectiveAvailableWaterMm:
      simulationResult.simulatedClimate?.effectiveAvailableWaterMm ?? null,
    effectiveIrrigation:
      simulationResult.simulatedClimate?.effectiveIrrigation ?? null,
    rainfallStressLevel: rainfallStress,
    heatStressLevel: heatStress,
    overallRiskLevel: simulationResult.highestRiskLevel,
    confidenceLevel: simEval.confidenceLevel,
    dataCompletenessPct: simEval.dataCompletenessPct,
    cropName: simEval.crop.name,
    rotationStatus,
    primaryEvaluatedResult: simulationResult,
  };
}

function buildRecommendation(params: {
  rankedSaved: EvaluatedScenarioDecision[];
  baselineReference: EvaluatedScenarioDecision | null;
  normalizedWeights: NormalizedDecisionWeights;
  missingClimateReason: string | null;
}): BestSupportedRecommendation {
  const {
    rankedSaved,
    baselineReference,
    normalizedWeights,
    missingClimateReason,
  } = params;

  if (normalizedWeights.allWeightsZero) {
    return {
      status: 'insufficient_data',
      headline: 'All Decision Weights Are Set to 0%',
      winnerIds: [],
      winnerNames: [],
      topScore: null,
      marginPts: null,
      whyRankedFirst: [
        'At least one decision category (Climate, Water, Soil, or Rotation) must have a weight above 0% to rank scenarios.',
      ],
      topContributingCategories: [],
      underperformingCategories: [],
      remainingRisks: [],
      confidenceAssessment:
        'Adjust any priority weight above 0% or restore default weights (30% / 30% / 20% / 20%).',
      hasSufficientConfidence: false,
    };
  }

  if (missingClimateReason) {
    return {
      status: 'insufficient_data',
      headline: 'Insufficient Climate Baseline Data to Recommend a Scenario',
      winnerIds: [],
      winnerNames: [],
      topScore: null,
      marginPts: null,
      whyRankedFirst: [missingClimateReason],
      topContributingCategories: [],
      underperformingCategories: [],
      remainingRisks: [],
      confidenceAssessment:
        'Low confidence — real historical NASA POWER observations are required before scoring scenarios.',
      hasSufficientConfidence: false,
    };
  }

  const evaluated = rankedSaved.filter(
    (s) => s.status === 'evaluated' && s.weightedScore !== null
  );

  if (evaluated.length === 0) {
    return {
      status: 'insufficient_data',
      headline: 'Select Saved Scenarios to Evaluate',
      winnerIds: [],
      winnerNames: [],
      topScore: null,
      marginPts: null,
      whyRankedFirst: [
        'Select one to three saved scenarios for comparison to generate a weighted decision recommendation.',
      ],
      topContributingCategories: [],
      underperformingCategories: [],
      remainingRisks: [],
      confidenceAssessment: 'No evaluated scenarios selected.',
      hasSufficientConfidence: false,
    };
  }

  const top = evaluated[0];
  const hasSufficientConfidence =
    top.confidenceLevel !== 'Low' &&
    top.dataCompletenessPct >= 60 &&
    top.missingWeightPct <= 25;

  if (!hasSufficientConfidence) {
    const missingNames = top.unavailableCategories
      .map((id) => DECISION_CATEGORY_LABELS[id])
      .join(', ');
    return {
      status: 'insufficient_data',
      headline: 'Insufficient Data Confidence for a Defensible Winner',
      winnerIds: [],
      winnerNames: [],
      topScore: top.weightedScore,
      marginPts: null,
      whyRankedFirst: [
        `${top.label} scored highest numerically (${top.weightedScore}/100), but data completeness is ${top.dataCompletenessPct}% (${top.confidenceLevel} confidence) with ${top.missingWeightPct}% of your selected weight unevaluated${missingNames ? ` (${missingNames})` : ''}.`,
        'Rather than forcing a winner on incomplete evidence, complete the missing farm soil, crop history, or climate inputs first.',
      ],
      topContributingCategories: [...top.categoryBreakdowns]
        .filter((b) => b.rawScore !== null && b.effectiveWeightPct > 0)
        .sort((a, b) => b.contribution - a.contribution),
      underperformingCategories: top.categoryBreakdowns.filter(
        (b) => b.rawScore === null || b.rawScore < 65
      ),
      remainingRisks: top.primaryEvaluatedResult.risks.filter(
        (r) => r.level === 'Critical' || r.level === 'High' || r.level === 'Moderate'
      ),
      confidenceAssessment: `Insufficient confidence (${top.confidenceLevel} · ${top.dataCompletenessPct}% completeness · ${top.missingWeightPct}% unevaluated weight).`,
      hasSufficientConfidence: false,
    };
  }

  // Check for effectively tied scenarios within TIE_SCORE_THRESHOLD_PTS
  const tiedTop = evaluated.filter(
    (s) => Math.abs((top.weightedScore ?? 0) - (s.weightedScore ?? 0)) <= TIE_SCORE_THRESHOLD_PTS
  );

  if (evaluated.length >= 2 && tiedTop.length >= 2) {
    const second = tiedTop[1];
    const spread = round1((top.weightedScore ?? 0) - (second.weightedScore ?? 0));
    return {
      status: 'tie',
      headline: `Effectively Tied Between ${tiedTop.map((s) => s.label).join(' & ')}`,
      winnerIds: tiedTop.map((s) => s.id),
      winnerNames: tiedTop.map((s) => s.label),
      topScore: top.weightedScore,
      marginPts: spread,
      whyRankedFirst: [
        `The top ${tiedTop.length} scenarios are within ${spread.toFixed(1)} pts (≤ ${TIE_SCORE_THRESHOLD_PTS.toFixed(1)} pt equivalence threshold) under your current weights (${normalizedWeights.effectivePct.climate}% Climate, ${normalizedWeights.effectivePct.water}% Water, ${normalizedWeights.effectivePct.soil}% Soil, ${normalizedWeights.effectivePct.rotation}% Rotation).`,
        ...tiedTop.map(
          (s) =>
            `${s.label}: ${s.weightedScore}/100 weighted (${s.overallCropSuitability}/100 suitability · ${s.overallRiskLevel} peak risk).`
        ),
        'Adjust decision weights toward your highest field constraint or compare peak risk levels below to break the tie.',
      ],
      topContributingCategories: [...top.categoryBreakdowns]
        .filter((b) => b.rawScore !== null && b.effectiveWeightPct > 0)
        .sort((a, b) => b.contribution - a.contribution),
      underperformingCategories: top.categoryBreakdowns.filter(
        (b) =>
          b.effectiveWeightPct > 0 && (b.rawScore === null || b.rawScore < 65)
      ),
      remainingRisks: top.primaryEvaluatedResult.risks.filter(
        (r) => r.level === 'Critical' || r.level === 'High' || r.level === 'Moderate'
      ),
      confidenceAssessment: `Sufficient data confidence (${top.confidenceLevel} · ${top.dataCompletenessPct}% data completeness).`,
      hasSufficientConfidence: true,
    };
  }

  const runnerUp = evaluated[1] ?? null;
  const marginPts =
    runnerUp && top.weightedScore !== null && runnerUp.weightedScore !== null
      ? round1(top.weightedScore - runnerUp.weightedScore)
      : null;

  const sortedContrib = [...top.categoryBreakdowns]
    .filter((b) => b.effectiveWeightPct > 0 && b.rawScore !== null)
    .sort((a, b) => b.contribution - a.contribution);

  const underperforming = top.categoryBreakdowns.filter(
    (b) =>
      b.status === 'unavailable' ||
      (b.effectiveWeightPct > 0 && (b.rawScore ?? 0) < 65)
  );

  const remainingRisks = top.primaryEvaluatedResult.risks
    .filter(
      (r) =>
        r.level === 'Critical' || r.level === 'High' || r.level === 'Moderate'
    )
    .sort((a, b) => RISK_ORDER[b.level] - RISK_ORDER[a.level]);

  const whyRankedFirst: string[] = [];
  if (runnerUp && marginPts !== null) {
    whyRankedFirst.push(
      `${top.label} leads ${runnerUp.label} by +${marginPts.toFixed(1)} weighted points (${top.weightedScore}/100 vs. ${runnerUp.weightedScore}/100) under your active weights.`
    );
  } else {
    whyRankedFirst.push(
      `${top.label} achieves a weighted decision score of ${top.weightedScore}/100 across ${top.evaluatedWeightPct}% evaluated category weight.`
    );
  }

  if (
    baselineReference &&
    baselineReference.weightedScore !== null &&
    top.weightedScore !== null
  ) {
    const baseDelta = round1(top.weightedScore - baselineReference.weightedScore);
    whyRankedFirst.push(
      baseDelta >= 0
        ? `Outperforms the historical baseline reference (${baselineReference.weightedScore}/100) by +${baseDelta.toFixed(1)} weighted points.`
        : `Trails the historical baseline reference (${baselineReference.weightedScore}/100) by ${baseDelta.toFixed(1)} weighted points under simulated stress.`
    );
  }

  if (sortedContrib[0]) {
    whyRankedFirst.push(
      `Primary score driver: ${sortedContrib[0].label} contributed ${sortedContrib[0].contribution.toFixed(1)} pts (${sortedContrib[0].rawScore}/100 × ${sortedContrib[0].effectiveWeightPct}% weight).`
    );
  }

  if (top.missingWeightPct > 0) {
    const missingLabels = top.unavailableCategories
      .map((c) => DECISION_CATEGORY_LABELS[c])
      .join(', ');
    whyRankedFirst.push(
      `Note: ${missingLabels} unavailable (${top.missingWeightPct}% weight left unevaluated, not credited as 100%).`
    );
  }

  return {
    status: 'winner',
    headline: `Best-Supported Scenario: ${top.label}`,
    winnerIds: [top.id],
    winnerNames: [top.label],
    topScore: top.weightedScore,
    marginPts,
    whyRankedFirst,
    topContributingCategories: sortedContrib,
    underperformingCategories: underperforming,
    remainingRisks,
    confidenceAssessment: `Sufficient confidence (${top.confidenceLevel} · ${top.dataCompletenessPct}% data completeness${top.partialCategories.length > 0 ? ` · partial ${top.partialCategories.join(', ')}` : ''}).`,
    hasSufficientConfidence: true,
  };
}

export function evaluateMultiScenarioDecision(params: {
  farm: Farm | null;
  nasaData: NasaPowerClimateDataset | null;
  scenarios: SavedClimateScenario[];
  selectedScenarioIds: string[];
  weights: Partial<DecisionWeights> | DecisionWeights;
  includeBaselineReference?: boolean;
}): MultiScenarioDecisionReport {
  const {
    farm,
    nasaData,
    scenarios,
    selectedScenarioIds,
    weights,
    includeBaselineReference = true,
  } = params;

  const normalizedWeights = normalizeDecisionWeights(weights);
  const uniqueIds = Array.from(new Set(selectedScenarioIds));
  const truncatedFromCount = Math.max(
    0,
    uniqueIds.length - MAX_COMPARISON_SCENARIOS
  );
  const limitedIds = uniqueIds.slice(0, MAX_COMPARISON_SCENARIOS);
  const byId = new Map(scenarios.map((s) => [s.id, s]));

  const selectedScenarios = limitedIds
    .map((id) => byId.get(id))
    .filter((s): s is SavedClimateScenario => Boolean(s));

  const evaluatedSavedRaw: EvaluatedScenarioDecision[] = selectedScenarios.map(
    (scenario) => {
      const simResult = simulateClimateScenario(farm, nasaData, scenario.config);
      return calculateScenarioDecisionScore({
        id: scenario.id,
        label: scenario.name,
        isBaselineReference: false,
        simulationResult: simResult,
        normalizedWeights,
      });
    }
  );

  // Rank evaluated saved scenarios deterministically
  const rankedSavedScenarios = [...evaluatedSavedRaw].sort((a, b) => {
    if (a.weightedScore === null && b.weightedScore === null) return 0;
    if (a.weightedScore === null) return 1;
    if (b.weightedScore === null) return -1;
    if (Math.abs(b.weightedScore - a.weightedScore) > 0.05) {
      return b.weightedScore - a.weightedScore;
    }
    const riskA = a.overallRiskLevel ? RISK_ORDER[a.overallRiskLevel] : 99;
    const riskB = b.overallRiskLevel ? RISK_ORDER[b.overallRiskLevel] : 99;
    if (riskA !== riskB) return riskA - riskB;
    return (b.overallCropSuitability ?? 0) - (a.overallCropSuitability ?? 0);
  });

  let nextRank = 1;
  for (const item of rankedSavedScenarios) {
    if (item.status === 'evaluated' && item.weightedScore !== null) {
      item.rank = nextRank++;
    } else {
      item.rank = null;
    }
  }

  let baselineReference: EvaluatedScenarioDecision | null = null;
  if (includeBaselineReference) {
    const referenceCropId =
      selectedScenarios[0]?.config.primaryCropId ??
      createBaselineConfigForFarm(farm).primaryCropId;
    const baselineConfig = {
      ...createBaselineConfigForFarm(farm),
      primaryCropId: referenceCropId,
      rainfallDeltaPct: 0,
      temperatureShiftC: 0,
      irrigationMode: 'current' as const,
    };
    const baselineSim = simulateClimateScenario(farm, nasaData, baselineConfig);
    baselineReference = calculateScenarioDecisionScore({
      id: BASELINE_REFERENCE_ID,
      label: 'Historical Baseline Reference',
      isBaselineReference: true,
      simulationResult: baselineSim,
      normalizedWeights,
    });
  }

  const missingClimateCandidate =
    evaluatedSavedRaw.find(
      (s) => s.primaryEvaluatedResult.status === 'missing_baseline_climate'
    ) ??
    (baselineReference?.primaryEvaluatedResult.status === 'missing_baseline_climate'
      ? baselineReference
      : null);

  const missingClimateReason =
    !farm
      ? 'No active farm parcel is selected.'
      : missingClimateCandidate?.primaryEvaluatedResult.limitationReason ?? null;

  const recommendation = buildRecommendation({
    rankedSaved: rankedSavedScenarios,
    baselineReference,
    normalizedWeights,
    missingClimateReason,
  });

  const candidates = baselineReference
    ? [...rankedSavedScenarios, baselineReference]
    : rankedSavedScenarios;

  const evaluatedAtStatus: MultiScenarioDecisionReport['evaluatedAtStatus'] =
    normalizedWeights.allWeightsZero
      ? 'zero_weights'
      : missingClimateReason || recommendation.status === 'insufficient_data'
        ? 'insufficient_data'
        : 'ready';

  return {
    farmId: farm?.id ?? null,
    evaluatedAtStatus,
    limitationReason:
      normalizedWeights.allWeightsZero
        ? 'All four decision weights are 0%. Adjust at least one priority weight above 0%.'
        : missingClimateReason,
    normalizedWeights,
    candidates,
    rankedSavedScenarios,
    baselineReference,
    recommendation,
    truncatedFromCount,
  };
}

export function analyzeDecisionSensitivity(params: {
  farm: Farm | null;
  nasaData: NasaPowerClimateDataset | null;
  scenarios: SavedClimateScenario[];
  selectedScenarioIds: string[];
  previousWeights: Partial<DecisionWeights> | DecisionWeights;
  currentWeights: Partial<DecisionWeights> | DecisionWeights;
}): DecisionSensitivityResult {
  const {
    farm,
    nasaData,
    scenarios,
    selectedScenarioIds,
    previousWeights,
    currentWeights,
  } = params;

  const prevReport = evaluateMultiScenarioDecision({
    farm,
    nasaData,
    scenarios,
    selectedScenarioIds,
    weights: previousWeights,
    includeBaselineReference: false,
  });

  const currReport = evaluateMultiScenarioDecision({
    farm,
    nasaData,
    scenarios,
    selectedScenarioIds,
    weights: currentWeights,
    includeBaselineReference: false,
  });

  const weightDeltas = DECISION_CATEGORY_ORDER.map((id) => {
    const previousPct = prevReport.normalizedWeights.effectivePct[id];
    const currentPct = currReport.normalizedWeights.effectivePct[id];
    return {
      id,
      label: DECISION_CATEGORY_LABELS[id],
      previousPct,
      currentPct,
      deltaPct: round1(currentPct - previousPct),
    };
  });

  const hasWeightChanges = weightDeltas.some((d) => Math.abs(d.deltaPct) >= 0.1);

  const prevById = new Map(
    prevReport.rankedSavedScenarios.map((s) => [s.id, s])
  );

  const scenarioDiffs: DecisionSensitivityScenarioDiff[] =
    currReport.rankedSavedScenarios.map((curr) => {
      const prev = prevById.get(curr.id);
      const previousRank = prev?.rank ?? null;
      const currentRank = curr.rank;
      const rankDelta =
        previousRank !== null && currentRank !== null
          ? previousRank - currentRank
          : null;
      const previousScore = prev?.weightedScore ?? null;
      const currentScore = curr.weightedScore;
      const scoreDelta =
        previousScore !== null && currentScore !== null
          ? round1(currentScore - previousScore)
          : null;

      const responsibleCategories = DECISION_CATEGORY_ORDER.map((catId) => {
        const prevCat = prev?.categoryBreakdowns.find((b) => b.id === catId);
        const currCat = curr.categoryBreakdowns.find((b) => b.id === catId);
        const wDelta =
          weightDeltas.find((w) => w.id === catId)?.deltaPct ?? 0;
        const contributionDelta = round1(
          (currCat?.contribution ?? 0) - (prevCat?.contribution ?? 0)
        );
        return {
          id: catId,
          label: DECISION_CATEGORY_LABELS[catId],
          weightDeltaPct: wDelta,
          contributionDelta,
        };
      })
        .filter(
          (c) =>
            Math.abs(c.weightDeltaPct) >= 0.1 ||
            Math.abs(c.contributionDelta) >= 0.1
        )
        .sort(
          (a, b) =>
            Math.abs(b.contributionDelta) - Math.abs(a.contributionDelta)
        );

      return {
        id: curr.id,
        label: curr.label,
        previousRank,
        currentRank,
        rankDelta,
        previousScore,
        currentScore,
        scoreDelta,
        responsibleCategories,
      };
    });

  const rankingChanged = scenarioDiffs.some(
    (d) => d.rankDelta !== null && d.rankDelta !== 0
  );

  let summary =
    'Decision weights match the reference profile (no ranking sensitivity shift).';
  if (hasWeightChanges) {
    const biggestShift = [...weightDeltas].sort(
      (a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)
    )[0];
    if (rankingChanged) {
      const topMover =
        scenarioDiffs.find((d) => (d.rankDelta ?? 0) > 0) ?? scenarioDiffs[0];
      summary = `Decision-preference shift only (not a climate change): adjusting ${biggestShift.label} (${biggestShift.deltaPct >= 0 ? `+${biggestShift.deltaPct}` : biggestShift.deltaPct}%) moved ${topMover?.label ?? 'top scenario'} from Rank #${topMover?.previousRank ?? '?'} to #${topMover?.currentRank ?? '?'}.`;
    } else {
      summary = `Decision-preference shift only (not a climate change): adjusting ${biggestShift.label} (${biggestShift.deltaPct >= 0 ? `+${biggestShift.deltaPct}` : biggestShift.deltaPct}%) updated weighted scores without changing relative scenario ranks.`;
    }
  }

  return {
    hasWeightChanges,
    rankingChanged,
    previousWeights: prevReport.normalizedWeights,
    currentWeights: currReport.normalizedWeights,
    weightDeltas,
    scenarioDiffs,
    summary,
  };
}

// Per-farm preference persistence helpers
export function createDefaultFarmDecisionPreferences(
  farm: Farm,
  farmScenarios: SavedClimateScenario[],
  baselineInfo?: {
    preset?: FarmDecisionPreferences['lastBaselinePreset'];
    startDate?: string;
    endDate?: string;
  }
): FarmDecisionPreferences {
  return {
    farmId: farm.id,
    selectedScenarioIds: farmScenarios
      .slice(0, 2)
      .map((s) => s.id),
    weights: { ...DEFAULT_DECISION_WEIGHTS },
    includeBaselineReference: true,
    lastBaselinePreset: baselineInfo?.preset ?? '30d',
    lastBaselineStartDate: baselineInfo?.startDate,
    lastBaselineEndDate: baselineInfo?.endDate,
    updatedAt: new Date().toISOString(),
  };
}

export function loadDecisionPreferencesForFarm(
  allPrefs: Record<string, FarmDecisionPreferences>,
  farm: Farm | null,
  farmScenarios: SavedClimateScenario[]
): FarmDecisionPreferences | null {
  if (!farm) return null;
  const existing = allPrefs[farm.id];
  if (!existing) {
    return createDefaultFarmDecisionPreferences(farm, farmScenarios);
  }
  const validIds = new Set(farmScenarios.map((s) => s.id));
  const filteredSelected = existing.selectedScenarioIds
    .filter((id) => validIds.has(id))
    .slice(0, MAX_COMPARISON_SCENARIOS);

  return {
    ...existing,
    selectedScenarioIds: filteredSelected,
    weights: {
      climate: sanitizeWeight(existing.weights?.climate ?? DEFAULT_DECISION_WEIGHTS.climate),
      water: sanitizeWeight(existing.weights?.water ?? DEFAULT_DECISION_WEIGHTS.water),
      soil: sanitizeWeight(existing.weights?.soil ?? DEFAULT_DECISION_WEIGHTS.soil),
      rotation: sanitizeWeight(existing.weights?.rotation ?? DEFAULT_DECISION_WEIGHTS.rotation),
    },
    includeBaselineReference: existing.includeBaselineReference ?? true,
    lastBaselinePreset: existing.lastBaselinePreset ?? '30d',
  };
}

export function saveDecisionPreferencesForFarm(
  allPrefs: Record<string, FarmDecisionPreferences>,
  nextPref: FarmDecisionPreferences
): Record<string, FarmDecisionPreferences> {
  return {
    ...allPrefs,
    [nextPref.farmId]: {
      ...nextPref,
      selectedScenarioIds: Array.from(
        new Set(nextPref.selectedScenarioIds)
      ).slice(0, MAX_COMPARISON_SCENARIOS),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function resetDecisionPreferencesForFarm(
  allPrefs: Record<string, FarmDecisionPreferences>,
  farm: Farm,
  farmScenarios: SavedClimateScenario[]
): Record<string, FarmDecisionPreferences> {
  const fresh = createDefaultFarmDecisionPreferences(farm, farmScenarios);
  return {
    ...allPrefs,
    [farm.id]: fresh,
  };
}
