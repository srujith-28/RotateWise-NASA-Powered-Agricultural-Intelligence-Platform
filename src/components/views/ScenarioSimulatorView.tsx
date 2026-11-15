import {
  AlertTriangle,
  Edit3,
  FileDown,
  Info,
  RefreshCw,
  Satellite,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CROP_KNOWLEDGE_DATABASE } from '../../data/cropKnowledgeDb';
import type { UseNasaPowerClimateResult, NasaPresetId } from '../../hooks/useNasaPowerClimate';
import { formatRainfall, formatTemp } from '../../lib/agronomy';
import { knowledgeEntryToCropProfile } from '../../lib/cropSuitabilityEngine';
import {
  DEFAULT_DECISION_WEIGHTS,
  loadDecisionPreferencesForFarm,
  resetDecisionPreferencesForFarm,
  saveDecisionPreferencesForFarm,
} from '../../lib/decisionScoringEngine';
import {
  createBaselineConfigForFarm,
  createSavedScenario,
  deleteScenario,
  duplicateScenario,
  IRRIGATION_MODE_LABELS,
  loadScenariosForFarm,
  MAX_COMPARISON_SCENARIOS,
  renameScenario,
  saveOrUpdateScenario,
  simulateClimateScenario,
} from '../../lib/scenarioSimulationEngine';
import type {
  ClimateScenarioConfig,
  CropProfile,
  DecisionWeights,
  Farm,
  FarmDecisionPreferences,
  SavedClimateScenario,
} from '../../types/rotatewise';
import { KpiCard } from '../common/KpiCard';
import { EmptyState } from '../common/StateFeedback';
import { SavedScenariosPanel } from '../simulator/SavedScenariosPanel';
import { ScenarioComparisonCharts } from '../simulator/ScenarioComparisonCharts';
import { ScenarioControlsPanel } from '../simulator/ScenarioControlsPanel';
import { ScenarioDecisionEnginePanel } from '../simulator/ScenarioDecisionEnginePanel';
import { ScenarioRiskAndRecommendations } from '../simulator/ScenarioRiskAndRecommendations';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DataClassificationBadge } from '../ui/DataClassificationBadge';
import { PageHeader } from '../ui/PageHeader';

interface ScenarioSimulatorViewProps {
  farm: Farm | null;
  nasaClimate: UseNasaPowerClimateResult;
  unitSystem: 'imperial' | 'metric';
  savedScenarios: SavedClimateScenario[];
  onUpdateSavedScenarios: (
    updater: (prev: SavedClimateScenario[]) => SavedClimateScenario[]
  ) => void;
  decisionPreferencesByFarm: Record<string, FarmDecisionPreferences>;
  onUpdateDecisionPreferences: (
    updater: (
      prev: Record<string, FarmDecisionPreferences>
    ) => Record<string, FarmDecisionPreferences>
  ) => void;
  onAddToRotation: (crop: CropProfile) => void;
  onSaveScenarioReport: (
    summary: string,
    targetCropName: string,
    meta?: { scenarioTitle?: string; climateSuitability?: number }
  ) => void;
  onOpenAddFarm: () => void;
  onOpenEditFarm: (farm: Farm) => void;
  onToast?: (message: string, tone?: 'success' | 'info' | 'warning') => void;
}

function formatRetrievedTimestamp(iso: string | null): string {
  if (!iso) return 'Not yet retrieved';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ScenarioSimulatorView({
  farm,
  nasaClimate,
  unitSystem,
  savedScenarios,
  onUpdateSavedScenarios,
  decisionPreferencesByFarm,
  onUpdateDecisionPreferences,
  onAddToRotation,
  onSaveScenarioReport,
  onOpenAddFarm,
  onOpenEditFarm,
  onToast,
}: ScenarioSimulatorViewProps) {
  const farmScenarios = useMemo(
    () => loadScenariosForFarm(savedScenarios, farm),
    [savedScenarios, farm]
  );

  const activeFarmPrefs = useMemo(
    () =>
      loadDecisionPreferencesForFarm(
        decisionPreferencesByFarm,
        farm,
        farmScenarios
      ),
    [decisionPreferencesByFarm, farm, farmScenarios]
  );

  const [config, setConfig] = useState<ClimateScenarioConfig>(() =>
    farmScenarios[0]?.config ?? createBaselineConfigForFarm(farm)
  );
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(
    farmScenarios[0]?.id ?? null
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDeleteScenario, setPendingDeleteScenario] =
    useState<SavedClimateScenario | null>(null);

  const comparedScenarioIds = activeFarmPrefs?.selectedScenarioIds ?? [];

  // Sync configuration and restore per-farm saved baseline preset when the active farm changes
  useEffect(() => {
    const nextFarmScenarios = loadScenariosForFarm(savedScenarios, farm);
    setConfig(nextFarmScenarios[0]?.config ?? createBaselineConfigForFarm(farm));
    setActiveScenarioId(nextFarmScenarios[0]?.id ?? null);
    setNotice(null);

    if (farm) {
      const savedPref = decisionPreferencesByFarm[farm.id];
      if (
        savedPref &&
        savedPref.lastBaselinePreset !== 'custom' &&
        savedPref.lastBaselinePreset !== nasaClimate.preset
      ) {
        nasaClimate.selectPreset(savedPref.lastBaselinePreset);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm?.id]);

  const nasaDataset = nasaClimate.status === 'success' ? nasaClimate.data : null;

  const result = useMemo(
    () =>
      simulateClimateScenario(
        farm,
        nasaDataset,
        config,
        CROP_KNOWLEDGE_DATABASE
      ),
    [farm, nasaDataset, config]
  );

  if (!farm) {
    return (
      <EmptyState
        title="No Active Farm for Scenario Simulation"
        description="Select or add a farm parcel to run deterministic drought, heat, irrigation, and crop-shift simulations anchored to NASA POWER climate data."
        actionLabel="Add First Farm"
        onAction={onOpenAddFarm}
      />
    );
  }

  const ensureFarmScenariosPersisted = (
    prev: SavedClimateScenario[]
  ): SavedClimateScenario[] => {
    const hasFarmEntries = prev.some((s) => s.farmId === farm.id);
    if (hasFarmEntries) return prev;
    return [...loadScenariosForFarm(prev, farm), ...prev];
  };

  const handleRestoreBaseline = () => {
    setConfig(createBaselineConfigForFarm(farm));
    setActiveScenarioId(null);
    setNotice(
      'Restored configuration to 0% rainfall delta, 0°C shift, and current farm irrigation.'
    );
  };

  const updatePrefsForFarm = (
    updater: (current: FarmDecisionPreferences) => FarmDecisionPreferences
  ) => {
    onUpdateDecisionPreferences((prev) => {
      const current =
        loadDecisionPreferencesForFarm(prev, farm, farmScenarios) ??
        activeFarmPrefs;
      if (!current) return prev;
      return saveDecisionPreferencesForFarm(prev, updater(current));
    });
  };

  const handleSaveAsNewScenario = (name: string) => {
    const created = createSavedScenario({
      farmId: farm.id,
      name,
      config,
    });
    onUpdateSavedScenarios((prev) =>
      saveOrUpdateScenario(ensureFarmScenariosPersisted(prev), created)
    );
    setActiveScenarioId(created.id);
    updatePrefsForFarm((curr) => ({
      ...curr,
      selectedScenarioIds:
        curr.selectedScenarioIds.length < MAX_COMPARISON_SCENARIOS
          ? Array.from(new Set([...curr.selectedScenarioIds, created.id]))
          : curr.selectedScenarioIds,
    }));
    setNotice(`Saved hypothetical scenario "${created.name}" for ${farm.name}.`);
    onToast?.(`Saved hypothetical scenario "${created.name}".`, 'success');
  };

  const handleLoadScenario = (scenario: SavedClimateScenario) => {
    setConfig({
      ...scenario.config,
      comparedAlternativeCropIds: [...scenario.config.comparedAlternativeCropIds],
    });
    setActiveScenarioId(scenario.id);
    setNotice(`Loaded "${scenario.name}" into simulation controls.`);
    onToast?.(`Loaded scenario "${scenario.name}".`, 'info');
  };

  const handleRenameScenario = (scenarioId: string, newName: string) => {
    onUpdateSavedScenarios((prev) =>
      renameScenario(ensureFarmScenariosPersisted(prev), scenarioId, newName)
    );
    setNotice(`Renamed scenario to "${newName}".`);
    onToast?.(`Renamed scenario to "${newName}".`, 'success');
  };

  const handleDuplicateScenario = (scenarioId: string) => {
    let duplicatedId: string | null = null;
    let duplicatedName = '';
    onUpdateSavedScenarios((prev) => {
      const seeded = ensureFarmScenariosPersisted(prev);
      const { scenarios, duplicated } = duplicateScenario(seeded, scenarioId);
      if (duplicated) {
        duplicatedId = duplicated.id;
        duplicatedName = duplicated.name;
      }
      return scenarios;
    });
    if (duplicatedId) {
      setActiveScenarioId(duplicatedId);
      setNotice(`Duplicated scenario as "${duplicatedName}".`);
      onToast?.(`Duplicated scenario as "${duplicatedName}".`, 'success');
    }
  };

  const handleDeleteScenario = (scenarioId: string) => {
    const target = farmScenarios.find((s) => s.id === scenarioId);
    onUpdateSavedScenarios((prev) =>
      deleteScenario(ensureFarmScenariosPersisted(prev), scenarioId)
    );
    updatePrefsForFarm((curr) => ({
      ...curr,
      selectedScenarioIds: curr.selectedScenarioIds.filter(
        (id) => id !== scenarioId
      ),
    }));
    if (activeScenarioId === scenarioId) {
      setActiveScenarioId(null);
    }
    setPendingDeleteScenario(null);
    setNotice('Deleted saved scenario.');
    onToast?.(
      target ? `Deleted scenario "${target.name}".` : 'Deleted saved scenario.',
      'info'
    );
  };

  const handleToggleCompareScenario = (scenarioId: string) => {
    updatePrefsForFarm((curr) => {
      const exists = curr.selectedScenarioIds.includes(scenarioId);
      if (exists) {
        return {
          ...curr,
          selectedScenarioIds: curr.selectedScenarioIds.filter(
            (id) => id !== scenarioId
          ),
        };
      }
      if (curr.selectedScenarioIds.length >= MAX_COMPARISON_SCENARIOS) {
        return curr;
      }
      return {
        ...curr,
        selectedScenarioIds: [...curr.selectedScenarioIds, scenarioId],
      };
    });
  };

  const handleSelectBaselinePreset = (
    presetId: Exclude<NasaPresetId, 'custom'>
  ) => {
    nasaClimate.selectPreset(presetId);
    updatePrefsForFarm((curr) => ({
      ...curr,
      lastBaselinePreset: presetId,
      lastBaselineStartDate: nasaClimate.appliedStartDate,
      lastBaselineEndDate: nasaClimate.appliedEndDate,
    }));
  };

  const handleChangeWeights = (weights: DecisionWeights) => {
    updatePrefsForFarm((curr) => ({ ...curr, weights }));
  };

  const handleToggleBaselineReference = (include: boolean) => {
    updatePrefsForFarm((curr) => ({
      ...curr,
      includeBaselineReference: include,
    }));
  };

  const handleRestoreDefaultWeights = () => {
    updatePrefsForFarm((curr) => ({
      ...curr,
      weights: { ...DEFAULT_DECISION_WEIGHTS },
    }));
    setNotice('Restored default decision weights (30% Climate, 30% Water, 20% Soil, 20% Rotation).');
  };

  const handleResetFarmPreferences = () => {
    onUpdateDecisionPreferences((prev) =>
      resetDecisionPreferencesForFarm(prev, farm, farmScenarios)
    );
    setNotice(`Reset saved decision preferences and weights for ${farm.name}.`);
  };

  const handleSaveReport = () => {
    if (
      result.status !== 'ready' ||
      !result.simulatedClimate ||
      !result.primaryBaselineEval ||
      !result.primarySimulatedEval
    ) {
      return;
    }
    const cropName = result.primarySimulatedEval.crop.name;
    const baseScore = result.primaryBaselineEval.overallScore;
    const simScore = result.primarySimulatedEval.overallScore;
    const delta = simScore - baseScore;
    const rainStr =
      config.rainfallDeltaPct >= 0
        ? `+${config.rainfallDeltaPct}%`
        : `${config.rainfallDeltaPct}%`;
    const tempStr =
      config.temperatureShiftC >= 0
        ? `+${config.temperatureShiftC}°C`
        : `${config.temperatureShiftC}°C`;

    const summary = `Hypothetical scenario (${rainStr} rainfall, ${tempStr} temperature, ${IRRIGATION_MODE_LABELS[config.irrigationMode]}) anchored to NASA POWER (${nasaDataset?.startDate} to ${nasaDataset?.endDate}). ${cropName} suitability shifted from ${baseScore}/100 baseline to ${simScore}/100 (${delta >= 0 ? `+${delta}` : delta} pts); peak risk assessed as ${result.highestRiskLevel}.`;

    onSaveScenarioReport(summary, cropName, {
      scenarioTitle: `${farm.name} · ${cropName} (${rainStr}, ${tempStr})`,
      climateSuitability: simScore,
    });
    setNotice('Saved hypothetical scenario summary to Reports.');
    onToast?.('Saved scenario summary to Reports.', 'success');
  };

  const isReady =
    result.status === 'ready' &&
    result.baselineClimate !== null &&
    result.simulatedClimate !== null &&
    result.primaryBaselineEval !== null &&
    result.primarySimulatedEval !== null;

  const baseEval = result.primaryBaselineEval;
  const simEval = result.primarySimulatedEval;
  const scoreDelta =
    baseEval && simEval ? simEval.overallScore - baseEval.overallScore : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Scenario Simulator"
        title="Climate Scenario Simulator"
        subtitle={`Stress-test crop suitability, water availability, and rotational risks for ${farm.name}.`}
        classification="scenario"
        metadata={
          <>
            <span className="font-mono tabular-nums text-[#17231E]">
              {farm.coordinates.lat.toFixed(4)}°, {farm.coordinates.lng.toFixed(4)}°
            </span>
            <span aria-hidden="true">·</span>
            <span>{farm.soilType}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              pH {farm.health.phLevel.toFixed(1)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{farm.irrigation}</span>
            <span aria-hidden="true">·</span>
            <span>Current Crop: {farm.currentCropName}</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => onOpenEditFarm(farm)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#E1E8E2] bg-white px-3 text-xs font-medium text-[#17231E] hover:bg-[#F7F8F5] whitespace-nowrap"
            >
              <Edit3 className="h-3.5 w-3.5 text-[#174C3C]" aria-hidden="true" />
              <span>Edit Soil / Crop</span>
            </button>
            <button
              type="button"
              disabled={!isReady}
              onClick={handleSaveReport}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#174C3C] px-3.5 text-xs font-semibold text-white hover:bg-[#113A2E] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save to Reports</span>
            </button>
          </>
        }
      />

      {/* 1. Historical NASA POWER Baseline Context */}
      <section
        aria-label="1. Historical NASA POWER baseline observations"
        className="rounded-xl border border-[#E1E8E2] bg-white p-4"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#65736B]">
            1. Historical NASA Baseline
          </span>
          <DataClassificationBadge
            category={nasaDataset ? 'nasa' : 'insufficient'}
          />
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-2.5 text-xs">
            <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-[#154734]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#14221A]">
                {nasaDataset
                  ? `Historical Baseline: NASA POWER (AG) · ${nasaDataset.classification} · ${nasaDataset.startDate} to ${nasaDataset.endDate}`
                  : nasaClimate.status === 'loading'
                    ? `Retrieving historical NASA POWER baseline for ${nasaClimate.appliedStartDate} to ${nasaClimate.appliedEndDate}...`
                    : `Historical Baseline Unavailable · Requested ${nasaClimate.appliedStartDate} to ${nasaClimate.appliedEndDate}`}
              </p>
              <p className="mt-0.5 text-[#4B5B51]">
                {nasaDataset ? (
                  <>
                    Observed Mean{' '}
                    <span className="font-mono font-semibold tabular-nums text-[#14221A]">
                      {formatTemp(nasaDataset.summary.meanTempC ?? 0, unitSystem)}
                    </span>{' '}
                    · Observed Rainfall{' '}
                    <span className="font-mono font-semibold tabular-nums text-[#14221A]">
                      {formatRainfall(nasaDataset.summary.totalRainfallMm ?? 0, unitSystem)}
                    </span>{' '}
                    ({nasaDataset.summary.validDayCount} days) · Retrieved:{' '}
                    <span className="font-mono tabular-nums">
                      {formatRetrievedTimestamp(nasaClimate.lastRetrievedAt)}
                    </span>
                  </>
                ) : (
                  <>
                    Last successful retrieval:{' '}
                    <span className="font-mono tabular-nums">
                      {formatRetrievedTimestamp(nasaClimate.lastRetrievedAt)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: '30d', label: '30 Days' },
                { id: '90d', label: '90 Days' },
                { id: 'growing2026', label: '2026 Season' },
                { id: 'season2025', label: '2025 Season' },
              ] as const
            ).map((btn) => {
              const active = nasaClimate.preset === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleSelectBaselinePreset(btn.id)}
                  className={`h-8 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#154734] text-white'
                      : 'border border-[#E4E2DA] bg-[#FAFAF7] text-[#4B5B51] hover:bg-[#F2F6F3] hover:text-[#14221A]'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={nasaClimate.refresh}
              aria-label="Refresh NASA POWER baseline observations"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E4E2DA] bg-[#FAFAF7] px-2.5 text-xs font-medium text-[#4B5B51] hover:bg-[#F2F6F3] hover:text-[#14221A]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${nasaClimate.status === 'loading' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 border-t border-[#ECEAE3] pt-3 text-[11px] text-[#4B5B51]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#154734]" aria-hidden="true" />
          <span>
            <strong>Hypothetical Simulation vs. Weather Forecast:</strong> Baseline metrics are real historical <strong>NASA POWER</strong> observations for {farm.name}. Simulated metrics represent deterministic counterfactual adjustments (never weather forecasts, yield guarantees, or market projections).
          </span>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-[#CFE4D6] bg-[#F2F8F4] px-4 py-2.5 text-xs font-medium text-[#154734]"
        >
          {notice}
        </div>
      )}

      {/* Loading State */}
      {nasaClimate.status === 'loading' && (
        <div
          role="status"
          aria-label="Loading NASA POWER baseline observations"
          className="flex items-center gap-2.5 rounded-xl border border-[#DCE5DF] bg-[#F2F6F3] px-4 py-3 text-xs font-medium text-[#154734]"
        >
          <RefreshCw className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
          <span>
            Retrieving NASA POWER baseline observations for {farm.name} to anchor scenario calculations...
          </span>
        </div>
      )}

      {/* Explicit Error / Missing Baseline Limitation */}
      {(nasaClimate.status === 'error' ||
        (nasaClimate.status !== 'loading' && result.status === 'missing_baseline_climate')) && (
        <section
          role="alert"
          aria-label="Missing NASA POWER baseline climate limitation"
          className="rounded-xl border border-[#F2C6C6] bg-[#FEF2F2] p-4 text-xs text-[#991B1B]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[#7F1D1D]">
                  Simulation Blocked: Historical NASA POWER Baseline Unavailable
                </p>
                <p className="mt-0.5">
                  {nasaClimate.error ?? result.limitationReason} Demonstration weather is never substituted for missing baseline observations.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={nasaClimate.refresh}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#DC2626]/40 bg-white px-3 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry NASA POWER</span>
            </button>
          </div>
        </section>
      )}

      {/* Baseline vs. Simulated Top KPI Summary */}
      {isReady && result.baselineClimate && result.simulatedClimate && baseEval && simEval && (
        <section
          aria-label="Baseline versus hypothetical scenario key indicators"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label="Simulated Rainfall (Hypothetical)"
            value={formatRainfall(result.simulatedClimate.totalRainfallMm, unitSystem)}
            subtitle={`Baseline: ${formatRainfall(result.baselineClimate.totalRainfallMm, unitSystem)} (${config.rainfallDeltaPct >= 0 ? `+${config.rainfallDeltaPct}` : config.rainfallDeltaPct}%)`}
            subtitleTone={config.rainfallDeltaPct <= -20 ? 'danger' : 'neutral'}
            tooltip="Total rainfall across the selected NASA POWER window after applying your hypothetical rainfall percentage adjustment."
          />
          <KpiCard
            label="Simulated Mean Temp (Hypothetical)"
            value={formatTemp(result.simulatedClimate.meanTempC, unitSystem)}
            subtitle={`Baseline: ${formatTemp(result.baselineClimate.meanTempC, unitSystem)} (${config.temperatureShiftC >= 0 ? `+${config.temperatureShiftC}` : config.temperatureShiftC}°C)`}
            subtitleTone={config.temperatureShiftC >= 3 ? 'warning' : 'neutral'}
            tooltip="Mean parcel temperature calculated by shifting the NASA POWER baseline temperature by your selected °C offset."
          />
          <KpiCard
            label={`${simEval.crop.name} Suitability`}
            value={String(simEval.overallScore)}
            suffix="/100"
            valueTone={
              simEval.overallScore >= 75
                ? 'primary'
                : simEval.overallScore < 55
                  ? 'danger'
                  : 'default'
            }
            subtitle={`Baseline: ${baseEval.overallScore}/100 (${scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts · ${simEval.suitabilityCategory})`}
            subtitleTone={scoreDelta > 0 ? 'positive' : scoreDelta < 0 ? 'danger' : 'neutral'}
            tooltip="Deterministic 0–100 suitability score computed by evaluateCropSuitability under simulated climate & irrigation parameters."
          />
          <KpiCard
            label="Peak Scenario Risk"
            value={result.highestRiskLevel}
            valueTone={
              result.highestRiskLevel === 'Critical' || result.highestRiskLevel === 'High'
                ? 'danger'
                : result.highestRiskLevel === 'Low'
                  ? 'primary'
                  : 'default'
            }
            subtitle={`Irrigation: ${result.simulatedClimate.effectiveIrrigation}`}
            subtitleTone="neutral"
            tooltip="Highest severity across deterministic rainfall, thermal, water shortage, soil, seasonal, and rotation conflict rules."
          />
        </section>
      )}

      {/* Main Split Workspace: 2. Hypothetical Assumptions (Left) + 3. Calculated Model Outputs (Right) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-2 lg:col-span-4">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#65736B]">
              2. Hypothetical Scenario Assumptions
            </span>
            <DataClassificationBadge category="scenario" customLabel="Assumptions" />
          </div>
          <ScenarioControlsPanel
            farm={farm}
            config={config}
            disabled={nasaClimate.status === 'loading' && !isReady}
            onChangeConfig={setConfig}
            onRestoreBaseline={handleRestoreBaseline}
            onSaveAsNewScenario={handleSaveAsNewScenario}
          />
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#65736B]">
              3. Calculated Model Outputs
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <DataClassificationBadge category="suitability" />
              <DataClassificationBadge category="scenario" />
            </div>
          </div>
          {isReady && baseEval && simEval && result.simulatedClimate ? (
            <>
              {/* Baseline vs Simulated Category Breakdown Table */}
              <section
                aria-label="Baseline versus simulated suitability breakdown"
                className="rounded-xl border border-[#E4E2DA] bg-white p-5 shadow-[0_1px_2px_rgba(18,43,29,0.03)]"
              >
                <div className="flex flex-col gap-1 border-b border-[#ECEAE3] pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#14221A]">
                      Baseline vs. Simulated Suitability Breakdown — {simEval.crop.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-[#6B7970]">
                      Deterministic category-by-category evaluation using Crop Intelligence Engine ({simEval.confidenceLevel} confidence ·{' '}
                      {simEval.dataCompletenessPct}% data completeness).
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-[#154734]">
                    {baseEval.overallScore} → {simEval.overallScore}/100 ({scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts)
                  </span>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#ECEAE3] bg-[#FAFAF7] text-[#6B7970]">
                        <th className="px-3 py-2.5 font-medium">Factor</th>
                        <th className="px-3 py-2.5 text-right font-medium">Weight</th>
                        <th className="px-3 py-2.5 text-right font-medium">Baseline</th>
                        <th className="px-3 py-2.5 text-right font-medium">Simulated</th>
                        <th className="px-3 py-2.5 text-right font-medium">Delta</th>
                        <th className="px-3 py-2.5 font-medium">Simulated Diagnostic</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE3]">
                      {simEval.categories.map((simCat) => {
                        const baseCat = baseEval.categories.find((c) => c.id === simCat.id);
                        const hasBothScores =
                          baseCat?.score !== null &&
                          baseCat?.score !== undefined &&
                          simCat.score !== null;
                        const catDelta = hasBothScores
                          ? simCat.score! - baseCat!.score!
                          : 0;
                        return (
                          <tr key={simCat.id} className="hover:bg-[#FAFAF7]">
                            <td className="px-3 py-2.5 font-semibold text-[#14221A]">
                              {simCat.label}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#6B7970]">
                              {simCat.weight}%
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#4B5B51]">
                              {baseCat && baseCat.score !== null ? `${baseCat.score}/100` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-[#154734]">
                              {simCat.score !== null ? `${simCat.score}/100` : 'Unavailable'}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${
                                catDelta > 0
                                  ? 'text-[#154734]'
                                  : catDelta < 0
                                    ? 'text-[#B91C1C]'
                                    : 'text-[#6B7970]'
                              }`}
                            >
                              {hasBothScores ? (catDelta > 0 ? `+${catDelta}` : catDelta) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-[#4B5B51]">{simCat.detail}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Compared Alternative Crops Summary Row */}
                {config.comparedAlternativeCropIds.length > 0 && (
                  <div className="mt-4 border-t border-[#ECEAE3] pt-3">
                    <p className="text-xs font-semibold text-[#14221A]">
                      Compared Alternative Crops Under This Scenario:
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {config.comparedAlternativeCropIds
                        .map((id) => result.allCropDeltas.find((d) => d.cropId === id))
                        .filter((d): d is NonNullable<typeof d> => Boolean(d))
                        .map((alt) => (
                          <div
                            key={alt.cropId}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#E4E2DA] bg-[#FAFAF7] px-3 py-2 text-xs"
                          >
                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    primaryCropId: alt.cropId,
                                    comparedAlternativeCropIds:
                                      prev.comparedAlternativeCropIds.filter(
                                        (id) => id !== alt.cropId
                                      ),
                                  }))
                                }
                                className="font-semibold text-[#14221A] hover:text-[#154734] hover:underline"
                              >
                                {alt.cropName}
                              </button>
                              <span className="block text-[11px] text-[#6B7970]">
                                {alt.statusTag} · {alt.rotationStatus === 'clean' ? 'Rotation clean' : 'Rotation conflict'}
                              </span>
                            </div>
                            <div className="shrink-0 whitespace-nowrap text-right font-mono tabular-nums">
                              <span className="font-bold text-[#154734]">
                                {alt.simulatedScore}/100
                              </span>
                              <span className="block text-[11px] text-[#6B7970]">
                                Base {alt.baselineScore} ({alt.scoreDelta >= 0 ? `+${alt.scoreDelta}` : alt.scoreDelta})
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </section>

              {/* 4 Recharts Baseline vs Scenario Comparison Visualizations */}
              <ScenarioComparisonCharts result={result} unitSystem={unitSystem} />
            </>
          ) : (
            <div className="rounded-xl border border-[#E4E2DA] bg-white p-6 text-center text-sm text-[#4B5B51]">
              Waiting for historical NASA POWER baseline observations to render scenario charts and suitability comparisons.
            </div>
          )}
        </div>
      </div>

      {/* Rule-Based Risk Analysis & Scenario Recommendations */}
      {isReady && (
        <ScenarioRiskAndRecommendations
          result={result}
          onSelectPrimaryCrop={(cropId) =>
            setConfig((prev) => ({
              ...prev,
              primaryCropId: cropId,
              comparedAlternativeCropIds: prev.comparedAlternativeCropIds.filter(
                (id) => id !== cropId
              ),
            }))
          }
          onAddToRotation={(crop) => {
            const entry = CROP_KNOWLEDGE_DATABASE.find((c) => c.id === crop.id);
            onAddToRotation(entry ? knowledgeEntryToCropProfile(entry) : crop);
          }}
        />
      )}

      {/* Saved Scenarios & Multi-Scenario Comparison (up to 3) */}
      <SavedScenariosPanel
        farm={farm}
        nasaData={nasaDataset}
        scenarios={farmScenarios}
        activeScenarioId={activeScenarioId}
        comparedScenarioIds={comparedScenarioIds}
        unitSystem={unitSystem}
        onLoadScenario={handleLoadScenario}
        onRenameScenario={handleRenameScenario}
        onDuplicateScenario={handleDuplicateScenario}
        onDeleteScenario={(scenarioId) => {
          const target = farmScenarios.find((s) => s.id === scenarioId) ?? null;
          setPendingDeleteScenario(target);
        }}
        onToggleCompareScenario={handleToggleCompareScenario}
      />

      {/* Advanced Scenario Decision Engine */}
      {activeFarmPrefs && (
        <ScenarioDecisionEnginePanel
          farm={farm}
          nasaData={nasaDataset}
          scenarios={farmScenarios}
          preferences={{
            ...activeFarmPrefs,
            lastBaselineStartDate:
              nasaDataset?.startDate ?? activeFarmPrefs.lastBaselineStartDate,
            lastBaselineEndDate:
              nasaDataset?.endDate ?? activeFarmPrefs.lastBaselineEndDate,
          }}
          unitSystem={unitSystem}
          onToggleCompareScenario={handleToggleCompareScenario}
          onChangeWeights={handleChangeWeights}
          onToggleBaselineReference={handleToggleBaselineReference}
          onRestoreDefaultWeights={handleRestoreDefaultWeights}
          onResetFarmPreferences={handleResetFarmPreferences}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteScenario)}
        title="Delete Saved Scenario"
        description={
          pendingDeleteScenario
            ? `Delete "${pendingDeleteScenario.name}" from ${farm.name}? You can recreate it later from simulation controls.`
            : ''
        }
        confirmLabel="Delete Scenario"
        onConfirm={() => {
          if (pendingDeleteScenario) {
            handleDeleteScenario(pendingDeleteScenario.id);
          }
        }}
        onCancel={() => setPendingDeleteScenario(null)}
      />
    </div>
  );
}
