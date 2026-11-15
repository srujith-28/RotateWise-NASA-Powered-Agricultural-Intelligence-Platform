import { CROP_KNOWLEDGE_DATABASE } from '../data/cropKnowledgeDb.ts';
import { DEMO_CROPS } from '../data/demoData.ts';
import type {
  ConfidenceLevel,
  CropKnowledgeEntry,
  CropProfile,
  Farm,
  GrowingSeasonTag,
  IrrigationDependency,
  NasaPowerClimateDataset,
  NitrogenRole,
  RootDepth,
  RotationAlternativeSuggestion,
  RotationCategoryScore,
  RotationConflictWarning,
  RotationPeriodMode,
  RotationPlanComparisonEntry,
  RotationPlanComparisonSummary,
  RotationPlanEvaluation,
  RotationSeasonSystem,
  RotationStep,
  RotationStepEvaluation,
  SavedRotationPlan,
  SoilType,
} from '../types/rotatewise.ts';
import {
  evaluateCropSuitability,
  normalizeCropReferenceId,
  resolveCropFamily,
} from './cropSuitabilityEngine.ts';

export const MAX_COMPARISON_PLANS = 3;

export interface ResolvedRotationCropMeta {
  id: string;
  normalizedId: string | null;
  name: string;
  family: string;
  rootDepth: RootDepth | 'Unknown';
  growingDurationDays: [number, number] | null;
  waterNeedMm: [number, number] | null;
  irrigationDependency: IrrigationDependency | 'Cover / Low';
  nitrogenRole: NitrogenRole;
  nitrogenDeltaKgHa: number;
  bestPrecededBy: string[];
  avoidAfter: string[];
  breakCropValue: number;
  residueBenefit: string;
  preferredSeasons: GrowingSeasonTag[];
  suitableSoilTypes: SoilType[];
  secondarySoilTypes: SoilType[];
  soilPhRange: [number, number] | null;
  commonDiseases: string[];
  pestPressures: string[];
  knowledgeEntry: CropKnowledgeEntry | null;
}

const KNOWLEDGE_BY_ID = new Map(CROP_KNOWLEDGE_DATABASE.map((c) => [c.id, c]));
const DEMO_BY_ID = new Map(DEMO_CROPS.map((c) => [c.id, c]));

const COVER_OR_LEGACY_SEASONS: Record<string, GrowingSeasonTag[]> = {
  crimson_clover: ['Rabi (Cool / Winter)', 'Autumn–Spring (Overwintering)'],
  alfalfa: ['Spring–Summer (Temperate)', 'Zaid (Warm Dry / Spring)'],
  oilseed_radish: ['Rabi (Cool / Winter)', 'Autumn–Spring (Overwintering)'],
  oats: ['Spring–Summer (Temperate)', 'Autumn–Spring (Overwintering)'],
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getAllCandidateIds(id: string): string[] {
  const norm = normalizeCropReferenceId(id);
  const out = new Set<string>([id.toLowerCase()]);
  if (norm) out.add(norm);
  if (id === 'maize') out.add('corn');
  if (id === 'soybean') out.add('soybeans');
  if (id === 'wheat') out.add('winter_wheat');
  return Array.from(out);
}

function listMatchesCrop(list: string[], candidateCropId: string): boolean {
  const candidates = getAllCandidateIds(candidateCropId);
  return list.some((entry) => {
    const entryNorm = normalizeCropReferenceId(entry) ?? entry.toLowerCase();
    return candidates.includes(entry.toLowerCase()) || candidates.includes(entryNorm);
  });
}

export function resolveRotationCropMeta(
  cropId: string,
  fallbackName?: string,
  fallbackFamily?: string,
  fallbackNitrogenDelta?: number
): ResolvedRotationCropMeta {
  const normalizedId = normalizeCropReferenceId(cropId);
  const knowledge =
    (normalizedId ? KNOWLEDGE_BY_ID.get(normalizedId) : undefined) ??
    KNOWLEDGE_BY_ID.get(cropId.toLowerCase()) ??
    null;

  const demoCrop =
    DEMO_BY_ID.get(cropId) ??
    (normalizedId ? DEMO_BY_ID.get(normalizedId) : undefined) ??
    null;

  if (knowledge) {
    // Expand legume / brassica cross-compatibility to cover crops in DEMO_CROPS
    const extraAvoid =
      knowledge.family === 'Fabaceae (Legume)'
        ? ['alfalfa', 'crimson_clover']
        : knowledge.family === 'Brassicaceae (Brassica)'
          ? ['oilseed_radish']
          : knowledge.family === 'Poaceae (Grass)'
            ? ['oats']
            : [];
    const extraBest =
      knowledge.category === 'Cereal'
        ? ['alfalfa', 'crimson_clover', 'oilseed_radish']
        : knowledge.family === 'Fabaceae (Legume)'
          ? ['oats']
          : [];

    return {
      id: cropId,
      normalizedId: knowledge.id,
      name: demoCrop && cropId === 'winter_wheat' ? demoCrop.name : knowledge.name,
      family: knowledge.family,
      rootDepth: knowledge.rootDepth,
      growingDurationDays:
        cropId === 'winter_wheat' && demoCrop
          ? [demoCrop.daysToMaturity - 15, demoCrop.daysToMaturity + 15]
          : knowledge.growingDurationDays,
      waterNeedMm: knowledge.waterNeedMm,
      irrigationDependency: knowledge.irrigationDependency,
      nitrogenRole: knowledge.nutrientRequirements.nitrogenRole,
      nitrogenDeltaKgHa: knowledge.nutrientRequirements.nitrogenDeltaKgHa,
      bestPrecededBy: Array.from(
        new Set([...knowledge.rotationCompatibility.bestPrecededBy, ...extraBest])
      ),
      avoidAfter: Array.from(
        new Set([...knowledge.rotationCompatibility.avoidAfter, ...extraAvoid])
      ),
      breakCropValue: knowledge.rotationCompatibility.breakCropValue,
      residueBenefit: knowledge.rotationCompatibility.residueBenefit,
      preferredSeasons: knowledge.preferredSeasons,
      suitableSoilTypes: knowledge.suitableSoilTypes,
      secondarySoilTypes: knowledge.secondarySoilTypes,
      soilPhRange: knowledge.soilPhRange,
      commonDiseases: knowledge.cultivationRisks.commonDiseases,
      pestPressures: knowledge.cultivationRisks.pestPressures,
      knowledgeEntry: knowledge,
    };
  }

  if (demoCrop) {
    const minWater = Math.max(180, Math.round(demoCrop.waterNeedMm * 0.85));
    const maxWater = Math.round(demoCrop.waterNeedMm * 1.15);
    return {
      id: demoCrop.id,
      normalizedId,
      name: demoCrop.name,
      family: resolveCropFamily(demoCrop.id, demoCrop.family) ?? demoCrop.family,
      rootDepth: demoCrop.rootDepth,
      growingDurationDays: [
        Math.max(45, demoCrop.daysToMaturity - 10),
        demoCrop.daysToMaturity + 10,
      ],
      waterNeedMm: [minWater, maxWater],
      irrigationDependency:
        demoCrop.category === 'Cover Crop' ? 'Cover / Low' : 'Moderate',
      nitrogenRole: demoCrop.nitrogenRole,
      nitrogenDeltaKgHa: demoCrop.nitrogenDeltaKgHa,
      bestPrecededBy: demoCrop.bestPrecededBy,
      avoidAfter: demoCrop.avoidAfter,
      breakCropValue: demoCrop.pestBreakValue,
      residueBenefit: demoCrop.summary,
      preferredSeasons: COVER_OR_LEGACY_SEASONS[demoCrop.id] ?? [
        'Spring–Summer (Temperate)',
      ],
      suitableSoilTypes: demoCrop.preferredSoils,
      secondarySoilTypes: [],
      soilPhRange: [5.8, 7.5],
      commonDiseases: [],
      pestPressures: [],
      knowledgeEntry: null,
    };
  }

  const resolvedFamily =
    resolveCropFamily(cropId, fallbackFamily) ?? fallbackFamily ?? 'Unknown Family';
  return {
    id: cropId,
    normalizedId,
    name: fallbackName ?? cropId,
    family: resolvedFamily,
    rootDepth: 'Unknown',
    growingDurationDays: null,
    waterNeedMm: null,
    irrigationDependency: 'Cover / Low',
    nitrogenRole:
      (fallbackNitrogenDelta ?? 0) > 15
        ? 'Nitrogen Fixer'
        : (fallbackNitrogenDelta ?? 0) < -65
          ? 'Heavy Feeder'
          : 'Balanced Feeder',
    nitrogenDeltaKgHa: fallbackNitrogenDelta ?? 0,
    bestPrecededBy: [],
    avoidAfter: [],
    breakCropValue: 65,
    residueBenefit: 'No agronomic residue record available for custom crop identifier.',
    preferredSeasons: [],
    suitableSoilTypes: [],
    secondarySoilTypes: [],
    soilPhRange: null,
    commonDiseases: [],
    pestPressures: [],
    knowledgeEntry: null,
  };
}

export function generateSeasonLabels(
  periodMode: RotationPeriodMode,
  startYear: number,
  seasonSystem: RotationSeasonSystem,
  customCount = 4
): string[] {
  const count =
    periodMode === '3-season'
      ? 3
      : periodMode === '6-season'
        ? 6
        : clamp(Math.round(customCount), 1, 12);

  const labels: string[] = [];
  if (seasonSystem === 'monsoon-3') {
    const cycle = ['Kharif', 'Rabi', 'Zaid'] as const;
    for (let i = 0; i < count; i += 1) {
      const cycleIndex = i % 3;
      const yearOffset = Math.floor(i / 3);
      const yr = startYear + yearOffset;
      if (cycle[cycleIndex] === 'Rabi') {
        const nextShort = String((yr + 1) % 100).padStart(2, '0');
        labels.push(`Rabi ${yr}-${nextShort}`);
      } else if (cycle[cycleIndex] === 'Zaid') {
        labels.push(`Zaid ${yr + 1}`);
      } else {
        labels.push(`Kharif ${yr}`);
      }
    }
    return labels;
  }

  for (let i = 0; i < count; i += 1) {
    const yearOffset = Math.floor(i / 2);
    const isSpring = i % 2 === 0;
    labels.push(`${isSpring ? 'Spring' : 'Autumn'} ${startYear + yearOffset}`);
  }
  return labels;
}

export function inferSeasonSlotKind(
  seasonLabel: string
): 'warm_wet' | 'cool_winter' | 'warm_dry_spring' | 'temperate_spring' | 'unknown' {
  const lower = seasonLabel.toLowerCase();
  if (lower.includes('kharif') || lower.includes('monsoon') || lower.includes('summer')) {
    return 'warm_wet';
  }
  if (lower.includes('rabi') || lower.includes('winter') || lower.includes('autumn') || lower.includes('fall')) {
    return 'cool_winter';
  }
  if (lower.includes('zaid')) {
    return 'warm_dry_spring';
  }
  if (lower.includes('spring')) {
    return 'temperate_spring';
  }
  return 'unknown';
}

export function assessStepSeasonCompatibility(
  crop: ResolvedRotationCropMeta,
  seasonLabel: string
): { seasonFit: 'aligned' | 'marginal' | 'mismatch'; note: string } {
  const slot = inferSeasonSlotKind(seasonLabel);
  if (slot === 'unknown' || crop.preferredSeasons.length === 0) {
    return {
      seasonFit: 'aligned',
      note: 'Seasonal calendar slot evaluated without strict monsoon/temperate restriction.',
    };
  }

  const tags = crop.preferredSeasons;
  const supportsKharif = tags.some((t) => t.startsWith('Kharif'));
  const supportsRabi = tags.some((t) => t.startsWith('Rabi'));
  const supportsZaid = tags.some((t) => t.startsWith('Zaid'));
  const supportsSpringSummer = tags.some((t) => t.startsWith('Spring–Summer'));
  const supportsOverwinter = tags.some((t) => t.startsWith('Autumn–Spring'));

  if (slot === 'warm_wet') {
    if (supportsKharif || supportsSpringSummer) {
      return {
        seasonFit: 'aligned',
        note: `${crop.name} aligns with warm-season / Kharif planting (${tags[0]}).`,
      };
    }
    return {
      seasonFit: 'mismatch',
      note: `${crop.name} prefers cooler ${tags.join(' / ')} windows and faces heat/humidity stress in ${seasonLabel}.`,
    };
  }

  if (slot === 'cool_winter') {
    if (supportsRabi || supportsOverwinter) {
      return {
        seasonFit: 'aligned',
        note: `${crop.name} aligns with cool-season / overwintering ${seasonLabel}.`,
      };
    }
    return {
      seasonFit: 'mismatch',
      note: `${crop.name} requires warm frost-free temperatures (${tags.join(' / ')}) and is unsuitable for ${seasonLabel}.`,
    };
  }

  if (slot === 'warm_dry_spring') {
    if (supportsZaid) {
      return {
        seasonFit: 'aligned',
        note: `${crop.name} fits short warm-dry Zaid windows (${crop.growingDurationDays ? `${crop.growingDurationDays[0]}–${crop.growingDurationDays[1]} days` : 'short cycle'}).`,
      };
    }
    if (supportsKharif || supportsSpringSummer) {
      return {
        seasonFit: 'marginal',
        note: `${crop.name} can be planted in Zaid only with reliable irrigation and short-duration cultivars (${crop.waterNeedMm ? `${crop.waterNeedMm[0]}–${crop.waterNeedMm[1]} mm water demand` : 'warm season'}).`,
      };
    }
    return {
      seasonFit: 'mismatch',
      note: `${crop.name} is cool-season adapted (${tags[0]}) and risks heat stress during ${seasonLabel}.`,
    };
  }

  // temperate_spring
  if (supportsSpringSummer || supportsZaid || supportsOverwinter) {
    return {
      seasonFit: 'aligned',
      note: `${crop.name} fits ${seasonLabel} establishment cleanly.`,
    };
  }
  if (supportsKharif) {
    return {
      seasonFit: 'aligned',
      note: `${crop.name} establishes cleanly in warm late-spring sowing (${seasonLabel}).`,
    };
  }
  if (supportsRabi) {
    return {
      seasonFit: 'marginal',
      note: `${crop.name} is normally sown in cool Rabi/autumn; spring sowing shortens vegetative grain fill.`,
    };
  }
  return {
    seasonFit: 'aligned',
    note: `${crop.name} aligns with ${seasonLabel}.`,
  };
}

function buildStepsFromCropIds(
  cropIds: string[],
  seasonLabels: string[],
  farmCurrentCropId?: string
): RotationStep[] {
  return seasonLabels.map((season, index) => {
    const id = cropIds[index] ?? 'soybean';
    const meta = resolveRotationCropMeta(id);
    const isActive = index === 0 && farmCurrentCropId && normalizeCropReferenceId(farmCurrentCropId) === meta.normalizedId;
    return {
      id: `rot-step-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      season,
      cropId: meta.id,
      cropName: meta.name,
      family: meta.family,
      status: isActive ? 'active' : 'planned',
      expectedYieldIndex: meta.nitrogenDeltaKgHa > 0 ? 106 : 104,
      nitrogenImpactKgHa: meta.nitrogenDeltaKgHa,
    };
  });
}

export function generateRecommendedSequence(
  farm: Farm,
  nasaData: NasaPowerClimateDataset | null,
  seasonLabels: string[]
): RotationStep[] {
  const stepCount = Math.max(1, seasonLabels.length);
  const scoredDatabase = CROP_KNOWLEDGE_DATABASE.map((entry) => ({
    entry,
    eval: evaluateCropSuitability(entry, farm, nasaData),
  }));

  const steps: RotationStep[] = [];
  let prevId = normalizeCropReferenceId(farm.currentCropId) ?? farm.currentCropId;
  let prevFamily = resolveCropFamily(prevId);
  let consecutiveHeavyFeeders = 0;

  for (let i = 0; i < stepCount; i += 1) {
    const season = seasonLabels[i];
    const ranked = scoredDatabase
      .map(({ entry, eval: baseEval }) => {
        const meta = resolveRotationCropMeta(entry.id);
        const seasonCheck = assessStepSeasonCompatibility(meta, season);
        let rankScore = baseEval.overallScore;

        if (seasonCheck.seasonFit === 'aligned') rankScore += 28;
        else if (seasonCheck.seasonFit === 'marginal') rankScore += 5;
        else rankScore -= 55;

        if (prevId) {
          if (listMatchesCrop(meta.avoidAfter, prevId)) rankScore -= 60;
          if (prevFamily && prevFamily === meta.family) rankScore -= 50;
          if (listMatchesCrop(meta.bestPrecededBy, prevId)) rankScore += 18;
        }

        if (consecutiveHeavyFeeders >= 1 && meta.nitrogenDeltaKgHa > 0) {
          rankScore += 22;
        }
        if (consecutiveHeavyFeeders >= 1 && meta.nitrogenDeltaKgHa <= -70) {
          rankScore -= 25;
        }

        // Encourage multi-family diversity across the whole sequence
        const alreadyUsedFamilyCount = steps.filter((s) => s.family === meta.family).length;
        rankScore -= alreadyUsedFamilyCount * 8;

        const alreadyUsedExactCount = steps.filter(
          (s) => (normalizeCropReferenceId(s.cropId) ?? s.cropId) === meta.normalizedId
        ).length;
        rankScore -= alreadyUsedExactCount * 10;

        return { entry, meta, rankScore };
      })
      .sort((a, b) => b.rankScore - a.rankScore);

    const chosen = ranked[0].meta;
    steps.push({
      id: `rot-step-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      season,
      cropId: chosen.id,
      cropName: chosen.name,
      family: chosen.family,
      status: 'planned',
      expectedYieldIndex: chosen.nitrogenDeltaKgHa > 0 ? 108 : 106,
      nitrogenImpactKgHa: chosen.nitrogenDeltaKgHa,
    });

    prevId = chosen.normalizedId ?? chosen.id;
    prevFamily = chosen.family;
    consecutiveHeavyFeeders =
      chosen.nitrogenDeltaKgHa <= -75 ? consecutiveHeavyFeeders + 1 : 0;
  }

  return steps;
}

export function createRotationPlan(params: {
  farm: Farm;
  name: string;
  periodMode: RotationPeriodMode;
  startYear: number;
  seasonSystem: RotationSeasonSystem;
  customStepsCount?: number;
  initialCropIds?: string[];
  nasaData?: NasaPowerClimateDataset | null;
  isPrimary?: boolean;
  notes?: string;
}): SavedRotationPlan {
  const {
    farm,
    name,
    periodMode,
    startYear,
    seasonSystem,
    customStepsCount = 4,
    initialCropIds,
    nasaData = null,
    isPrimary = false,
    notes,
  } = params;

  const seasonLabels = generateSeasonLabels(
    periodMode,
    startYear,
    seasonSystem,
    customStepsCount
  );

  const steps =
    initialCropIds && initialCropIds.length > 0
      ? buildStepsFromCropIds(initialCropIds, seasonLabels, farm.currentCropId)
      : generateRecommendedSequence(farm, nasaData, seasonLabels);

  const now = new Date().toISOString();
  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    farmId: farm.id,
    name: name.trim() || `${farm.name} Rotation Plan`,
    periodMode,
    seasonSystem,
    startYear,
    steps,
    isPrimary,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildDefaultPlanFromFarm(farm: Farm): SavedRotationPlan {
  const stepCount = farm.rotationPlan.length;
  const periodMode: RotationPeriodMode =
    stepCount === 3 ? '3-season' : stepCount === 6 ? '6-season' : 'custom';
  const hasMonsoonLabel = farm.rotationPlan.some((s) =>
    /kharif|rabi|zaid/i.test(s.season)
  );
  const seasonSystem: RotationSeasonSystem = hasMonsoonLabel
    ? 'monsoon-3'
    : 'temperate-2';
  const now = farm.updatedAt || new Date().toISOString();

  return {
    id: `plan-primary-${farm.id}`,
    farmId: farm.id,
    name: `${farm.name.replace(' (Demo)', '')} Active Plan`,
    periodMode,
    seasonSystem,
    startYear: 2026,
    steps: farm.rotationPlan.map((s) => ({ ...s })),
    isPrimary: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadPlansForFarm(
  allPlans: SavedRotationPlan[],
  farm: Farm | null
): SavedRotationPlan[] {
  if (!farm) return [];
  const existing = allPlans.filter((p) => p.farmId === farm.id);
  if (existing.length > 0) {
    return existing;
  }
  return [buildDefaultPlanFromFarm(farm)];
}

export function saveOrUpdateRotationPlan(
  allPlans: SavedRotationPlan[],
  plan: SavedRotationPlan
): SavedRotationPlan[] {
  const stamped: SavedRotationPlan = {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
  const exists = allPlans.some((p) => p.id === plan.id);
  let next = exists
    ? allPlans.map((p) => (p.id === plan.id ? stamped : p))
    : [stamped, ...allPlans];

  if (stamped.isPrimary) {
    next = next.map((p) =>
      p.farmId === stamped.farmId && p.id !== stamped.id
        ? { ...p, isPrimary: false }
        : p
    );
  }
  return next;
}

export function renameRotationPlan(
  allPlans: SavedRotationPlan[],
  planId: string,
  newName: string
): SavedRotationPlan[] {
  const trimmed = newName.trim();
  if (!trimmed) return allPlans;
  const now = new Date().toISOString();
  return allPlans.map((p) =>
    p.id === planId ? { ...p, name: trimmed, updatedAt: now } : p
  );
}

export function duplicateRotationPlan(
  allPlans: SavedRotationPlan[],
  planId: string,
  customName?: string
): { plans: SavedRotationPlan[]; duplicated: SavedRotationPlan | null } {
  const source = allPlans.find((p) => p.id === planId);
  if (!source) return { plans: allPlans, duplicated: null };
  const now = new Date().toISOString();
  const copy: SavedRotationPlan = {
    ...source,
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: customName?.trim() || `${source.name} (Copy)`,
    isPrimary: false,
    steps: source.steps.map((s, idx) => ({
      ...s,
      id: `rot-copy-${Date.now()}-${idx}`,
    })),
    createdAt: now,
    updatedAt: now,
  };
  return {
    plans: [...allPlans, copy],
    duplicated: copy,
  };
}

export function deleteRotationPlan(
  allPlans: SavedRotationPlan[],
  planId: string
): SavedRotationPlan[] {
  const target = allPlans.find((p) => p.id === planId);
  const remaining = allPlans.filter((p) => p.id !== planId);
  if (target?.isPrimary) {
    const firstSameFarm = remaining.find((p) => p.farmId === target.farmId);
    if (firstSameFarm) {
      return remaining.map((p) =>
        p.id === firstSameFarm.id ? { ...p, isPrimary: true } : p
      );
    }
  }
  return remaining;
}

export function setPrimaryRotationPlan(
  allPlans: SavedRotationPlan[],
  farmId: string,
  planId: string
): SavedRotationPlan[] {
  const now = new Date().toISOString();
  return allPlans.map((p) =>
    p.farmId === farmId
      ? { ...p, isPrimary: p.id === planId, updatedAt: now }
      : p
  );
}

function buildAlternativesForConflict(params: {
  step: RotationStep;
  currentMeta: ResolvedRotationCropMeta;
  previousMeta: ResolvedRotationCropMeta | null;
  nextMeta: ResolvedRotationCropMeta | null;
  farm: Farm;
  nasaData: NasaPowerClimateDataset | null;
}): RotationAlternativeSuggestion[] {
  const { step, currentMeta, previousMeta, nextMeta, farm, nasaData } = params;

  // Score candidate crops relative to the actual previous crop in this rotation slot
  const syntheticFarm: Farm = previousMeta
    ? {
        ...farm,
        currentCropId: previousMeta.normalizedId ?? previousMeta.id,
        currentCropName: previousMeta.name,
      }
    : {
        ...farm,
        currentCropId: '',
        currentCropName: '',
        rotationPlan: [],
      };

  const candidates = CROP_KNOWLEDGE_DATABASE.filter((entry) => {
    if (entry.id === currentMeta.normalizedId || entry.id === currentMeta.id) {
      return false;
    }
    if (previousMeta) {
      if (entry.family === previousMeta.family) return false;
      if (listMatchesCrop(entry.rotationCompatibility.avoidAfter, previousMeta.id)) {
        return false;
      }
    }
    return true;
  });

  const evaluated = candidates.map((entry) => {
    const candidateMeta = resolveRotationCropMeta(entry.id);
    const suit = evaluateCropSuitability(entry, syntheticFarm, nasaData);
    const seasonCheck = assessStepSeasonCompatibility(candidateMeta, step.season);

    let rank = suit.overallScore;
    const whyBetter: string[] = [];

    if (previousMeta) {
      if (listMatchesCrop(entry.rotationCompatibility.bestPrecededBy, previousMeta.id)) {
        rank += 16;
        whyBetter.push(
          `Breaks ${previousMeta.family} cycle and is agronomy-backed after ${previousMeta.name}.`
        );
      } else {
        rank += 8;
        whyBetter.push(
          `Introduces botanical family break (${entry.family}) after ${previousMeta.name} (${previousMeta.family}).`
        );
      }
    }

    if (seasonCheck.seasonFit === 'aligned') {
      rank += 18;
      whyBetter.push(`Aligned with ${step.season} (${entry.preferredSeasons[0]}).`);
    } else if (seasonCheck.seasonFit === 'marginal') {
      rank += 2;
    } else {
      rank -= 35;
    }

    if (
      previousMeta &&
      previousMeta.nitrogenDeltaKgHa <= -75 &&
      entry.nutrientRequirements.nitrogenDeltaKgHa > 0
    ) {
      rank += 14;
      whyBetter.push(
        `Fixes +${entry.nutrientRequirements.nitrogenDeltaKgHa} kg/ha biological nitrogen after heavy feeder ${previousMeta.name}.`
      );
    } else if (entry.nutrientRequirements.nitrogenDeltaKgHa > 0) {
      whyBetter.push(
        `Replenishes soil nitrogen (+${entry.nutrientRequirements.nitrogenDeltaKgHa} kg/ha residual credit).`
      );
    } else if (entry.rotationCompatibility.breakCropValue >= 85) {
      whyBetter.push(
        `High disease-break value (${entry.rotationCompatibility.breakCropValue}/100): ${entry.rotationCompatibility.residueBenefit}`
      );
    }

    if (nextMeta) {
      const conflictsWithNext =
        entry.family === nextMeta.family ||
        listMatchesCrop(nextMeta.avoidAfter, entry.id);
      if (conflictsWithNext) {
        rank -= 25;
      } else {
        whyBetter.push(`Transitions cleanly into next planned crop (${nextMeta.name}).`);
      }
    }

    if (
      farm.irrigation === 'Dryland (Rainfed Only)' &&
      entry.irrigationDependency === 'High'
    ) {
      rank -= 18;
    }

    return {
      suggestion: {
        cropId: entry.id,
        cropName: entry.name,
        family: entry.family,
        suitabilityScore: suit.overallScore,
        suitabilityCategory: suit.suitabilityCategory,
        waterNeedMm: entry.waterNeedMm,
        growingDurationDays: entry.growingDurationDays,
        nitrogenDeltaKgHa: entry.nutrientRequirements.nitrogenDeltaKgHa,
        whyBetter: whyBetter.slice(0, 3),
      },
      rank,
      seasonFit: seasonCheck.seasonFit,
    };
  });

  // Prefer seasonally aligned alternatives first when available
  const sorted = evaluated.sort((a, b) => {
    if (a.seasonFit !== b.seasonFit) {
      const order = { aligned: 0, marginal: 1, mismatch: 2 };
      if (order[a.seasonFit] !== order[b.seasonFit] && (a.seasonFit === 'mismatch' || b.seasonFit === 'mismatch')) {
        return order[a.seasonFit] - order[b.seasonFit];
      }
    }
    return b.rank - a.rank;
  });

  return sorted.slice(0, 3).map((item) => item.suggestion);
}

export function evaluateRotationPlan(
  steps: RotationStep[],
  farm: Farm | null,
  nasaData: NasaPowerClimateDataset | null
): RotationPlanEvaluation {
  if (!farm || steps.length === 0) {
    return {
      overallScore: 0,
      scoreLabel: 'At Risk',
      confidenceLevel: 'Low',
      dataCompletenessPct: 0,
      categories: [
        {
          id: 'family_diversity',
          label: 'Crop-Family Diversity',
          weight: 25,
          score: null,
          contribution: 0,
          status: 'unavailable',
          detail: 'Add at least one crop stage to evaluate botanical diversity.',
          missingInputs: ['Planned crop sequence'],
        },
        {
          id: 'nutrient_management',
          label: 'Nutrient Management',
          weight: 20,
          score: null,
          contribution: 0,
          status: 'unavailable',
          detail: 'Add seasonal stages to evaluate nitrogen balance.',
          missingInputs: ['Planned crop sequence'],
        },
        {
          id: 'pest_break',
          label: 'Pest & Disease Break',
          weight: 20,
          score: null,
          contribution: 0,
          status: 'unavailable',
          detail: 'Add seasonal stages to check host-family breaks.',
          missingInputs: ['Planned crop sequence'],
        },
        {
          id: 'soil_root_diversity',
          label: 'Soil & Root-Depth Diversity',
          weight: 15,
          score: null,
          contribution: 0,
          status: 'unavailable',
          detail: 'Add seasonal stages to assess root architecture and soil fit.',
          missingInputs: ['Planned crop sequence'],
        },
        {
          id: 'seasonal_climate',
          label: 'Seasonal & Climate Suitability',
          weight: 20,
          score: null,
          contribution: 0,
          status: 'unavailable',
          detail: 'Add seasonal stages and NASA POWER data to evaluate climate fit.',
          missingInputs: ['Planned crop sequence'],
        },
      ],
      stepEvaluations: [],
      uniqueFamilies: [],
      familyDistribution: [],
      netNitrogenKgHa: 0,
      totalWaterNeedMm: [0, 0],
      identifiedRisks: ['No seasonal crop stages defined for this rotation plan.'],
      strengths: [],
      assumptionsAndDisclosures: [
        'Historical climate context relies on NASA POWER observations when available.',
      ],
    };
  }

  const metas = steps.map((s) =>
    resolveRotationCropMeta(s.cropId, s.cropName, s.family, s.nitrogenImpactKgHa)
  );

  // Check if farm.currentCropId gives context ahead of step 0
  const farmPrevMeta =
    farm.currentCropId &&
    steps[0].status === 'planned' &&
    normalizeCropReferenceId(farm.currentCropId) !== metas[0].normalizedId
      ? resolveRotationCropMeta(farm.currentCropId, farm.currentCropName)
      : null;

  const stepEvaluations: RotationStepEvaluation[] = [];
  let consecutiveHeavyCount = 0;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const curr = metas[i];
    const prev = i === 0 ? farmPrevMeta : metas[i - 1];
    const next = i + 1 < metas.length ? metas[i + 1] : null;

    const seasonCheck = assessStepSeasonCompatibility(curr, step.season);
    const warnings: RotationConflictWarning[] = [];

    if (prev) {
      const avoidsPrev = listMatchesCrop(curr.avoidAfter, prev.id);
      const sameFamily = curr.family === prev.family;

      if (avoidsPrev) {
        const diseaseSnippet =
          curr.commonDiseases.length > 0
            ? ` Elevates carryover risk for ${curr.commonDiseases.slice(0, 2).join(' and ')}.`
            : '';
        warnings.push({
          id: `${step.id}-avoid-after`,
          severity: 'high',
          type: 'avoid_after',
          title: `Agronomic conflict after ${prev.name}`,
          explanation: `${curr.name} (${curr.family.replace(/\s*\([^)]*\)/, '')}) is agronomically discouraged immediately after ${prev.name}.${diseaseSnippet}`,
          responsiblePreviousCrop: prev.name,
        });
      } else if (sameFamily) {
        const diseaseSnippet =
          curr.commonDiseases.length > 0
            ? ` Shared host pathogens include ${curr.commonDiseases.slice(0, 2).join(', ')}.`
            : '';
        warnings.push({
          id: `${step.id}-same-family`,
          severity: 'high',
          type: 'same_family',
          title: `Back-to-back ${curr.family} family`,
          explanation: `${curr.name} shares the ${curr.family} botanical family with preceding ${prev.name}, limiting pest and root-disease break.${diseaseSnippet}`,
          responsiblePreviousCrop: prev.name,
        });
      }
    }

    if (seasonCheck.seasonFit === 'mismatch') {
      warnings.push({
        id: `${step.id}-season-mismatch`,
        severity: 'high',
        type: 'seasonal_mismatch',
        title: `Seasonal mismatch in ${step.season}`,
        explanation: seasonCheck.note,
        responsiblePreviousCrop: null,
      });
    } else if (seasonCheck.seasonFit === 'marginal') {
      warnings.push({
        id: `${step.id}-season-marginal`,
        severity: 'moderate',
        type: 'seasonal_mismatch',
        title: `Marginal planting window (${step.season})`,
        explanation: seasonCheck.note,
        responsiblePreviousCrop: null,
      });
    }

    if (curr.nitrogenDeltaKgHa <= -75) {
      consecutiveHeavyCount += 1;
      if (consecutiveHeavyCount >= 2 && prev) {
        warnings.push({
          id: `${step.id}-nutrient-depletion`,
          severity: 'moderate',
          type: 'nutrient_depletion',
          title: 'Consecutive heavy nitrogen extraction',
          explanation: `${curr.name} (${curr.nitrogenDeltaKgHa} kg/ha N) follows ${prev.name} (${prev.nitrogenDeltaKgHa} kg/ha N) without an intervening legume or nutrient-scavenging break crop.`,
          responsiblePreviousCrop: prev.name,
        });
      }
    } else {
      consecutiveHeavyCount = 0;
    }

    if (
      farm.irrigation === 'Dryland (Rainfed Only)' &&
      curr.irrigationDependency === 'High'
    ) {
      warnings.push({
        id: `${step.id}-dryland-water`,
        severity: 'moderate',
        type: 'water_soil_mismatch',
        title: 'High water demand on Dryland parcel',
        explanation: `${curr.name} requires ${curr.waterNeedMm ? `${curr.waterNeedMm[0]}–${curr.waterNeedMm[1]} mm` : 'high irrigation'} (${curr.irrigationDependency} dependency), posing severe drought risk on Dryland (Rainfed Only) land.`,
        responsiblePreviousCrop: null,
      });
    }

    const hasSoilMatch =
      curr.suitableSoilTypes.length === 0 ||
      curr.suitableSoilTypes.includes(farm.soilType) ||
      curr.secondarySoilTypes.includes(farm.soilType);
    if (!hasSoilMatch) {
      warnings.push({
        id: `${step.id}-soil-mismatch`,
        severity: 'moderate',
        type: 'water_soil_mismatch',
        title: `Sub-optimal soil texture (${farm.soilType})`,
        explanation: `${curr.name} prefers ${curr.suitableSoilTypes.join(', ')} rather than ${farm.soilType}.`,
        responsiblePreviousCrop: null,
      });
    }

    const hasConflict = warnings.length > 0;
    const alternatives = hasConflict
      ? buildAlternativesForConflict({
          step,
          currentMeta: curr,
          previousMeta: prev,
          nextMeta: next,
          farm,
          nasaData,
        })
      : [];

    stepEvaluations.push({
      stepId: step.id,
      season: step.season,
      cropId: step.cropId,
      normalizedCropId: curr.normalizedId,
      cropName: curr.name,
      family: curr.family,
      rootDepth: curr.rootDepth,
      growingDurationDays: curr.growingDurationDays,
      waterNeedMm: curr.waterNeedMm,
      irrigationDependency: curr.irrigationDependency,
      nitrogenDeltaKgHa: curr.nitrogenDeltaKgHa,
      nitrogenRole: curr.nitrogenRole,
      previousCropName: prev?.name ?? null,
      previousCropFamily: prev?.family ?? null,
      seasonFit: seasonCheck.seasonFit,
      seasonFitNote: seasonCheck.note,
      hasConflict,
      warnings,
      alternatives,
    });
  }

  // 1. Crop-Family Diversity (weight 25) — strictly evaluates botanical families, NOT crop names
  const familyCounts = new Map<string, number>();
  metas.forEach((m) => {
    familyCounts.set(m.family, (familyCounts.get(m.family) ?? 0) + 1);
  });
  const uniqueFamilies = Array.from(familyCounts.keys());
  const familyDistribution = Array.from(familyCounts.entries()).map(
    ([family, count]) => ({ family, count })
  );

  const targetUniqueFamilies = Math.min(4, Math.max(2, Math.ceil(steps.length * 0.6)));
  const uniqueRatio = clamp(uniqueFamilies.length / targetUniqueFamilies, 0, 1);

  let transitions = 0;
  let distinctFamilyTransitions = 0;
  for (let i = 0; i < stepEvaluations.length; i += 1) {
    const se = stepEvaluations[i];
    if (se.previousCropFamily) {
      transitions += 1;
      if (se.previousCropFamily !== se.family) {
        distinctFamilyTransitions += 1;
      }
    }
  }
  const transitionRatio =
    transitions > 0 ? distinctFamilyTransitions / transitions : uniqueFamilies.length > 1 ? 1 : 0.4;

  // Monoculture or single-family sequence (even with 3 different cereal names!) capped low
  const singleFamilyCap = uniqueFamilies.length === 1 && steps.length > 1 ? 0.25 : 1;
  const familyDiversityScore = Math.round(
    clamp((uniqueRatio * 0.55 + transitionRatio * 0.45) * singleFamilyCap * 100, 0, 100)
  );
  const familyDiversityContribution = Math.round((familyDiversityScore / 100) * 25);

  // 2. Nutrient Management (weight 20)
  const netNitrogenKgHa = metas.reduce((sum, m) => sum + m.nitrogenDeltaKgHa, 0);
  const legumeCount = metas.filter((m) => m.nitrogenDeltaKgHa > 0).length;
  const scavengerCount = metas.filter(
    (m) => m.nitrogenRole === 'Nitrogen Scavenger'
  ).length;
  let legumeBeforeHeavyCount = 0;
  let consecutiveHeavyPenalties = 0;

  for (let i = 0; i < stepEvaluations.length; i += 1) {
    const se = stepEvaluations[i];
    if (i > 0 && metas[i - 1].nitrogenDeltaKgHa > 0 && metas[i].nitrogenDeltaKgHa <= -50) {
      legumeBeforeHeavyCount += 1;
    }
    if (se.warnings.some((w) => w.type === 'nutrient_depletion')) {
      consecutiveHeavyPenalties += 1;
    }
  }

  let nutrientRaw = 40;
  if (legumeCount > 0) nutrientRaw += Math.min(28, legumeCount * 15);
  if (legumeBeforeHeavyCount > 0) nutrientRaw += Math.min(18, legumeBeforeHeavyCount * 10);
  if (scavengerCount > 0) nutrientRaw += Math.min(10, scavengerCount * 8);
  const avgNitrogenPerStage = netNitrogenKgHa / steps.length;
  if (avgNitrogenPerStage >= -25) nutrientRaw += 10;
  else if (avgNitrogenPerStage >= -55) nutrientRaw += 4;
  else nutrientRaw -= 10;
  nutrientRaw -= consecutiveHeavyPenalties * 18;

  const nutrientScore = Math.round(clamp(nutrientRaw, 0, 100));
  const nutrientContribution = Math.round((nutrientScore / 100) * 20);

  // 3. Pest & Disease Break (weight 20)
  let bestPrecededCount = 0;
  let avoidAfterCount = 0;
  let sameFamilyCount = 0;
  let breakValueSum = 0;

  for (let i = 0; i < metas.length; i += 1) {
    const curr = metas[i];
    breakValueSum += curr.breakCropValue;
    const prev = i === 0 ? farmPrevMeta : metas[i - 1];
    if (prev) {
      if (listMatchesCrop(curr.bestPrecededBy, prev.id)) bestPrecededCount += 1;
      if (listMatchesCrop(curr.avoidAfter, prev.id)) avoidAfterCount += 1;
      else if (curr.family === prev.family) sameFamilyCount += 1;
    }
  }

  const avgBreakCropValue = breakValueSum / metas.length;
  let pestRaw = avgBreakCropValue * 0.65 + bestPrecededCount * 12;
  pestRaw -= avoidAfterCount * 28;
  pestRaw -= sameFamilyCount * 20;
  if (uniqueFamilies.length >= 3) pestRaw += 10;
  const pestScore = Math.round(clamp(pestRaw, 0, 100));
  const pestContribution = Math.round((pestScore / 100) * 20);

  // 4. Soil & Root-Depth Diversity (weight 15)
  const uniqueRoots = new Set(
    metas.map((m) => m.rootDepth).filter((r) => r !== 'Unknown')
  );
  let rootTransitions = 0;
  let totalRootPairs = 0;
  for (let i = 1; i < metas.length; i += 1) {
    if (metas[i - 1].rootDepth !== 'Unknown' && metas[i].rootDepth !== 'Unknown') {
      totalRootPairs += 1;
      if (metas[i - 1].rootDepth !== metas[i].rootDepth) {
        rootTransitions += 1;
      }
    }
  }
  const rootDiversityPct =
    uniqueRoots.size >= 3
      ? 100
      : uniqueRoots.size === 2
        ? 78
        : 38;
  const rootTransitionPct =
    totalRootPairs > 0 ? (rootTransitions / totalRootPairs) * 100 : 65;

  const validPh =
    typeof farm.health?.phLevel === 'number' &&
    Number.isFinite(farm.health.phLevel) &&
    farm.health.phLevel >= 3.5 &&
    farm.health.phLevel <= 9.5;

  let soilFitSum = 0;
  metas.forEach((m) => {
    let cropSoilPts = 50;
    if (m.suitableSoilTypes.length === 0 || m.suitableSoilTypes.includes(farm.soilType)) {
      cropSoilPts = 65;
    } else if (m.secondarySoilTypes.includes(farm.soilType)) {
      cropSoilPts = 45;
    } else {
      cropSoilPts = 18;
    }
    if (validPh && m.soilPhRange) {
      const ph = farm.health.phLevel;
      if (ph >= m.soilPhRange[0] && ph <= m.soilPhRange[1]) {
        cropSoilPts += 35;
      } else {
        const diff = Math.min(
          Math.abs(ph - m.soilPhRange[0]),
          Math.abs(ph - m.soilPhRange[1])
        );
        cropSoilPts += Math.max(0, 35 - diff * 25);
      }
    }
    soilFitSum += cropSoilPts;
  });
  const avgSoilFitPct = validPh ? soilFitSum / metas.length : (soilFitSum / metas.length) * (100 / 65);
  const soilRootScore = Math.round(
    clamp(rootDiversityPct * 0.35 + rootTransitionPct * 0.25 + avgSoilFitPct * 0.4, 0, 100)
  );
  const soilRootContribution = Math.round((soilRootScore / 100) * 15);

  // 5. Seasonal & Climate Suitability (weight 20)
  // 8 pts from seasonal slot alignment, 12 pts from NASA POWER suitability (0 if NASA unavailable)
  const alignedCount = stepEvaluations.filter((s) => s.seasonFit === 'aligned').length;
  const marginalCount = stepEvaluations.filter((s) => s.seasonFit === 'marginal').length;
  const seasonAlignmentRatio =
    (alignedCount + marginalCount * 0.5) / stepEvaluations.length;
  const seasonPoints = Math.round(seasonAlignmentRatio * 8);

  const hasNasa =
    nasaData !== null &&
    nasaData.summary.validDayCount > 0 &&
    nasaData.summary.meanTempC !== null;

  let climatePoints = 0;
  const missingClimateInputs: string[] = [];
  if (hasNasa) {
    let suitSum = 0;
    let count = 0;
    metas.forEach((m) => {
      if (m.knowledgeEntry) {
        const evalRes = evaluateCropSuitability(m.knowledgeEntry, farm, nasaData);
        const climateCat = evalRes.categories.find((c) => c.id === 'climate');
        const waterCat = evalRes.categories.find((c) => c.id === 'water');
        const avgPct =
          ((climateCat?.score ?? 50) + (waterCat?.score ?? 50)) / 2;
        suitSum += avgPct;
        count += 1;
      } else {
        suitSum += 68;
        count += 1;
      }
    });
    const avgClimatePct = count > 0 ? suitSum / count : 0;
    climatePoints = Math.round((avgClimatePct / 100) * 12);
  } else {
    missingClimateInputs.push('NASA POWER historical climate & rainfall observations');
  }

  const seasonalContribution = clamp(seasonPoints + climatePoints, 0, 20);
  const seasonalScore = hasNasa
    ? Math.round((seasonalContribution / 20) * 100)
    : Math.round((seasonPoints / 8) * 100);

  const categories: RotationCategoryScore[] = [
    {
      id: 'family_diversity',
      label: 'Crop-Family Diversity',
      weight: 25,
      score: familyDiversityScore,
      contribution: familyDiversityContribution,
      status: 'evaluated',
      detail: `${uniqueFamilies.length} distinct botanical famil${uniqueFamilies.length === 1 ? 'y' : 'ies'} across ${steps.length} stage${steps.length === 1 ? '' : 's'} (${distinctFamilyTransitions}/${Math.max(1, transitions)} family breaks).`,
      missingInputs: [],
    },
    {
      id: 'nutrient_management',
      label: 'Nutrient Management',
      weight: 20,
      score: nutrientScore,
      contribution: nutrientContribution,
      status: 'evaluated',
      detail: `${legumeCount} N-fixing stage(s), ${scavengerCount} scavenger stage(s), net balance ${netNitrogenKgHa >= 0 ? `+${netNitrogenKgHa}` : netNitrogenKgHa} kg/ha N.`,
      missingInputs: [],
    },
    {
      id: 'pest_break',
      label: 'Pest & Disease Break',
      weight: 20,
      score: pestScore,
      contribution: pestContribution,
      status: 'evaluated',
      detail: `${bestPrecededCount} optimal sequence pairing(s), ${avoidAfterCount + sameFamilyCount} host-family conflict(s).`,
      missingInputs: [],
    },
    {
      id: 'soil_root_diversity',
      label: 'Soil & Root-Depth Diversity',
      weight: 15,
      score: soilRootScore,
      contribution: soilRootContribution,
      status: validPh ? 'evaluated' : 'partial',
      detail: `${uniqueRoots.size} root depth class(es) (${Array.from(uniqueRoots).join(', ') || 'Unknown'}) · ${farm.soilType}${validPh ? ` (pH ${farm.health.phLevel.toFixed(1)})` : ' (pH missing)'}.`,
      missingInputs: validPh ? [] : ['Valid farm soil pH (3.5–9.5)'],
    },
    {
      id: 'seasonal_climate',
      label: 'Seasonal & Climate Suitability',
      weight: 20,
      score: seasonalScore,
      contribution: seasonalContribution,
      status: hasNasa ? 'evaluated' : 'partial',
      detail: hasNasa
        ? `${alignedCount}/${steps.length} seasonally aligned · grounded against NASA POWER (${nasaData.summary.meanTempC?.toFixed(1)}°C mean)`
        : `${alignedCount}/${steps.length} seasonally aligned · NASA POWER observations unavailable (0/12 climate pts awarded).`,
      missingInputs: missingClimateInputs,
    },
  ];

  const evaluatedWeight =
    25 + 20 + 20 + (validPh ? 15 : 10) + (hasNasa ? 20 : 8);
  const dataCompletenessPct = Math.round(clamp(evaluatedWeight, 0, 100));

  const overallScore = clamp(
    categories.reduce((sum, c) => sum + c.contribution, 0),
    0,
    100
  );

  const scoreLabel: RotationPlanEvaluation['scoreLabel'] =
    overallScore >= 75 ? 'Strong' : overallScore >= 55 ? 'Balanced' : 'At Risk';

  const confidenceLevel: ConfidenceLevel = !hasNasa
    ? 'Low'
    : dataCompletenessPct >= 90
      ? 'High'
      : 'Moderate';

  const totalWaterMin = metas.reduce(
    (sum, m) => sum + (m.waterNeedMm ? m.waterNeedMm[0] : 0),
    0
  );
  const totalWaterMax = metas.reduce(
    (sum, m) => sum + (m.waterNeedMm ? m.waterNeedMm[1] : 0),
    0
  );

  const identifiedRisks = Array.from(
    new Set(
      stepEvaluations.flatMap((se) =>
        se.warnings.map((w) => `${se.season} (${se.cropName}): ${w.title}`)
      )
    )
  );
  if (!hasNasa) {
    identifiedRisks.push(
      'NASA POWER climate observations unavailable — thermal and rainfall suitability could not be verified.'
    );
  }

  const strengths: string[] = [];
  if (uniqueFamilies.length >= 3) {
    strengths.push(
      `Spans ${uniqueFamilies.length} distinct botanical families (${uniqueFamilies.join(', ')}).`
    );
  }
  if (legumeBeforeHeavyCount > 0) {
    strengths.push(
      `Positions nitrogen-fixing legumes directly ahead of ${legumeBeforeHeavyCount} cereal/cash-crop stage(s).`
    );
  }
  if (uniqueRoots.size >= 2) {
    strengths.push(
      `Alternates ${Array.from(uniqueRoots).join(' & ')} root depths to utilize multi-horizon moisture and reduce compaction.`
    );
  }
  if (identifiedRisks.length === 0) {
    strengths.push('Zero rotational family, pest-carryover, or seasonal conflicts detected.');
  }

  const assumptionsAndDisclosures = [
    hasNasa
      ? `Historical climate reference: NASA POWER AG daily observations (${nasaData.startDate} to ${nasaData.endDate}) — future season weather remains uncertain.`
      : 'Historical climate verification unavailable because NASA POWER observations are not loaded.',
    'Planned future seasons represent hypothetical management scenarios assuming standard residue retention and cultivar maturity windows.',
    'Biological nitrogen credits (kg/ha) reflect FAO/USDA-ARS literature averages and depend on inoculant survival, soil pH, and mineralization weather.',
  ];

  return {
    overallScore,
    scoreLabel,
    confidenceLevel,
    dataCompletenessPct,
    categories,
    stepEvaluations,
    uniqueFamilies,
    familyDistribution,
    netNitrogenKgHa,
    totalWaterNeedMm: [totalWaterMin, totalWaterMax],
    identifiedRisks,
    strengths,
    assumptionsAndDisclosures,
  };
}

export function compareRotationPlans(
  plans: SavedRotationPlan[],
  selectedPlanIds: string[],
  farm: Farm | null,
  nasaData: NasaPowerClimateDataset | null
): RotationPlanComparisonSummary {
  const uniqueIds = Array.from(new Set(selectedPlanIds));
  const truncatedFromCount = Math.max(0, uniqueIds.length - MAX_COMPARISON_PLANS);
  const limitedIds = uniqueIds.slice(0, MAX_COMPARISON_PLANS);
  const planById = new Map(plans.map((p) => [p.id, p]));

  const entries: RotationPlanComparisonEntry[] = limitedIds
    .map((id) => planById.get(id))
    .filter((p): p is SavedRotationPlan => Boolean(p))
    .map((plan) => ({
      plan,
      evaluation: evaluateRotationPlan(plan.steps, farm, nasaData),
    }));

  const metricDefs = [
    { key: 'family_diversity', label: 'Family Diversity' },
    { key: 'nutrient_management', label: 'Nutrients' },
    { key: 'pest_break', label: 'Pest Break' },
    { key: 'soil_root_diversity', label: 'Soil & Roots' },
    { key: 'seasonal_climate', label: 'Season & Climate' },
  ] as const;

  const chartData = [
    {
      metric: 'Overall Score',
      ...Object.fromEntries(entries.map((e) => [e.plan.id, e.evaluation.overallScore])),
    },
    ...metricDefs.map((m) => ({
      metric: m.label,
      ...Object.fromEntries(
        entries.map((e) => {
          const cat = e.evaluation.categories.find((c) => c.id === m.key);
          return [e.plan.id, cat?.score ?? 0];
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

export function profileToRotationCropLabel(crop: CropProfile): string {
  return `${crop.name} (${crop.family})`;
}
