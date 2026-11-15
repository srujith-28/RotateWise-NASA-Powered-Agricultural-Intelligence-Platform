export type NavSection =
  | 'dashboard'
  | 'farms'
  | 'climate'
  | 'crops'
  | 'comparison'
  | 'planner'
  | 'simulator'
  | 'advisor'
  | 'reports'
  | 'settings';

export type SoilType =
  | 'Silty Clay Loam'
  | 'Loam'
  | 'Sandy Loam'
  | 'Clay Loam'
  | 'Silt Loam'
  | 'Peat Loam';

export type IrrigationType =
  | 'Full Center-Pivot'
  | 'Drip Irrigation'
  | 'Supplemental Rainfed'
  | 'Dryland (Rainfed Only)';

export type CropCategory = 'Cereal' | 'Legume' | 'Cover Crop' | 'Oilseed & Forage';

export type NitrogenRole = 'Nitrogen Fixer' | 'Heavy Feeder' | 'Nitrogen Scavenger' | 'Balanced Feeder';

export type RootDepth = 'Shallow' | 'Moderate' | 'Deep';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RotationStep {
  id: string;
  season: string;
  cropId: string;
  cropName: string;
  family: string;
  status: 'completed' | 'active' | 'planned';
  expectedYieldIndex: number;
  nitrogenImpactKgHa: number;
}

export interface HealthMetrics {
  soilHealthScore: number;
  organicMatterPct: number;
  phLevel: number;
  nitrogenBalanceScore: number;
  moistureRetentionScore: number;
  pestBreakScore: number;
}

export interface Farm {
  id: string;
  name: string;
  location: string;
  coordinates: Coordinates;
  landAreaAcres: number;
  soilType: SoilType;
  irrigation: IrrigationType;
  currentCropId: string;
  currentCropName: string;
  plantingStage: string;
  imageUrl?: string;
  health: HealthMetrics;
  rotationPlan: RotationStep[];
  updatedAt: string;
  isDemo: boolean;
}

export interface FarmFormInput {
  name: string;
  location: string;
  lat: string;
  lng: string;
  landArea: string;
  soilType: SoilType;
  phLevel?: string;
  irrigation: IrrigationType;
  currentCropId: string;
}

export interface CropProfile {
  id: string;
  name: string;
  scientificName: string;
  family: string;
  category: CropCategory;
  nitrogenRole: NitrogenRole;
  nitrogenDeltaKgHa: number;
  rootDepth: RootDepth;
  waterNeedMm: number;
  optimalTempC: [number, number];
  preferredSoils: SoilType[];
  daysToMaturity: number;
  pestBreakValue: number;
  summary: string;
  bestPrecededBy: string[];
  avoidAfter: string[];
}

export interface ClimateMonthPoint {
  month: string;
  rainfallMm: number;
  baselineRainfallMm: number;
  tempAvgC: number;
  tempMinC: number;
  tempMaxC: number;
  evapotranspirationMm: number;
  gdd: number;
}

export interface FarmClimateProfile {
  farmId: string;
  sourceLabel: string;
  isExternalLive: boolean;
  frostFreeDays: number;
  annualRainfallMm: number;
  meanGrowingTempC: number;
  droughtRiskLevel: 'Low' | 'Moderate' | 'Elevated';
  monthly: ClimateMonthPoint[];
}

export interface CropRecommendation {
  crop: CropProfile;
  suitabilityScore: number;
  yieldOutlookDeltaPct: number;
  nitrogenGainKgHa: number;
  rationale: string;
  fitLabel: 'Optimal Fit' | 'Strong Fit' | 'Moderate Fit';
}

export interface SimulationParams {
  rainfallDeltaPct: number;
  tempShiftC: number;
  nitrogenStrategy: 'reduced' | 'balanced' | 'intensive';
  useCoverCrop: boolean;
  targetCropId: string;
}

export interface SimulationProjectionPoint {
  year: string;
  baselineYield: number;
  simulatedYield: number;
  soilCarbonIndex: number;
  moistureStressRisk: number;
}

export interface SimulationResult {
  projectedYieldChangePct: number;
  moistureStressScore: number;
  soilCarbonDeltaPct: number;
  nitrogenLeachingRisk: 'Low' | 'Moderate' | 'High';
  advisorySummary: string;
  timeline: SimulationProjectionPoint[];
}

export interface ActivityItem {
  id: string;
  farmId: string;
  farmName: string;
  action: string;
  detail: string;
  timestamp: string;
  category: 'rotation' | 'farm' | 'simulation' | 'climate' | 'advisor';
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  farmId?: string;
  severity: 'info' | 'warning' | 'positive';
  timestamp: string;
  read: boolean;
}

export interface ReportRecord {
  id: string;
  title: string;
  farmId: string;
  farmName: string;
  createdAt: string;
  rotationEfficiency: number;
  climateSuitability: number;
  soilHealthScore: number;
  recommendedCrop: string;
  summary: string;
}

export interface AppSettings {
  unitSystem: 'imperial' | 'metric';
  managerName: string;
  organization: string;
  moistureWarningThreshold: number;
  rotationTargetScore: number;
}

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sourceMode?: 'gemini-live' | 'local-agronomy-demo';
  farmContextName?: string;
}

export type DataClassification = 'LIVE' | 'HISTORICAL' | 'DEMONSTRATION';

export interface NasaPowerDailyObservation {
  dateKey: string;
  isoDate: string;
  displayDate: string;
  shortDate: string;
  t2m: number | null;
  t2mMax: number | null;
  t2mMin: number | null;
  precipitationMm: number | null;
  humidityPct: number | null;
  windSpeedMs: number | null;
  solarRadiationMj: number | null;
}

export interface NasaPowerClimateSummary {
  meanTempC: number | null;
  maxTempC: number | null;
  minTempC: number | null;
  totalRainfallMm: number | null;
  avgHumidityPct: number | null;
  avgWindSpeedMs: number | null;
  avgSolarRadiationMj: number | null;
  validDayCount: number;
  missingValueCount: number;
}

export interface NasaPowerClimateDataset {
  source: 'NASA POWER';
  community: 'AG';
  classification: Exclude<DataClassification, 'DEMONSTRATION'>;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  startDate: string;
  endDate: string;
  retrievedAt: string;
  units: Record<string, string>;
  observations: NasaPowerDailyObservation[];
  summary: NasaPowerClimateSummary;
}

export type KnowledgeCropCategory =
  | 'Cereal'
  | 'Legume'
  | 'Pulse'
  | 'Oilseed'
  | 'Fiber & Cash Crop';

export type GrowingSeasonTag =
  | 'Kharif (Warm Wet / Monsoon)'
  | 'Rabi (Cool / Winter)'
  | 'Zaid (Warm Dry / Spring)'
  | 'Spring–Summer (Temperate)'
  | 'Autumn–Spring (Overwintering)';

export type IrrigationDependency =
  | 'High'
  | 'Moderate'
  | 'Low'
  | 'Optional (Rainfed-Resilient)';

export type ConfidenceLevel = 'High' | 'Moderate' | 'Low';

export type SuitabilityCategoryLabel = 'High' | 'Moderate' | 'Low';

export interface AgronomicSourceRef {
  name: string;
  authority: 'FAO' | 'ICAR' | 'ICRISAT' | 'USDA-ARS' | 'CGIAR';
  note: string;
}

export interface CropKnowledgeEntry {
  id: string;
  name: string;
  scientificName: string;
  category: KnowledgeCropCategory;
  family: string;
  rootDepth: RootDepth;
  suitableSoilTypes: SoilType[];
  secondarySoilTypes: SoilType[];
  soilPhRange: [number, number];
  soilDrainagePreference: string;
  preferredSeasons: GrowingSeasonTag[];
  idealTempC: [number, number];
  frostSensitivityC: number | null;
  heatStressThresholdC: number | null;
  waterNeedMm: [number, number];
  rainfallRangeMm: [number, number];
  growingDurationDays: [number, number];
  irrigationDependency: IrrigationDependency;
  nutrientRequirements: {
    nitrogenRole: NitrogenRole;
    nitrogenDeltaKgHa: number;
    nitrogenDemandLevel: 'High' | 'Moderate' | 'Low (Net Fixer)';
    npkGuidanceKgHa: string;
    keyMicronutrients: string[];
  };
  rotationCompatibility: {
    bestPrecededBy: string[];
    avoidAfter: string[];
    breakCropValue: number;
    residueBenefit: string;
    notes: string;
  };
  cultivationRisks: {
    commonDiseases: string[];
    pestPressures: string[];
    abioticRisks: string[];
  };
  summary: string;
  sources: AgronomicSourceRef[];
  confidenceLevel: ConfidenceLevel;
  unknownFields: string[];
}

export type ScoringCategoryId =
  | 'climate'
  | 'water'
  | 'soil'
  | 'season'
  | 'rotation';

export interface SuitabilityCategoryScore {
  id: ScoringCategoryId;
  label: string;
  weight: number;
  score: number | null;
  contribution: number;
  status: 'evaluated' | 'partial' | 'unavailable';
  detail: string;
  missingInputs: string[];
}

export interface CropSuitabilityEvaluation {
  crop: CropKnowledgeEntry;
  overallScore: number;
  suitabilityCategory: SuitabilityCategoryLabel;
  confidenceLevel: ConfidenceLevel;
  dataCompletenessPct: number;
  categories: SuitabilityCategoryScore[];
  supportingReasons: string[];
  cultivationChallenges: string[];
  waterConsiderations: string;
  soilAndNutrientConsiderations: string;
  dataLimitations: string[];
  previousCropUsed: string | null;
}

export type RotationPeriodMode = '3-season' | '6-season' | 'custom';

export type RotationSeasonSystem = 'temperate-2' | 'monsoon-3';

export interface SavedRotationPlan {
  id: string;
  farmId: string;
  name: string;
  periodMode: RotationPeriodMode;
  seasonSystem: RotationSeasonSystem;
  startYear: number;
  steps: RotationStep[];
  isPrimary: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type RotationCategoryId =
  | 'family_diversity'
  | 'nutrient_management'
  | 'pest_break'
  | 'soil_root_diversity'
  | 'seasonal_climate';

export interface RotationCategoryScore {
  id: RotationCategoryId;
  label: string;
  weight: number;
  score: number | null;
  contribution: number;
  status: 'evaluated' | 'partial' | 'unavailable';
  detail: string;
  missingInputs: string[];
}

export interface RotationAlternativeSuggestion {
  cropId: string;
  cropName: string;
  family: string;
  suitabilityScore: number;
  suitabilityCategory: SuitabilityCategoryLabel;
  waterNeedMm: [number, number];
  growingDurationDays: [number, number];
  nitrogenDeltaKgHa: number;
  whyBetter: string[];
}

export interface RotationConflictWarning {
  id: string;
  severity: 'high' | 'moderate';
  type:
    | 'same_family'
    | 'avoid_after'
    | 'nutrient_depletion'
    | 'seasonal_mismatch'
    | 'water_soil_mismatch';
  title: string;
  explanation: string;
  responsiblePreviousCrop: string | null;
}

export interface RotationStepEvaluation {
  stepId: string;
  season: string;
  cropId: string;
  normalizedCropId: string | null;
  cropName: string;
  family: string;
  rootDepth: RootDepth | 'Unknown';
  growingDurationDays: [number, number] | null;
  waterNeedMm: [number, number] | null;
  irrigationDependency: IrrigationDependency | 'Cover / Low';
  nitrogenDeltaKgHa: number;
  nitrogenRole: NitrogenRole;
  previousCropName: string | null;
  previousCropFamily: string | null;
  seasonFit: 'aligned' | 'marginal' | 'mismatch';
  seasonFitNote: string;
  hasConflict: boolean;
  warnings: RotationConflictWarning[];
  alternatives: RotationAlternativeSuggestion[];
}

export interface RotationPlanEvaluation {
  overallScore: number;
  scoreLabel: 'Strong' | 'Balanced' | 'At Risk';
  confidenceLevel: ConfidenceLevel;
  dataCompletenessPct: number;
  categories: RotationCategoryScore[];
  stepEvaluations: RotationStepEvaluation[];
  uniqueFamilies: string[];
  familyDistribution: Array<{ family: string; count: number }>;
  netNitrogenKgHa: number;
  totalWaterNeedMm: [number, number];
  identifiedRisks: string[];
  strengths: string[];
  assumptionsAndDisclosures: string[];
}

export interface RotationPlanComparisonEntry {
  plan: SavedRotationPlan;
  evaluation: RotationPlanEvaluation;
}

export interface RotationPlanComparisonSummary {
  entries: RotationPlanComparisonEntry[];
  chartData: Array<{
    metric: string;
    [planName: string]: string | number;
  }>;
  truncatedFromCount: number;
}

export type ScenarioIrrigationMode =
  | 'current'
  | 'reduced'
  | 'improved'
  | 'rainwater_harvesting';

export type ScenarioRiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export type ScenarioRiskId =
  | 'rainfall_stress'
  | 'heat_stress'
  | 'water_shortage'
  | 'soil_compatibility'
  | 'seasonal_mismatch'
  | 'rotation_conflict';

export interface ScenarioRiskItem {
  id: ScenarioRiskId;
  label: string;
  level: ScenarioRiskLevel;
  ruleApplied: string;
  explanation: string;
}

export interface ClimateScenarioConfig {
  rainfallDeltaPct: number;
  temperatureShiftC: number;
  irrigationMode: ScenarioIrrigationMode;
  primaryCropId: string;
  comparedAlternativeCropIds: string[];
}

export interface SavedClimateScenario {
  id: string;
  farmId: string;
  name: string;
  config: ClimateScenarioConfig;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioClimateSnapshot {
  isSimulated: boolean;
  classification: 'HISTORICAL_BASELINE' | 'HYPOTHETICAL_SIMULATION';
  meanTempC: number;
  minTempC: number | null;
  maxTempC: number | null;
  totalRainfallMm: number;
  dailyRainfallMm: number;
  validDayCount: number;
  effectiveIrrigation: IrrigationType;
  rainwaterHarvestingBonusMm: number;
  effectiveAvailableWaterMm: number;
}

export interface ScenarioCropDelta {
  cropId: string;
  cropName: string;
  family: string;
  baselineScore: number;
  simulatedScore: number;
  scoreDelta: number;
  baselineSuitability: SuitabilityCategoryLabel;
  simulatedSuitability: SuitabilityCategoryLabel;
  climateScore: number | null;
  waterScore: number | null;
  soilScore: number | null;
  seasonScore: number | null;
  rotationScore: number | null;
  rotationStatus: 'clean' | 'conflict';
  rotationWarning: string | null;
  statusTag:
    | 'Remains Suitable'
    | 'Becomes Less Suitable'
    | 'More Compatible Alternative'
    | 'Marginally Suitable';
  waterNeedMm: [number, number];
  irrigationDependency: IrrigationDependency;
}

export interface ScenarioSimulationResult {
  status: 'ready' | 'missing_baseline_climate';
  limitationReason: string | null;
  farm: Farm | null;
  config: ClimateScenarioConfig;
  baselineClimate: ScenarioClimateSnapshot | null;
  simulatedClimate: ScenarioClimateSnapshot | null;
  primaryBaselineEval: CropSuitabilityEvaluation | null;
  primarySimulatedEval: CropSuitabilityEvaluation | null;
  allCropDeltas: ScenarioCropDelta[];
  risks: ScenarioRiskItem[];
  highestRiskLevel: ScenarioRiskLevel;
  recommendations: {
    remainsSuitable: ScenarioCropDelta[];
    becomesLessSuitable: ScenarioCropDelta[];
    betterAlternatives: ScenarioCropDelta[];
    irrigationGuidance: string[];
    priorityRisks: ScenarioRiskItem[];
    assumptionsAndLimitations: string[];
  };
}

export interface ScenarioComparisonEntry {
  scenario: SavedClimateScenario;
  result: ScenarioSimulationResult;
}

export interface ScenarioComparisonSummary {
  entries: ScenarioComparisonEntry[];
  chartData: Array<{
    metric: string;
    [scenarioId: string]: string | number;
  }>;
  truncatedFromCount: number;
}

export type DecisionCategoryId = 'climate' | 'water' | 'soil' | 'rotation';

export interface DecisionWeights {
  climate: number;
  water: number;
  soil: number;
  rotation: number;
}

export interface NormalizedDecisionWeights {
  raw: DecisionWeights;
  effectivePct: DecisionWeights;
  totalRaw: number;
  allWeightsZero: boolean;
  isDefault: boolean;
}

export interface DecisionCategoryBreakdown {
  id: DecisionCategoryId;
  label: string;
  rawScore: number | null;
  status: 'evaluated' | 'partial' | 'unavailable';
  effectiveWeightPct: number;
  contribution: number;
  detail: string;
}

export interface EvaluatedScenarioDecision {
  id: string;
  label: string;
  isBaselineReference: boolean;
  rank: number | null;
  status: 'evaluated' | 'insufficient_data';
  weightedScore: number | null;
  evaluatedWeightPct: number;
  missingWeightPct: number;
  unavailableCategories: DecisionCategoryId[];
  partialCategories: DecisionCategoryId[];
  categoryBreakdowns: DecisionCategoryBreakdown[];
  overallCropSuitability: number | null;
  seasonalSuitabilityScore: number | null;
  effectiveAvailableWaterMm: number | null;
  effectiveIrrigation: IrrigationType | null;
  rainfallStressLevel: ScenarioRiskLevel | null;
  heatStressLevel: ScenarioRiskLevel | null;
  overallRiskLevel: ScenarioRiskLevel | null;
  confidenceLevel: ConfidenceLevel;
  dataCompletenessPct: number;
  cropName: string;
  rotationStatus: 'clean' | 'conflict' | 'unknown';
  primaryEvaluatedResult: ScenarioSimulationResult;
}

export interface DecisionSensitivityScenarioDiff {
  id: string;
  label: string;
  previousRank: number | null;
  currentRank: number | null;
  rankDelta: number | null;
  previousScore: number | null;
  currentScore: number | null;
  scoreDelta: number | null;
  responsibleCategories: Array<{
    id: DecisionCategoryId;
    label: string;
    weightDeltaPct: number;
    contributionDelta: number;
  }>;
}

export interface DecisionSensitivityResult {
  hasWeightChanges: boolean;
  rankingChanged: boolean;
  previousWeights: NormalizedDecisionWeights;
  currentWeights: NormalizedDecisionWeights;
  weightDeltas: Array<{
    id: DecisionCategoryId;
    label: string;
    previousPct: number;
    currentPct: number;
    deltaPct: number;
  }>;
  scenarioDiffs: DecisionSensitivityScenarioDiff[];
  summary: string;
}

export interface BestSupportedRecommendation {
  status: 'winner' | 'tie' | 'insufficient_data';
  headline: string;
  winnerIds: string[];
  winnerNames: string[];
  topScore: number | null;
  marginPts: number | null;
  whyRankedFirst: string[];
  topContributingCategories: DecisionCategoryBreakdown[];
  underperformingCategories: DecisionCategoryBreakdown[];
  remainingRisks: ScenarioRiskItem[];
  confidenceAssessment: string;
  hasSufficientConfidence: boolean;
}

export interface MultiScenarioDecisionReport {
  farmId: string | null;
  evaluatedAtStatus: 'ready' | 'insufficient_data' | 'zero_weights';
  limitationReason: string | null;
  normalizedWeights: NormalizedDecisionWeights;
  candidates: EvaluatedScenarioDecision[];
  rankedSavedScenarios: EvaluatedScenarioDecision[];
  baselineReference: EvaluatedScenarioDecision | null;
  recommendation: BestSupportedRecommendation;
  truncatedFromCount: number;
}

export interface FarmDecisionPreferences {
  farmId: string;
  selectedScenarioIds: string[];
  weights: DecisionWeights;
  includeBaselineReference: boolean;
  lastBaselinePreset: '30d' | '90d' | 'growing2026' | 'season2025' | 'custom';
  lastBaselineStartDate?: string;
  lastBaselineEndDate?: string;
  updatedAt: string;
}





