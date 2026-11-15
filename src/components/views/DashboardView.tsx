import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarRange,
  CheckCircle2,
  CloudRain,
  Compass,
  GitCompareArrows,
  Leaf,
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
import { KpiCard } from '../common/KpiCard';
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
    <div className="space-y-6">
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
        subtitle={`Parcel agronomy intelligence, historical NASA POWER climate context, and active rotation posture.`}
        classification={farm.isDemo ? 'demo' : undefined}
        metadata={
          <>
            <span>{farm.location}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {farm.coordinates.lat.toFixed(4)}°, {farm.coordinates.lng.toFixed(4)}°
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {farm.soilType} (pH {farm.health.phLevel.toFixed(1)})
            </span>
            <span aria-hidden="true">·</span>
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

      {/* Real NASA POWER Telemetry Status Banner */}
      <section
        aria-label="NASA POWER meteorological status"
        className="rounded-xl border border-[#E1E8E2] bg-white p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF2EC] text-[#174C3C]">
              <Satellite className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-sm font-semibold text-[#17231E]">
                  NASA POWER (AG) Meteorological Feed
                </h2>
                <DataClassificationBadge
                  category={nasaDataset ? 'nasa' : 'insufficient'}
                  customLabel={
                    nasaDataset
                      ? 'NASA Historical Observation'
                      : nasaClimate.status === 'loading'
                        ? 'Retrieving NASA POWER'
                        : 'NASA Data Unavailable'
                  }
                />
              </div>

              {nasaDataset ? (
                <p className="mt-1 text-xs text-[#65736B]">
                  Window{' '}
                  <span className="font-mono tabular-nums text-[#17231E]">
                    {nasaDataset.startDate} to {nasaDataset.endDate}
                  </span>{' '}
                  ({nasaDataset.summary.validDayCount} days) · Mean Temp{' '}
                  <strong className="font-mono tabular-nums text-[#17231E]">
                    {nasaDataset.summary.meanTempC !== null
                      ? formatTemp(nasaDataset.summary.meanTempC, unitSystem)
                      : '—'}
                  </strong>{' '}
                  · Observed Rainfall{' '}
                  <strong className="font-mono tabular-nums text-[#17231E]">
                    {nasaDataset.summary.totalRainfallMm !== null
                      ? formatRainfall(nasaDataset.summary.totalRainfallMm, unitSystem)
                      : '—'}
                  </strong>{' '}
                  · RH{' '}
                  <strong className="font-mono tabular-nums text-[#17231E]">
                    {nasaDataset.summary.avgHumidityPct !== null
                      ? `${nasaDataset.summary.avgHumidityPct.toFixed(1)}%`
                      : '—'}
                  </strong>
                </p>
              ) : nasaClimate.status === 'loading' ? (
                <p className="mt-1 text-xs text-[#65736B]">
                  Requesting daily meteorological telemetry for {farm.coordinates.lat.toFixed(2)}°,{' '}
                  {farm.coordinates.lng.toFixed(2)}°...
                </p>
              ) : (
                <p className="mt-1 text-xs text-[#991B1B]">
                  {nasaClimate.error ??
                    'Historical daily observations could not be retrieved. Demonstration data is never substituted for NASA telemetry.'}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {nasaClimate.status === 'error' && (
              <Button variant="outline" size="sm" onClick={nasaClimate.refresh}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Retry NASA</span>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('climate')}
            >
              <span>Open Climate Insights</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      {/* 6 Primary KPI Cards */}
      <section
        aria-label="Farm key performance indicators"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <KpiCard
          label="Total Farm Area"
          value={formatArea(farm.landAreaAcres, unitSystem)}
          subtitle={`${farm.soilType} · pH ${farm.health.phLevel.toFixed(1)}`}
          icon={Compass}
          tooltip="Total managed acreage or hectares for the active farm parcel, converted automatically by your unit setting."
        />
        <KpiCard
          label="Current Crop"
          value={farm.currentCropName}
          subtitle={`${currentCropProfile.family} · ${farm.plantingStage}`}
          icon={Sprout}
          tooltip="Active seasonal crop currently growing on this parcel, used as the baseline for pest-break and nitrogen calculations."
        />
        <KpiCard
          label="Soil Health Indicator"
          value={String(farm.health.soilHealthScore)}
          suffix="/100"
          subtitle={`${soilRating} · ${farm.health.organicMatterPct.toFixed(1)}% Organic Matter`}
          subtitleTone="positive"
          icon={Leaf}
          tooltip="Composite soil vitality score combining organic matter percentage, topsoil pH stability, moisture retention, and nitrogen reserves."
        />
        <KpiCard
          label="Climate Suitability Score"
          value={String(climateSuitability)}
          suffix="/100"
          subtitle={`Drought risk: ${climate.droughtRiskLevel} · ${climate.frostFreeDays} frost-free days`}
          icon={CloudRain}
          tooltip="Measures how well the active crop matches the parcel's growing-season temperatures, rainfall, frost-free window, and irrigation."
        />
        <KpiCard
          label="Recommended Next Crop"
          value={topRecommendation ? topRecommendation.crop.name : '—'}
          subtitle={
            topRecommendation
              ? `${topRecommendation.suitabilityScore}/100 fit · ${topRecommendation.nitrogenGainKgHa >= 0 ? `+${topRecommendation.nitrogenGainKgHa}` : topRecommendation.nitrogenGainKgHa} kg/ha N`
              : 'Configure crop catalog'
          }
          icon={CheckCircle2}
          tooltip="Top-ranked follow-on crop maximizing nitrogen restoration, botanical family rotation, and climate alignment."
        />
        <KpiCard
          label="Rotation Efficiency Score"
          value={String(primaryPlanEvaluation?.overallScore ?? rotationEval.efficiencyScore)}
          suffix="/100"
          subtitle={`${(primaryPlan?.steps ?? farm.rotationPlan).length} stages · ${
            (primaryPlanEvaluation?.identifiedRisks.length ?? rotationEval.warnings.length) === 0
              ? 'Balanced sequence'
              : `${primaryPlanEvaluation?.identifiedRisks.length ?? rotationEval.warnings.length} risk flag(s)`
          }`}
          subtitleTone={
            (primaryPlanEvaluation?.identifiedRisks.length ?? rotationEval.warnings.length) > 0
              ? 'warning'
              : 'neutral'
          }
          icon={CalendarRange}
          tooltip="Multi-season score weighting botanical family diversity, nitrogen balance, pest interruption, and root-depth alternation."
        />
      </section>

      {/* Active Rotation Plan Summary + Saved Scenarios Summary + Risk Indicators */}
      <section
        aria-label="Planning posture and agricultural risk overview"
        className="grid grid-cols-1 gap-5 lg:grid-cols-3"
      >
        {/* Active Rotation Plan Summary */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E1E8E2] bg-white p-5">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-[#E1E8E2] pb-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-[#174C3C]" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-[#17231E]">
                  Active Rotation Plan
                </h2>
              </div>
              <DataClassificationBadge category="rotation" customLabel="Rotation" />
            </div>

            {primaryPlan && primaryPlanEvaluation ? (
              <div className="mt-3.5 space-y-2.5 text-xs">
                <p className="font-semibold text-[#17231E]">{primaryPlan.name}</p>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F7F8F5] p-3">
                  <div>
                    <span className="text-[#65736B]">Plan Score</span>
                    <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-[#174C3C]">
                      {primaryPlanEvaluation.overallScore}/100
                    </p>
                  </div>
                  <div>
                    <span className="text-[#65736B]">Net N Balance</span>
                    <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-[#17231E]">
                      {primaryPlanEvaluation.netNitrogenKgHa >= 0
                        ? `+${primaryPlanEvaluation.netNitrogenKgHa}`
                        : primaryPlanEvaluation.netNitrogenKgHa}{' '}
                      kg/ha
                    </p>
                  </div>
                </div>
                <p className="text-[#65736B]">
                  {primaryPlan.steps.length} seasonal stages across{' '}
                  {primaryPlanEvaluation.uniqueFamilies.length} botanical families (
                  {primaryPlanEvaluation.scoreLabel}).
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs text-[#65736B]">
                No rotation plan saved for this parcel yet.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('planner')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#174C3C] hover:underline"
          >
            <span>Manage Rotation Plans ({farmPlans.length})</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Saved Scenarios Summary */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E1E8E2] bg-white p-5">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-[#E1E8E2] pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <SlidersHorizontal
                  className="h-4 w-4 shrink-0 text-[#174C3C]"
                  aria-hidden="true"
                />
                <h2 className="truncate font-display text-base font-semibold text-[#17231E]">
                  Climate Scenarios
                </h2>
              </div>
              <DataClassificationBadge category="scenario" customLabel="Hypothetical" />
            </div>

            {farmScenarios.length > 0 ? (
              <div className="mt-3.5 space-y-2">
                {farmScenarios.slice(0, 2).map((scen) => (
                  <div
                    key={scen.id}
                    className="rounded-lg border border-[#E1E8E2] bg-[#F7F8F5] px-3 py-2 text-xs"
                  >
                    <p className="font-semibold text-[#17231E]">{scen.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#65736B]">
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
                    <p className="text-[11px] text-[#65736B]">
                      {IRRIGATION_MODE_LABELS[scen.config.irrigationMode]}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-[#65736B]">
                No hypothetical scenarios saved for {farm.name}. Run stress-tests in the Simulator.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('simulator')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#174C3C] hover:underline"
          >
            <span>Open Scenario Simulator ({farmScenarios.length})</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Agricultural Risk Indicators */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E1E8E2] bg-white p-5">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-[#E1E8E2] pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className="h-4 w-4 text-[#9A5B00]"
                  aria-hidden="true"
                />
                <h2 className="font-display text-base font-semibold text-[#17231E]">
                  Agricultural Risk Indicators
                </h2>
              </div>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {riskIndicators.map((risk) => {
                const badgeClass =
                  risk.severity === 'High'
                    ? 'border-[#EBC4C4] bg-[#FEF3F3] text-[#991B1B]'
                    : risk.severity === 'Moderate'
                      ? 'border-[#E6D1A5] bg-[#FDF9EE] text-[#8A5A00]'
                      : 'border-[#C6DCD0] bg-[#EAF2EC] text-[#174C3C]';
                return (
                  <button
                    key={risk.label}
                    type="button"
                    onClick={() => onNavigate(risk.target)}
                    className="w-full rounded-lg border border-[#E1E8E2] bg-[#F7F8F5] px-3 py-2 text-left text-xs transition-colors hover:border-[#174C3C]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#17231E]">
                        {risk.label}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                      >
                        {risk.severity}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-[#65736B]">
                      {risk.detail}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('crops')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#174C3C] hover:underline"
          >
            <span>Inspect Full Crop Suitability</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Quick Navigation Bar to Major Tools */}
      <section aria-label="Quick navigation to analytical tools">
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
                className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-[#E1E8E2] bg-white px-3.5 py-2.5 text-left text-xs font-semibold text-[#17231E] transition-colors hover:border-[#174C3C] hover:bg-[#F7F8F5]"
              >
                <Icon className="h-4 w-4 shrink-0 text-[#287A5A]" aria-hidden="true" />
                <span className="truncate">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Date-Range Controls + Rainfall & Temperature Charts */}
      <section aria-label="Seasonal baseline climate charts" className="space-y-3">
        <div className="flex flex-col gap-2 rounded-xl border border-[#E1E8E2] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#17231E]">
              Seasonal Baseline Chart Window
            </span>
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

      {/* Crop Rotation Timeline + Farm Health Indicators */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E1E8E2] bg-white p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#E1E8E2] pb-3">
            <div>
              <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#17231E]">
                <span>Crop Rotation Timeline</span>
                <MetricTooltip
                  label="Crop Rotation Timeline"
                  description="Chronological sequence of completed, active, and planned crops with nitrogen gain or depletion per hectare."
                />
              </h2>
              <p className="text-xs text-[#65736B]">
                Sequential field history and upcoming seasonal planting schedule
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="text-xs font-semibold text-[#174C3C] hover:underline whitespace-nowrap"
            >
              Edit Sequence
            </button>
          </div>

          {farm.rotationPlan.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#65736B]">
              <p>No rotation seasons scheduled yet.</p>
              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="mt-2 font-semibold text-[#174C3C] hover:underline"
              >
                Open Rotation Planner
              </button>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#E1E8E2]">
              {farm.rotationPlan.map((step, index) => (
                <div
                  key={step.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EAF2EC] font-mono text-xs font-semibold tabular-nums text-[#174C3C]">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#17231E]">
                        {step.cropName}
                      </p>
                      <p className="text-xs text-[#65736B]">
                        {step.season} · {step.family}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pl-10 text-xs tabular-nums sm:pl-0">
                    <span className="font-mono text-[#65736B]">
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
                            ? 'text-[#65736B]'
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

        <div className="rounded-xl border border-[#E1E8E2] bg-white p-5 lg:col-span-5">
          <div className="border-b border-[#E1E8E2] pb-3">
            <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#17231E]">
              <span>Farm Health Indicators</span>
              <MetricTooltip
                label="Farm Health Breakdown"
                description="Four diagnostic pillars measuring soil organic matter, nitrogen budget, water buffering, and pest diversity."
              />
            </h2>
            <p className="text-xs text-[#65736B]">
              Agronomic soil &amp; field resilience breakdown
            </p>
          </div>
          <div className="mt-4 space-y-4">
            {healthIndicators.map((ind) => (
              <div key={ind.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 font-medium text-[#17231E]">
                    <span>{ind.label}</span>
                    <MetricTooltip label={ind.label} description={ind.tooltip} />
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#174C3C]">
                    {ind.value}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded bg-[#E1E8E2]">
                  <div
                    className="h-full rounded bg-[#287A5A]"
                    style={{ width: `${ind.score}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#65736B]">{ind.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Crop Suitability Overview + Recent Activity */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E1E8E2] bg-white p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#E1E8E2] pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-[#17231E]">
                  <span>Crop Suitability Overview</span>
                  <MetricTooltip
                    label="Crop Recommendations"
                    description="Candidates scored by climate compatibility, soil preference, botanical family change, and nitrogen impact."
                  />
                </h2>
                <DataClassificationBadge category="suitability" />
              </div>
              <p className="mt-0.5 text-xs text-[#65736B]">
                Ranked by climate fit, nitrogen recovery, and pest interruption (no yield/profit forecasts)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('crops')}
              className="text-xs font-semibold text-[#174C3C] hover:underline whitespace-nowrap"
            >
              All 10 Crops
            </button>
          </div>

          <div className="mt-4 divide-y divide-[#E1E8E2]">
            {recommendations.slice(0, 3).map((rec) => (
              <div key={rec.crop.id} className="py-3.5 first:pt-1 last:pb-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="font-display text-sm font-semibold text-[#17231E]">
                        {rec.crop.name}
                      </h3>
                      <span className="text-xs text-[#65736B]">
                        {rec.crop.family} · {rec.fitLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#65736B]">
                      {rec.rationale}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums text-[#65736B]">
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
                      <span>Root Depth: {rec.crop.rootDepth}</span>
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

        <div className="rounded-xl border border-[#E1E8E2] bg-white p-5 lg:col-span-5">
          <div className="border-b border-[#E1E8E2] pb-3">
            <h2 className="font-display text-base font-semibold text-[#17231E]">
              Recent Activity
            </h2>
            <p className="text-xs text-[#65736B]">
              Workspace planning updates and field logs
            </p>
          </div>
          {activities.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#65736B]">
              No recent activity recorded yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-[#E1E8E2]">
              {activities.slice(0, 5).map((item) => (
                <div key={item.id} className="py-3 first:pt-1 last:pb-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#17231E]">
                      {item.action}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-[#65736B]">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#65736B]">{item.detail}</p>
                  <p className="mt-0.5 text-[11px] text-[#65736B]">
                    {item.farmName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
