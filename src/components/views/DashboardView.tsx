import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarRange,
  GitCompareArrows,
  Plus,
  RefreshCw,
  Satellite,
  SlidersHorizontal,
  Sprout,
} from 'lucide-react';
import { useMemo } from 'react';
import { CROP_KNOWLEDGE_DATABASE } from '../../data/cropKnowledgeDb';
import type { UseNasaPowerClimateResult } from '../../hooks/useNasaPowerClimate';
import {
  calculateClimateSuitability,
  calculateRotationEfficiency,
  filterClimateByRange,
  formatArea,
  formatRainfall,
  formatRangeLabel,
  formatTemp,
  getRecommendedNextCrops,
  type ClimateDateRange,
} from '../../lib/agronomy';
import { evaluateRotationPlan, loadPlansForFarm } from '../../lib/rotationPlannerEngine';
import { IRRIGATION_MODE_LABELS, loadScenariosForFarm } from '../../lib/scenarioSimulationEngine';
import type {
  ActivityItem,
  CropProfile,
  Farm,
  FarmClimateProfile,
  NavSection,
  SavedClimateScenario,
  SavedRotationPlan,
} from '../../types/rotatewise';
import { RainfallTrendChart, TemperatureTrendChart } from '../charts/ClimateCharts';
import { DateRangeFilter } from '../common/DateRangeFilter';
import { MetricTooltip } from '../common/MetricTooltip';
import {
  DashboardLoadingSkeleton,
  EmptyState,
  ErrorBanner,
} from '../common/StateFeedback';
import { Button } from '../ui/Button';
import { DataClassificationBadge } from '../ui/DataClassificationBadge';
import { PageHeader } from '../ui/PageHeader';

interface DashboardViewProps {
  farm: Farm | null;
  climate: FarmClimateProfile | null;
  climateLoading: boolean;
  climateError: string | null;
  onRetryClimate: () => void;
  onDismissClimateError: () => void;
  nasaClimate: UseNasaPowerClimateResult;
  dateRange: ClimateDateRange;
  onChangeDateRange: (next: ClimateDateRange) => void;
  cropCatalog: CropProfile[];
  savedRotationPlans: SavedRotationPlan[];
  savedScenarios: SavedClimateScenario[];
  activities: ActivityItem[];
  unitSystem: 'imperial' | 'metric';
  onNavigate: (section: NavSection) => void;
  onAddRecommendedToRotation: (crop: CropProfile) => void;
  onOpenAddFarm: () => void;
}

function getCropDisplayName(cropId: string): string {
  return (
    CROP_KNOWLEDGE_DATABASE.find((c) => c.id === cropId)?.name ??
    cropId.replace(/_/g, ' ')
  );
}

export function DashboardView({
  farm,
  climate,
  climateLoading,
  climateError,
  onRetryClimate,
  onDismissClimateError,
  nasaClimate,
  dateRange,
  onChangeDateRange,
  cropCatalog,
  savedRotationPlans,
  savedScenarios,
  activities,
  unitSystem,
  onNavigate,
  onAddRecommendedToRotation,
  onOpenAddFarm,
}: DashboardViewProps) {
  const farmPlans = useMemo(
    () => loadPlansForFarm(savedRotationPlans, farm),
    [savedRotationPlans, farm]
  );
  const primaryPlan = farmPlans.find((p) => p.isPrimary) ?? farmPlans[0] ?? null;
  const farmScenarios = useMemo(
    () => loadScenariosForFarm(savedScenarios, farm),
    [savedScenarios, farm]
  );

  const nasaDataset = nasaClimate.status === 'success' ? nasaClimate.data : null;

  const primaryPlanEvaluation = useMemo(() => {
    if (!farm || !primaryPlan) return null;
    return evaluateRotationPlan(primaryPlan.steps, farm, nasaDataset);
  }, [farm, primaryPlan, nasaDataset]);

  if (climateLoading) {
    return <DashboardLoadingSkeleton />;
  }

  if (!farm || !climate) {
    return (
      <EmptyState
        title="No Active Farm Selected"
        description="Add a farm parcel to view NASA POWER meteorological observations, crop suitability rankings, and multi-season rotation plans."
        actionLabel="Add First Farm"
        onAction={onOpenAddFarm}
      />
    );
  }

  const currentCropProfile =
    cropCatalog.find((c) => c.id === farm.currentCropId) ?? cropCatalog[0];
  const rotationEval = calculateRotationEfficiency(farm.rotationPlan, cropCatalog, farm);
  const climateSuitability = calculateClimateSuitability(
    currentCropProfile,
    climate,
    farm.irrigation
  );
  const recommendations = getRecommendedNextCrops(farm, climate, cropCatalog);
  const topRecommendation = recommendations[0];

  const filteredMonthly = filterClimateByRange(climate.monthly, dateRange);
  const rangeLabel = formatRangeLabel(dateRange);
  const effectiveRotationScore =
    primaryPlanEvaluation?.overallScore ?? rotationEval.efficiencyScore;
  const riskCount =
    primaryPlanEvaluation?.identifiedRisks.length ?? rotationEval.warnings.length;

  const riskIndicators: Array<{
    label: string;
    severity: 'Low' | 'Moderate' | 'High';
    detail: string;
    target: NavSection;
  }> = [
    {
      label: 'Seasonal Drought Exposure',
      severity:
        climate.droughtRiskLevel === 'Elevated'
          ? 'High'
          : climate.droughtRiskLevel === 'Moderate'
            ? 'Moderate'
            : 'Low',
      detail: `${climate.droughtRiskLevel} risk · ${farm.irrigation}`,
      target: 'simulator',
    },
    {
      label: 'Rotation Pest & Family Risk',
      severity:
        (primaryPlanEvaluation?.identifiedRisks.length ?? 0) > 1
          ? 'High'
          : (primaryPlanEvaluation?.identifiedRisks.length ?? 0) === 1
            ? 'Moderate'
            : 'Low',
      detail:
        primaryPlanEvaluation && primaryPlanEvaluation.identifiedRisks.length > 0
          ? primaryPlanEvaluation.identifiedRisks[0]
          : 'No consecutive family or carryover conflicts detected.',
      target: 'planner',
    },
    {
      label: 'Soil pH & Moisture Buffering',
      severity:
        farm.health.phLevel < 5.5 || farm.health.phLevel > 7.8
          ? 'High'
          : farm.health.moistureRetentionScore < 70
            ? 'Moderate'
            : 'Low',
      detail: `pH ${farm.health.phLevel.toFixed(1)} · Moisture retention ${farm.health.moistureRetentionScore}/100`,
      target: 'farms',
    },
  ];

  const healthIndicators = [
    {
      label: 'Soil Organic Matter',
      value: `${farm.health.organicMatterPct.toFixed(1)}%`,
      score: Math.min(100, Math.round(farm.health.organicMatterPct * 20)),
      note: 'Target > 3.5% for stable moisture buffering',
      tooltip:
        'Percentage of stabilized organic carbon in topsoil driving nutrient cycling and aggregate structure.',
    },
    {
      label: 'Nitrogen Balance',
      value: `${farm.health.nitrogenBalanceScore}/100`,
      score: farm.health.nitrogenBalanceScore,
      note: 'Derived from legume credits vs cereal uptake',
      tooltip:
        'Balances biological nitrogen fixation from legumes against removal by heavy-feeding cereal crops.',
    },
    {
      label: 'Moisture Retention',
      value: `${farm.health.moistureRetentionScore}/100`,
      score: farm.health.moistureRetentionScore,
      note: `${farm.soilType} · ${farm.irrigation}`,
      tooltip:
        'Estimated root-zone water-holding resilience combining soil texture and irrigation availability.',
    },
    {
      label: 'Pest-Break Diversity',
      value: `${rotationEval.pestBreakScore}/100`,
      score: rotationEval.pestBreakScore,
      note: `${rotationEval.familyDiversityScore}/100 botanical family variance`,
      tooltip:
        'Measures interruption of host-specific weeds, nematodes, and soil-borne pathogens across seasons.',
    },
  ];

  const soilRating =
    farm.health.soilHealthScore >= 82
      ? 'Strong'
      : farm.health.soilHealthScore >= 70
        ? 'Healthy'
        : 'Needs Attention';

  return (
    <div className="space-y-8">
      {climateError && (
        <ErrorBanner
          title="Seasonal Climate Endpoint Fallback"
          message={climateError}
          onRetry={onRetryClimate}
          onDismiss={onDismissClimateError}
        />
      )}

      <PageHeader
        breadcrumb="Overview"
        title={farm.name}
        subtitle="Parcel agronomy intelligence, historical NASA POWER climate telemetry, and multi-season rotation posture."
        classification={farm.isDemo ? 'demo' : undefined}
        metadata={
          <>
            <span className="font-medium text-[#18231E]">{farm.location}</span>
            <span className="text-[#C5CEC7]" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {farm.coordinates.lat.toFixed(4)}°, {farm.coordinates.lng.toFixed(4)}°
            </span>
            <span className="text-[#C5CEC7]" aria-hidden="true">·</span>
            <span>
              {farm.soilType} (pH {farm.health.phLevel.toFixed(1)})
            </span>
            <span className="text-[#C5CEC7]" aria-hidden="true">·</span>
            <span>{farm.irrigation}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => onNavigate('planner')}>
              <CalendarRange className="h-4 w-4 text-[#287A5A]" aria-hidden="true" />
              <span>Rotation Planner</span>
            </Button>
            <Button variant="primary" onClick={() => onNavigate('simulator')}>
              <span>Simulate Climate</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        }
      />

      {/* Asymmetric Editorial Hero Band: Dark Telemetry Highlight + Open Agronomic Scorecard */}
      <section
        aria-label="Parcel telemetry and agronomic posture"
        className="grid grid-cols-1 gap-5 lg:grid-cols-12"
      >
        {/* Dark Surface (#14251D): NASA POWER Live Meteorological Feed + Parcel Identity */}
        <div className="flex flex-col justify-between rounded-2xl bg-[#14251D] p-6 text-white lg:col-span-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[#A8CBB7]">
                <Satellite className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>NASA POWER (AG) Telemetry</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#DCEADF]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    nasaDataset
                      ? 'bg-[#4ADE80]'
                      : nasaClimate.status === 'loading'
                        ? 'bg-[#FBBF24]'
                        : 'bg-[#F87171]'
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {nasaDataset
                    ? 'Historical Observation'
                    : nasaClimate.status === 'loading'
                      ? 'Retrieving Feed'
                      : 'Feed Unavailable'}
                </span>
              </span>
            </div>

            {nasaDataset ? (
              <div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
                <div>
                  <span className="text-[11px] text-[#9EB2A6]">Mean Temp</span>
                  <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-white">
                    {nasaDataset.summary.meanTempC !== null
                      ? formatTemp(nasaDataset.summary.meanTempC, unitSystem)
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#9EB2A6]">Rainfall</span>
                  <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-white">
                    {nasaDataset.summary.totalRainfallMm !== null
                      ? formatRainfall(nasaDataset.summary.totalRainfallMm, unitSystem)
                      : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#9EB2A6]">Humidity</span>
                  <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums text-white">
                    {nasaDataset.summary.avgHumidityPct !== null
                      ? `${nasaDataset.summary.avgHumidityPct.toFixed(0)}%`
                      : '—'}
                  </p>
                </div>
              </div>
            ) : nasaClimate.status === 'loading' ? (
              <p className="mt-5 border-t border-white/10 pt-5 text-xs leading-relaxed text-[#BFD0C5]">
                Requesting daily meteorological telemetry for {farm.coordinates.lat.toFixed(2)}°,{' '}
                {farm.coordinates.lng.toFixed(2)}°...
              </p>
            ) : (
              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-xs leading-relaxed text-[#FCA5A5]">
                  {nasaClimate.error ??
                    'Historical daily observations could not be retrieved. Demonstration data is never substituted for NASA telemetry.'}
                </p>
                <button
                  type="button"
                  onClick={nasaClimate.refresh}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Retry NASA Feed</span>
                </button>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-xs">
              <div>
                <span className="text-[#9EB2A6]">Current Crop</span>
                <p className="mt-0.5 font-medium text-white">{farm.currentCropName}</p>
                <p className="text-[11px] text-[#9EB2A6]">{currentCropProfile.family}</p>
              </div>
              <div>
                <span className="text-[#9EB2A6]">Total Farm Area</span>
                <p className="mt-0.5 font-mono font-medium tabular-nums text-white">
                  {formatArea(farm.landAreaAcres, unitSystem)}
                </p>
                <p className="text-[11px] text-[#9EB2A6]">{farm.plantingStage}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
            <span className="font-mono text-[11px] tabular-nums text-[#9EB2A6]">
              {nasaDataset
                ? `${nasaDataset.startDate} → ${nasaDataset.endDate} (${nasaDataset.summary.validDayCount}d)`
                : `${climate.frostFreeDays} frost-free days`}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('climate')}
              className="inline-flex items-center gap-1.5 font-medium text-[#A8CBB7] transition-colors hover:text-white"
            >
              <span>Climate Insights</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Light Surface: Open Agronomic Scorecard + Soil Resilience Breakdown */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E7EBE7] bg-white p-6 lg:col-span-7">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <div>
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Soil Health</span>
                <MetricTooltip
                  label="Soil Health Indicator"
                  description="Composite soil vitality score combining organic matter percentage, topsoil pH stability, moisture retention, and nitrogen reserves."
                />
              </span>
              <p className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.025em] tabular-nums text-[#18231E]">
                {farm.health.soilHealthScore}
                <span className="ml-0.5 text-sm font-normal text-[#737D76]">/100</span>
              </p>
              <p className="mt-1 text-xs font-medium text-[#287A5A]">{soilRating}</p>
            </div>

            <div>
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Climate Fit</span>
                <MetricTooltip
                  label="Climate Suitability Score"
                  description="Measures how well the active crop matches the parcel's growing-season temperatures, rainfall, frost-free window, and irrigation."
                />
              </span>
              <p className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.025em] tabular-nums text-[#18231E]">
                {climateSuitability}
                <span className="ml-0.5 text-sm font-normal text-[#737D76]">/100</span>
              </p>
              <p className="mt-1 text-xs text-[#737D76]">
                {climate.droughtRiskLevel} drought risk
              </p>
            </div>

            <div>
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Rotation Score</span>
                <MetricTooltip
                  label="Rotation Efficiency Score"
                  description="Multi-season score weighting botanical family diversity, nitrogen balance, pest interruption, and root-depth alternation."
                />
              </span>
              <p className="mt-1.5 font-display text-3xl font-semibold tracking-[-0.025em] tabular-nums text-[#174C3C]">
                {effectiveRotationScore}
                <span className="ml-0.5 text-sm font-normal text-[#737D76]">/100</span>
              </p>
              <p className={`mt-1 text-xs ${riskCount > 0 ? 'font-medium text-[#9A5B00]' : 'text-[#737D76]'}`}>
                {riskCount === 0 ? 'Balanced sequence' : `${riskCount} risk flag(s)`}
              </p>
            </div>

            <div>
              <span className="flex items-center gap-1 text-xs font-medium text-[#737D76]">
                <span>Next Crop</span>
                <MetricTooltip
                  label="Recommended Next Crop"
                  description="Top-ranked follow-on crop maximizing nitrogen restoration, botanical family rotation, and climate alignment."
                />
              </span>
              <p className="mt-1.5 truncate font-display text-xl font-semibold tracking-[-0.02em] text-[#18231E] sm:text-2xl">
                {topRecommendation ? topRecommendation.crop.name : '—'}
              </p>
              <p className="mt-1 font-sans text-xs whitespace-nowrap text-[#737D76] tabular-nums">
                {topRecommendation
                  ? `${topRecommendation.suitabilityScore}/100 · ${
                      topRecommendation.nitrogenGainKgHa >= 0
                        ? `+${topRecommendation.nitrogenGainKgHa}`
                        : topRecommendation.nitrogenGainKgHa
                    } kg/ha N`
                  : 'Configure catalog'}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-[#E7EBE7] pt-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-[#18231E]">
                Soil &amp; Field Resilience Breakdown
              </h2>
              <span className="text-xs text-[#737D76]">
                {farm.health.organicMatterPct.toFixed(1)}% OM · pH {farm.health.phLevel.toFixed(1)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
              {healthIndicators.map((ind) => (
                <div key={ind.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-[#18231E]">
                      <span>{ind.label}</span>
                      <MetricTooltip label={ind.label} description={ind.tooltip} />
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-[#174C3C]">
                      {ind.value}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EEF1EE]">
                    <div
                      className="h-full rounded-full bg-[#287A5A]"
                      style={{ width: `${ind.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Date-Range Controls + Rainfall & Temperature Charts */}
      <section aria-label="Seasonal baseline climate charts" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-xl font-semibold tracking-[-0.015em] text-[#18231E]">
              Seasonal Climate Envelope
            </h2>
            <DataClassificationBadge category="demo" />
          </div>
          <DateRangeFilter value={dateRange} onChange={onChangeDateRange} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <RainfallTrendChart
            monthly={filteredMonthly}
            unitSystem={unitSystem}
            rangeLabel={rangeLabel}
          />
          <TemperatureTrendChart
            monthly={filteredMonthly}
            unitSystem={unitSystem}
            rangeLabel={rangeLabel}
          />
        </div>
      </section>

      {/* Editorial Two-Column Workspace: Left (Rotation & Recommendations) / Right (Risks, Scenarios, Activity) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {/* Crop Rotation Timeline */}
          <div className="rounded-2xl border border-[#E7EBE7] bg-white p-6">
            <div className="flex items-start justify-between gap-3 border-b border-[#E7EBE7] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                    <span>Active Rotation Sequence</span>
                    <MetricTooltip
                      label="Crop Rotation Timeline"
                      description="Chronological sequence of completed, active, and planned crops with nitrogen gain or depletion per hectare."
                    />
                  </h2>
                  <DataClassificationBadge category="rotation" customLabel="Rotation" />
                </div>
                <p className="mt-1 text-xs text-[#737D76]">
                  {primaryPlan && primaryPlanEvaluation
                    ? `${primaryPlan.name} · ${primaryPlan.steps.length} stages across ${primaryPlanEvaluation.uniqueFamilies.length} families (${primaryPlanEvaluation.netNitrogenKgHa >= 0 ? `+${primaryPlanEvaluation.netNitrogenKgHa}` : primaryPlanEvaluation.netNitrogenKgHa} kg/ha N)`
                    : 'Sequential field history and upcoming seasonal schedule'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#174C3C] hover:underline whitespace-nowrap"
              >
                <span>Open Planner ({farmPlans.length})</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {farm.rotationPlan.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#737D76]">
                <p>No rotation seasons scheduled yet.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('planner')}
                  className="mt-2 font-semibold text-[#174C3C] hover:underline"
                >
                  Create Rotation Plan
                </button>
              </div>
            ) : (
              <div className="mt-2 divide-y divide-[#E7EBE7]">
                {farm.rotationPlan.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF2EC] font-mono text-xs font-semibold tabular-nums text-[#174C3C]">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#18231E]">
                          {step.cropName}
                        </p>
                        <p className="text-xs text-[#737D76]">
                          {step.season} · {step.family}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-10 text-xs tabular-nums sm:pl-0">
                      <span className="font-mono text-[#737D76]">
                        N:{' '}
                        {step.nitrogenImpactKgHa >= 0
                          ? `+${step.nitrogenImpactKgHa}`
                          : step.nitrogenImpactKgHa}{' '}
                        kg/ha
                      </span>
                      <span
                        className={`font-medium ${
                          step.status === 'active'
                            ? 'text-[#174C3C]'
                            : step.status === 'completed'
                              ? 'text-[#737D76]'
                              : 'text-[#287A5A]'
                        }`}
                      >
                        {step.status === 'active'
                          ? 'Active Season'
                          : step.status === 'completed'
                            ? 'Completed'
                            : 'Planned'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Crop Suitability Candidates */}
          <div className="rounded-2xl border border-[#E7EBE7] bg-white p-6">
            <div className="flex items-start justify-between gap-3 border-b border-[#E7EBE7] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                    <span>Recommended Next Crops</span>
                    <MetricTooltip
                      label="Crop Recommendations"
                      description="Candidates scored by climate compatibility, soil preference, botanical family change, and nitrogen impact."
                    />
                  </h2>
                  <DataClassificationBadge category="suitability" />
                </div>
                <p className="mt-1 text-xs text-[#737D76]">
                  Ranked by climate fit, nitrogen recovery, and pest break (no yield/profit forecasts)
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('crops')}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#174C3C] hover:underline whitespace-nowrap"
              >
                <span>All 10 Crops</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-2 divide-y divide-[#E7EBE7]">
              {recommendations.slice(0, 3).map((rec) => (
                <div key={rec.crop.id} className="py-4 first:pt-2 last:pb-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="font-display text-[15px] font-semibold text-[#18231E]">
                          {rec.crop.name}
                        </h3>
                        <span className="text-xs text-[#737D76]">
                          {rec.crop.family} · {rec.fitLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#737D76]">
                        {rec.rationale}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums text-[#737D76]">
                        <span className="font-semibold text-[#174C3C]">
                          Suitability {rec.suitabilityScore}/100
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          N Impact{' '}
                          {rec.nitrogenGainKgHa >= 0
                            ? `+${rec.nitrogenGainKgHa}`
                            : rec.nitrogenGainKgHa}{' '}
                          kg/ha
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Root: {rec.crop.rootDepth}</span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onAddRecommendedToRotation(rec.crop)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Add to Plan</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Risk Posture, Saved Scenarios, Recent Activity */}
        <div className="space-y-6 lg:col-span-5">
          {/* Risk Indicators */}
          <div className="rounded-2xl border border-[#E7EBE7] bg-white p-6">
            <div className="flex items-center justify-between gap-2 border-b border-[#E7EBE7] pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#9A5B00]" aria-hidden="true" />
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                  Agricultural Risk Indicators
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('crops')}
                className="text-xs font-semibold text-[#174C3C] hover:underline"
              >
                Inspect Fit
              </button>
            </div>

            <div className="mt-2 divide-y divide-[#E7EBE7]">
              {riskIndicators.map((risk) => {
                const severityColor =
                  risk.severity === 'High'
                    ? 'text-[#B91C1C]'
                    : risk.severity === 'Moderate'
                      ? 'text-[#9A5B00]'
                      : 'text-[#174C3C]';
                return (
                  <button
                    key={risk.label}
                    type="button"
                    onClick={() => onNavigate(risk.target)}
                    className="group w-full py-3.5 text-left transition-colors first:pt-2 last:pb-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#18231E] group-hover:text-[#174C3C]">
                        {risk.label}
                      </span>
                      <span className={`font-semibold ${severityColor}`}>
                        {risk.severity}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#737D76]">
                      {risk.detail}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hypothetical Climate Scenarios */}
          <div className="rounded-2xl border border-[#E7EBE7] bg-white p-6">
            <div className="flex items-center justify-between gap-2 border-b border-[#E7EBE7] pb-4">
              <div className="flex min-w-0 items-center gap-2">
                <SlidersHorizontal
                  className="h-4 w-4 shrink-0 text-[#174C3C]"
                  aria-hidden="true"
                />
                <h2 className="truncate font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                  Climate Scenarios
                </h2>
              </div>
              <DataClassificationBadge category="scenario" customLabel="Hypothetical" />
            </div>

            {farmScenarios.length > 0 ? (
              <div className="mt-2 divide-y divide-[#E7EBE7]">
                {farmScenarios.slice(0, 3).map((scen) => (
                  <div key={scen.id} className="py-3 text-xs first:pt-2 last:pb-1">
                    <p className="font-semibold text-[#18231E]">{scen.name}</p>
                    <p className="mt-1 font-mono text-[11px] tabular-nums text-[#737D76]">
                      Rain{' '}
                      {scen.config.rainfallDeltaPct >= 0
                        ? `+${scen.config.rainfallDeltaPct}`
                        : scen.config.rainfallDeltaPct}
                      % · Temp{' '}
                      {scen.config.temperatureShiftC >= 0
                        ? `+${scen.config.temperatureShiftC}`
                        : scen.config.temperatureShiftC}
                      °C · {getCropDisplayName(scen.config.primaryCropId)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#737D76]">
                      {IRRIGATION_MODE_LABELS[scen.config.irrigationMode]}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-[#737D76]">
                No hypothetical scenarios saved for {farm.name}. Test rainfall deficits and heat shifts in the Simulator.
              </p>
            )}

            <button
              type="button"
              onClick={() => onNavigate('simulator')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#174C3C] hover:underline"
            >
              <span>Open Scenario Simulator ({farmScenarios.length})</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Recent Workspace Activity */}
          <div className="rounded-2xl border border-[#E7EBE7] bg-white p-6">
            <div className="border-b border-[#E7EBE7] pb-3.5">
              <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em] text-[#18231E]">
                Recent Activity
              </h2>
            </div>
            {activities.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#737D76]">
                No recent activity recorded yet.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-[#E7EBE7]">
                {activities.slice(0, 4).map((item) => (
                  <div key={item.id} className="py-3 first:pt-2 last:pb-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#18231E]">
                        {item.action}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-[#737D76]">
                        {item.timestamp}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#737D76]">{item.detail}</p>
                    <p className="mt-0.5 text-[11px] text-[#737D76]">
                      {item.farmName}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Analytical Modules Quick Access Strip */}
      <section aria-label="Quick navigation to analytical tools" className="border-t border-[#E7EBE7] pt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { id: 'climate' as NavSection, label: 'NASA Climate', icon: Satellite },
            { id: 'crops' as NavSection, label: 'Crop Intelligence', icon: Sprout },
            { id: 'comparison' as NavSection, label: 'Compare Crops', icon: GitCompareArrows },
            { id: 'planner' as NavSection, label: 'Rotation Planner', icon: CalendarRange },
            { id: 'simulator' as NavSection, label: 'Scenario Engine', icon: SlidersHorizontal },
            { id: 'advisor' as NavSection, label: 'AI Farm Advisor', icon: Bot },
          ].map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onNavigate(tool.id)}
                className="flex min-h-[48px] items-center gap-2.5 rounded-2xl border border-[#E7EBE7] bg-white px-4 py-3 text-left text-xs font-semibold text-[#18231E] transition-all duration-150 hover:border-[#174C3C]/40 hover:bg-[#EAF2EC]/40"
              >
                <Icon className="h-4 w-4 shrink-0 text-[#287A5A]" aria-hidden="true" />
                <span className="truncate">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
